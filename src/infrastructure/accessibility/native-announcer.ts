import { AccessibilityInfo, Platform } from 'react-native';
import type { Announcer } from '@/application/ports/platform';

/**
 * Parle aux lecteurs d'écran sans rien afficher : VoiceOver sur iOS, TalkBack sur Android. Sur iOS, une annonce
 * polie attend la fin de la phrase en cours (`queue`) ; une annonce pressante l'interrompt.
 */
export class NativeAnnouncer implements Announcer {
  announce(text: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: politeness === 'polite' });
      return;
    }
    AccessibilityInfo.announceForAccessibility(text);
  }
}
