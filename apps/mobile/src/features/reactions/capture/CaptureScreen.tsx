import { lateLabel } from '@jinx/core';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Text } from '@/components/Text';
import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { useGameContext, useLiveState } from '@/features/checkin/queries';
import { inOpenSession } from '@/features/checkin/session';
import { hasLiveFeed } from '@/features/eggs/live';
import { liveStatusLabel } from '@/features/live/format';
import { useTheme } from '@/theme/ThemeProvider';

import { useMarkPromptOpened, useMyDelivery, usePostReaction, type CaptureInput, type ReactionVisibility } from '../queries';
import { enqueueCapture } from '../queue';
import { StitchedPhoto } from '../ui/ReactionCard';

type Step = 'back' | 'countdown' | 'front' | 'preview' | 'posting' | 'done';

const COUNTDOWN_SECONDS = 3;

/**
 * The capture flow, exactly as the prototype shows it (03, section 4): the prompt label over a
 * full-screen back-camera viewfinder and a shutter; a three-second countdown, "Get ready for
 * the selfie"; the front camera fires on its own; the stitched preview with Retake, Post and
 * "Only me". Back then front, sequentially: true simultaneous dual capture needs iOS multi-cam
 * and a custom native module (design/PORTING_NOTES.md). The mic is never used; no video.
 *
 * Self-triggered when opened without a prompt. Offline, the capture is queued and posted when
 * the app is back, late by however long that took.
 */
