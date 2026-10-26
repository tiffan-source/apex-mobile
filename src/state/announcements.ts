import { useSyncExternalStore } from 'react';
import type { AnnouncementCenter } from '@/application/announcements/announcement-center';
import { useServices } from './services';

/** Le signalement en cours (une note d'Akari dans l'écran), et de quoi le lire. */
export function useReport(): { readonly report: string | null; readonly acknowledge: () => void } {
  const { announcements } = useServices();
  const report = useSyncExternalStore(announcements.report$.subscribe, () => announcements.report$.get());
  return { report, acknowledge: () => announcements.acknowledge() };
}

/** Annoncer une réussite, signaler un souci. */
export function useAnnouncements(): AnnouncementCenter {
  return useServices().announcements;
}
