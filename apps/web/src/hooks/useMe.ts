import { useEffect, useState } from 'react';
import { api } from '../api.js';
import type { MeResponse } from '@rpow/shared';

export function useMe(): { me: MeResponse | null; loading: boolean; refresh: () => Promise<void> } {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try { setMe(await api.me()); } catch { setMe(null); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  return { me, loading, refresh };
}