export function CaptureScreen({ gameId, promptId, auto = null }: { gameId: string; promptId: string | null; auto?: 'post' | 'private' | 'preview' | null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const placeholder = useRef<View>(null);
  const ctx = useGameContext(gameId);
  const attendance = useMyAttendanceForGame(gameId);
  const delivery = useMyDelivery(gameId, promptId ?? undefined);
  const markOpened = useMarkPromptOpened();
  const post = usePostReaction();
  const live = useLiveState(gameId, ctx.data?.sport_id, hasLiveFeed(ctx.data?.sport_id) && ctx.data?.status !== 'final');

  const [step, setStep] = useState<Step>('back');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [back, setBack] = useState<string | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const sessionOpen = inOpenSession(ctx.data);

  const label = delivery.data?.prompt?.label ?? null;
  const firedAt = delivery.data?.fired_at ?? null;
  // The clock is read in an effect, never in render: the lateness line ticks every 10 s.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);
  const seconds = firedAt && now ? Math.max(0, Math.round((now - Date.parse(firedAt)) / 1000)) : null;
  const late = lateLabel(seconds);

  // Opening the camera answers the prompt, so two ignored in a row is measured honestly.
  const opened = useRef(false);
  useEffect(() => {
    if (promptId && !opened.current) {
      opened.current = true;
      markOpened.mutate({ promptId, gameId });
    }
  }, [promptId, gameId, markOpened]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/games/${gameId}`);
  }, [router, gameId]);

  /**
   * One photo from the camera in front of the user. The simulator has no camera at all, so a
   * development build there captures a drawn placeholder instead, which keeps the whole flow
   * walkable (STATE.md trap 9); a device always uses the real camera.
   */
  const shoot = useCallback(async (): Promise<string> => {
    if (camera.current && cameraReady) {
      const photo = await camera.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      if (photo?.uri) return photo.uri;
    }
    if (__DEV__ && placeholder.current) {
      return captureRef(placeholder.current, { format: 'jpg', quality: 0.8, result: 'tmpfile' });
    }
    throw new Error('camera_unavailable');
  }, [cameraReady]);

  const onShutter = async () => {
    setProblem(null);
    try {
      const uri = await shoot();
      setBack(uri);
      setCount(COUNTDOWN_SECONDS);
      setStep('countdown');
    } catch {
      setProblem('The camera did not take that. Try again.');
    }
  };

  // The countdown, then the selfie fires on its own. One interval owns both the number and the
  // step change, so nothing sets state in the effect body itself.
  useEffect(() => {
    if (step !== 'countdown') return;
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(t);
          setStep('front');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'front') return;
    let cancelled = false;
    // Give the front camera a beat to come up before asking it for a frame.
    const t = setTimeout(async () => {
      try {
        const uri = await shoot();
        if (!cancelled) {
          setFront(uri);
          setStep('preview');
        }
      } catch {
        if (!cancelled) {
          setProblem('The selfie did not take. Try again.');
          setStep('back');
        }
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, shoot]);

  const retake = () => {
    setBack(null);
    setFront(null);
    setStep('back');
  };

  const submit = async (visibility: ReactionVisibility) => {
    const attendanceId = attendance.data?.id ?? ctx.data?.attendance?.id ?? null;
    if (!back || !front || !attendanceId) {
      setProblem('Check in at this game first, then react.');
      return;
    }
    const input: CaptureInput = {
      gameId,
      attendanceId,
      promptId,
      backUri: back,
      frontUri: front,
      visibility,
      periodLabel: liveStatusLabel(ctx.data?.sport_id ?? '', live.data) ?? null,
    };
    setStep('posting');
    try {
      await post.mutateAsync(input);
      setOutcome(visibility === 'private' ? 'Saved privately. It still attaches to Relive.' : late ? `Posted, ${late}.` : 'Posted.');
      setStep('done');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code) {
        setProblem('That did not post. Try again.');
        setStep('preview');
        return;
      }
      // No answer from the server: keep it and post when the app is back online.
      await enqueueCapture(input);
      setOutcome('No signal here. Saved; it posts when you are back online.');
      setStep('done');
    }
  };

  // Development only: `/react/<id>?auto=post|private|preview` runs the flow by itself, because
  // nothing can tap the simulator (STATE.md trap 9): the shutter fires a moment after the
  // screen is up, the selfie follows the countdown as always, and then it posts, saves
  // privately, or stops at the preview for a screenshot. A production build ignores it.
  const autoRun = __DEV__ ? auto : null;
  const autoFired = useRef(false);
  useEffect(() => {
    if (!autoRun || step !== 'back' || autoFired.current || !sessionOpen) return;
    autoFired.current = true;
    const t = setTimeout(() => void onShutter(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, step, sessionOpen]);
  useEffect(() => {
    if (!autoRun || autoRun === 'preview' || step !== 'preview') return;
    const t = setTimeout(() => void submit(autoRun === 'private' ? 'private' : 'followers'), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, step]);

  const facing: CameraType = step === 'front' || step === 'countdown' ? 'front' : 'back';
  const heading =
    step === 'countdown'
      ? String(count)
      : step === 'front'
        ? 'Hold still'
        : label
          ? `React to ${label}`
          : 'React now';
  const tip =
    step === 'countdown' || step === 'front'
      ? 'Get ready for the selfie'
      : 'Point at the field and shoot. The selfie fires right after.';

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0D12' }}>
      {step === 'preview' || step === 'posting' || step === 'done' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
          <StitchedPhoto backUrl={back} frontUrl={front} size={300} />
          {late ? (
            <Text variant="caption" style={{ color: '#FFFFFF', opacity: 0.8, marginTop: 8 }}>
              {late}
            </Text>
          ) : null}
          {outcome ? (
            <Text variant="bodyStrong" align="center" style={{ color: '#FFFFFF', marginTop: 16, paddingHorizontal: 24 }}>
              {outcome}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {permission?.granted ? (
            <CameraView ref={camera} style={{ flex: 1 }} facing={facing} mute onCameraReady={() => setCameraReady(true)} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text variant="sub" align="center" style={{ color: '#FFFFFF', opacity: 0.8 }}>
                {permission?.canAskAgain === false
                  ? 'Camera access is off. Allow it in Settings to react.'
                  : 'Jinx needs the camera for a reaction: one shot of the field, then a selfie.'}
              </Text>
            </View>
          )}
          {/* What the simulator captures in place of a camera frame: a drawn field. */}
          <View
            ref={placeholder}
            collapsable={false}
            pointerEvents="none"
            style={{ position: 'absolute', left: -1000, top: 0, width: 900, height: 1200, backgroundColor: facing === 'front' ? '#C98B6B' : '#2E7D4F' }}
          >
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 520, backgroundColor: facing === 'front' ? '#3A2A20' : '#16233F' }} />
          </View>
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 12, alignItems: 'center', paddingHorizontal: 24 }}>
            <Text
              variant={step === 'countdown' ? 'display' : 'h2'}
              align="center"
              style={{ color: '#FFFFFF' }}
              testID="capture-heading"
            >
              {heading}
            </Text>
            <Text variant="sub" align="center" style={{ color: '#FFFFFF', opacity: 0.85, marginTop: 6 }}>
              {tip}
            </Text>
            {late ? (
              <Text variant="caption" align="center" style={{ color: '#FFFFFF', opacity: 0.8, marginTop: 4 }}>
                {late}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 14, backgroundColor: '#0A0D12', gap: 10 }}>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        {!sessionOpen && ctx.data ? (
          <Notice tone="info">Reactions are for a game you are checked in at.</Notice>
        ) : null}
        {step === 'back' ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shutter"
              testID="capture-shutter"
              onPress={() => void onShutter()}
              disabled={!sessionOpen}
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#FFFFFF',
                borderWidth: 6,
                borderColor: theme.accent.fill,
                opacity: pressed || !sessionOpen ? 0.6 : 1,
              })}
            />
            <Button title="Cancel" variant="ghost" small onPress={close} />
          </View>
        ) : null}
        {step === 'preview' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Retake" variant="secondary" onPress={retake} style={{ flex: 1 }} />
            <Button title="Post reaction" onPress={() => void submit('followers')} style={{ flex: 1.4 }} />
            <Button title="Only me" variant="secondary" onPress={() => void submit('private')} style={{ flex: 1 }} />
          </View>
        ) : null}
        {step === 'posting' ? <Button title="Posting" loading onPress={() => {}} /> : null}
        {step === 'done' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Done" onPress={close} style={{ flex: 1 }} />
            <Button title="See the game" variant="secondary" onPress={() => router.replace(`/games/${gameId}`)} style={{ flex: 1 }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
