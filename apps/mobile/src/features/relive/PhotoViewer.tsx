import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/reference/icons';
import { REPORT_REASONS, useBlock, useReport } from '@/features/social/queries';
import { fontFamily } from '@/theme/fonts';
import { useReferenceTheme } from '@/theme/reference/TeamTheme';

import {
  VISIBILITY_LABEL,
  useDeletePhoto,
  useSetPhotoVisibility,
  type GamePhoto,
  type PhotoVisibility,
} from './photos';

const VISIBILITIES: PhotoVisibility[] = ['private', 'followers', 'public'];

/**
 * One photo or video, full screen, with what its viewer is allowed to do to it (SPEC.md 6.19).
 *
 * Your own item: choose who sees it, or delete it. Someone else's: report the item or block the
 * person, the same two tools every other piece of user content has (SPEC.md 11).
 *
 * A video opens in the system player through its signed URL. The app bundles no video module,
 * and a link that plays is better than a player that needs a new native build to exist.
 */
export function PhotoViewer(props: {
  photo: GamePhoto | null;
  mine: boolean;
  gameId: string | undefined;
  onClose: () => void;
}) {
  if (!props.photo) return null;
  // Keyed by the item, so the chosen visibility and any notice start fresh for each one.
  return <Viewer key={props.photo.id} {...props} photo={props.photo} />;
}

function Viewer({
  photo,
  mine,
  gameId,
  onClose,
}: {
  photo: GamePhoto;
  mine: boolean;
  gameId: string | undefined;
  onClose: () => void;
}) {
  const { base } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const setVisibility = useSetPhotoVisibility(gameId);
  const remove = useDeletePhoto(gameId);
  const report = useReport();
  const block = useBlock();
  const [chosen, setChosen] = React.useState<PhotoVisibility | null>(photo.visibility);
  const [notice, setNotice] = React.useState<string | null>(null);
  const Close = ICONS['i-chev-l'];
  const Check = ICONS['i-check-c'];

  const busy = setVisibility.isPending || remove.isPending || report.isPending || block.isPending;

  const onVisibility = async (visibility: PhotoVisibility) => {
    const before = chosen;
    setChosen(visibility);
    setNotice(null);
    try {
      await setVisibility.mutateAsync({ id: photo.id, visibility });
    } catch {
      setChosen(before);
      setNotice('That did not save. Try again.');
    }
  };

  const onDelete = () => {
    Alert.alert('Delete this?', 'It is removed for everyone, and cannot be brought back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove
            .mutateAsync(photo)
            .then(onClose)
            .catch(() => setNotice('That did not delete. Try again.'));
        },
      },
    ]);
  };

  const onReport = () => {
    Alert.alert('Report this', 'What is wrong with it?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () => {
          report
            .mutateAsync({ targetType: 'attendance_photo', targetId: photo.id, reason })
            .then(() => setNotice('Thanks. We will take a look.'))
            .catch(() => setNotice('That report did not send. Try again.'));
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const onBlock = () => {
    Alert.alert('Block this person?', 'You will not see each other anywhere in Jinx.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          block
            .mutateAsync({ userId: photo.userId })
            .then(onClose)
            .catch(() => setNotice('That did not work. Try again.'));
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.screen, { backgroundColor: base.canvas, paddingTop: insets.top }]}>
        <View style={s.head}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[s.iconButton, { backgroundColor: base.surface }]}
          >
            <Close size={20} color={base.ink} />
          </Pressable>
          {busy ? <ActivityIndicator /> : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {photo.kind === 'video' ? (
            <Pressable
              onPress={() => (photo.url ? void Linking.openURL(photo.url) : undefined)}
              accessibilityRole="button"
              accessibilityLabel="Play video"
              style={[s.media, s.video, { backgroundColor: base.surface }]}
            >
              <Text style={[s.videoLabel, { color: base.ink }]}>Play video</Text>
              <Text style={[s.meta, { color: base.muted }]}>Opens in the system player</Text>
            </Pressable>
          ) : photo.url ? (
            <Image
              source={{ uri: photo.url }}
              style={s.media}
              resizeMode="contain"
              accessibilityLabel={mine ? 'Your photo from this game' : 'A fan photo from this game'}
            />
          ) : (
            <View style={[s.media, s.video, { backgroundColor: base.surface }]}>
              <Text style={[s.meta, { color: base.muted }]}>This photo could not be loaded.</Text>
            </View>
          )}

          {notice ? <Text style={[s.notice, { color: base.ink }]}>{notice}</Text> : null}

          {mine ? (
            <>
              <Text style={[s.section, { color: base.muted }]}>WHO CAN SEE THIS</Text>
              <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
                {VISIBILITIES.map((v, i) => (
                  <Pressable
                    key={v}
                    onPress={() => void onVisibility(v)}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen === v }}
                    accessibilityLabel={VISIBILITY_LABEL[v]}
                    style={[
                      s.row,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: base.line,
                      },
                    ]}
                  >
                    <Text style={[s.rowTitle, { color: base.ink }]}>{VISIBILITY_LABEL[v]}</Text>
                    {chosen === v ? <Check size={18} color={base.good} /> : null}
                  </Pressable>
                ))}
              </View>
              <Text style={[s.meta, { color: base.muted, marginTop: 8 }]}>
                Everyone at this game means it can appear under From fans at this game, and only
                while your account is public.
              </Text>
              <Pressable
                onPress={onDelete}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Delete"
                style={[s.action, { backgroundColor: base.card, borderColor: base.line }]}
              >
                <Text style={[s.actionLabel, { color: base.bad }]}>Delete</Text>
              </Pressable>
            </>
          ) : (
            <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
              <Pressable
                onPress={onReport}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Report this"
                style={s.row}
              >
                <Text style={[s.rowTitle, { color: base.ink }]}>Report this</Text>
              </Pressable>
              <Pressable
                onPress={onBlock}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Block this person"
                style={[
                  s.row,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: base.line },
                ]}
              >
                <Text style={[s.rowTitle, { color: base.bad }]}>Block this person</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  video: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  videoLabel: { fontSize: 17, fontFamily: fontFamily({ weight: 700 }) },
  meta: { fontSize: 12.5, lineHeight: 12.5 * 1.4, fontFamily: fontFamily() },
  notice: { fontSize: 13.5, marginTop: 12, fontFamily: fontFamily({ weight: 700 }) },
  section: {
    fontSize: 11.5,
    letterSpacing: 0.8,
    fontFamily: fontFamily({ weight: 700 }),
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowTitle: { fontSize: 15, fontFamily: fontFamily({ weight: 700 }) },
  action: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  actionLabel: { fontSize: 15, fontFamily: fontFamily({ weight: 700 }) },
});
