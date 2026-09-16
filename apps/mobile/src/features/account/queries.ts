import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';
import { toIsoDate } from '@/lib/format';

/** export_my_data() -> JSON file in the cache directory -> share sheet (SPEC.md 8.9, 9). */
export function useExportData() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      const file = new File(Paths.cache, `jinx-export-${toIsoDate(new Date())}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: 'Your data',
        });
      }
      return file.uri;
    },
  });
}

/**
 * Invokes the delete-account Edge Function with the user's JWT (removes files, then the auth user,
 * which cascades through every table), then signs out locally and drops the cache.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        'delete-account',
        { method: 'POST' },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Could not delete your account. Try again.');
    },
    onSuccess: async () => {
      // The auth user is gone; signOut clears the local session (the server call may 403).
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      queryClient.clear();
    },
  });
}
