import { AccessibilityInfo, Platform, type HostInstance } from 'react-native';

/**
 * Pose le lecteur d'écran (VoiceOver, TalkBack) sur un élément : le titre d'une feuille qui s'ouvre, le premier
 * élément d'un menu. Dans le navigateur (l'aperçu web), React Native Web ne sait pas le faire : rien ne se passe.
 */
export function poserLeLecteurSur(element: HostInstance | null | undefined): void {
  if (!element || Platform.OS === 'web') return;
  AccessibilityInfo.sendAccessibilityEvent(element, 'focus');
}
