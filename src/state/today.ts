import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isSameDay, msUntilMidnight } from '@/domain/shared/dates';

/**
 * Le jour courant (« Lundi 19 octobre »), qui change à minuit, même si l'application reste ouverte, et au
 * retour au premier plan. La date rendue ne change qu'avec le jour : elle peut servir de dépendance.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const check = () => setToday((current) => (isSameDay(current, new Date()) ? current : new Date()));
    const timer = setTimeout(check, msUntilMidnight(today) + 1000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
