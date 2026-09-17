import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/features/auth/store';
import { useInvalidateImports } from '@/features/imports/queries';
import {
  createImportRow,
  parseImport,
  pickImages,
  pickPdfs,
  uploadTicketFile,
  type ImportProgress,
  type PickedFile,
} from '@/features/imports/upload';
import { useTheme } from '@/theme/ThemeProvider';
import { features } from '@/lib/env';

function stepLabel(p: ImportProgress): string {
  switch (p.step) {
    case 'queued':
      return 'Waiting';
    case 'uploading':
      return 'Uploading';
    case 'parsing':
      return 'Reading the ticket';
    case 'done':
      return p.result === 'matched'
        ? 'Game found, ready to confirm'
        : p.result === 'needs_review'
          ? 'A few possible games, needs your pick'
          : p.result === 'failed'
            ? 'No matching game found'
            : 'Done';
    case 'error':
      return p.error ?? 'Something went wrong';
  }
}

export default function ImportScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const invalidate = useInvalidateImports();
  const [items, setItems] = useState<ImportProgress[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const running = useRef(false);

  const patch = (key: string, change: Partial<ImportProgress>) =>
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const runOne = async (p: ImportProgress) => {
    if (!userId) return;
    try {
      let storagePath = p.storagePath;
      if (!storagePath) {
        patch(p.key, { step: 'uploading', error: null });
        storagePath = await uploadTicketFile(userId, p.file);
        patch(p.key, { storagePath });
      }
      let importId = p.importId;
      if (!importId) {
        importId = await createImportRow(userId, storagePath);
        patch(p.key, { importId });
      }
      patch(p.key, { step: 'parsing', error: null });
      const result = await parseImport(importId);
      patch(p.key, { step: 'done', result });
    } catch (e) {
      patch(p.key, { step: 'error', error: errorMessage(e) });
    } finally {
      invalidate();
    }
  };

  const enqueue = async (files: PickedFile[]) => {
    if (!files.length) return;
    const fresh: ImportProgress[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.uri}`,
      file,
      step: 'queued',
      importId: null,
      storagePath: null,
      result: null,
      error: null,
    }));
    setItems((prev) => [...prev, ...fresh]);
    if (running.current) return;
    running.current = true;
    try {
      for (const p of fresh) await runOne(p);
    } finally {
      running.current = false;
    }
  };

  const pick = async (kind: 'images' | 'pdfs') => {
    setPickError(null);
    try {
      const files = kind === 'images' ? await pickImages() : await pickPdfs();
      await enqueue(files);
    } catch (e) {
      setPickError(errorMessage(e));
    }
  };

  const retry = (key: string) => {
    const current = items.find((p) => p.key === key);
    if (!current || running.current) return;
    running.current = true;
    void runOne({ ...current, error: null }).finally(() => {
      running.current = false;
    });
  };

  const busy = items.some(
    (p) => p.step === 'uploading' || p.step === 'parsing' || p.step === 'queued',
  );
  const anyDone = items.some((p) => p.step === 'done');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Upload tickets' }} />
      <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Screenshots or PDFs of tickets, past or upcoming. We read the teams, date, and seat, find
        the game, and ask you to confirm. Only you can ever see the files.
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <Button
          title="Screenshots"
          onPress={() => pick('images')}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <Button
          title="PDFs"
          variant="secondary"
          onPress={() => pick('pdfs')}
          disabled={busy}
          style={{ flex: 1 }}
        />
      </View>
      {pickError ? <Notice tone="error">{pickError}</Notice> : null}

      {items.length ? (
        <Card label={`${items.length} file${items.length === 1 ? '' : 's'}`}>
          {items.map((p, i) => (
            <View
              key={p.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.line,
              }}
            >
              <Ionicons
                name={
                  p.step === 'done'
                    ? p.result === 'failed'
                      ? 'help-circle'
                      : 'checkmark-circle'
                    : p.step === 'error'
                      ? 'alert-circle'
                      : 'ellipse-outline'
                }
                size={20}
                color={
                  p.step === 'error'
                    ? c.red
                    : p.step === 'done' && p.result !== 'failed'
                      ? c.green
                      : c.muted
                }
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.file.name}
                </Text>
                <Text variant="caption" color={p.step === 'error' ? 'red' : 'muted'}>
                  {stepLabel(p)}
                </Text>
              </View>
              {p.step === 'error' ? (
                <Button title="Retry" variant="secondary" small onPress={() => retry(p.key)} />
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {anyDone ? (
        <Button
          title="Review imports"
          onPress={() => router.replace('/games/imports')}
          disabled={busy}
        />
      ) : null}
      {features.forwarding ? (
        <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.md }}>
          Prefer email? Forward ticket confirmations to your forwarding address in Settings.
        </Text>
      ) : null}
    </Screen>
  );
}
