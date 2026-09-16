/**
 * Screenshot / PDF import pipeline (SPEC.md 7.2): upload to the private bucket, insert the
 * ticket_imports row, then ask parse-ticket to read and match it.
 */
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedFile = { uri: string; name: string; mimeType: string };

export type ImportStep = 'queued' | 'uploading' | 'parsing' | 'done' | 'error';

export type ImportProgress = {
  key: string;
  file: PickedFile;
  step: ImportStep;
  importId: string | null;
  storagePath: string | null;
  /** Import status reported by parse-ticket once done. */
  result: string | null;
  error: string | null;
};

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function extensionFor(file: PickedFile): string {
  const fromMime = EXT_BY_MIME[file.mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

export function normalizeMime(file: PickedFile): string {
  const ext = extensionFor(file);
  const entry = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext);
  return entry?.[0] ?? file.mimeType;
}

export async function pickImages(): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    quality: 0.9,
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets.map((a, i) => ({
    uri: a.uri,
    name: a.fileName ?? `ticket-${i + 1}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  }));
}

export async function pickPdfs(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  return res.assets.map((a, i) => ({
    uri: a.uri,
    name: a.name ?? `ticket-${i + 1}.pdf`,
    mimeType: a.mimeType ?? 'application/pdf',
  }));
}

export async function uploadTicketFile(userId: string, file: PickedFile): Promise<string> {
  const path = `${userId}/${Crypto.randomUUID()}.${extensionFor(file)}`;
  const bytes = await new File(file.uri).arrayBuffer();
  const { error } = await supabase.storage
    .from('ticket-imports')
    .upload(path, bytes, { contentType: normalizeMime(file), upsert: false });
  if (error) throw error;
  return path;
}

export async function createImportRow(userId: string, storagePath: string): Promise<string> {
  const { data, error } = await supabase
    .from('ticket_imports')
    .insert({ user_id: userId, source: 'screenshot', storage_path: storagePath, status: 'pending' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export type ParseResponse = {
  import_id: string;
  status?: string;
  tickets?: number;
  results?: { import_id: string; status: string }[];
  error?: string;
  detail?: string;
};

export async function parseImport(importId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<ParseResponse>('parse-ticket', {
    body: { import_id: importId },
  });
  if (error) {
    // supabase-js wraps non-2xx responses; surface the function's own message when it has one.
    const ctx = (error as { context?: Response }).context;
    let detail: string | null = null;
    try {
      const body = ctx ? ((await ctx.json()) as ParseResponse) : null;
      detail = body?.detail ?? body?.error ?? null;
    } catch {
      detail = null;
    }
    throw new Error(
      detail ? `Could not read this ticket (${detail})` : 'Could not read this ticket.',
    );
  }
  if (!data) throw new Error('Could not read this ticket.');
  if (data.error) throw new Error(data.error);
  if (data.status === 'failed') return 'failed';
  return data.results?.[0]?.status ?? data.status ?? 'parsed';
}
