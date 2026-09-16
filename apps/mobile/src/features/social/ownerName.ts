import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** Display name (falling back to handle) for a user id; null while loading or when hidden. */
export function useProfileByIdName(userId: string | undefined): string | null {
  const q = useQuery({
    queryKey: ['social', 'nameById', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('handle, display_name')
        .eq('id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? data.display_name?.trim() || `@${data.handle}` : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  return q.data ?? null;
}
