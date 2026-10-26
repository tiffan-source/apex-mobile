import { createContext, useContext, type ReactNode } from 'react';
import type { AppServices } from '@/application/services';

/*
 * Les services de l'application, fournis par la racine de composition (`src/composition`) et lus par les
 * écrans : en test, les mêmes services sur des doublures en mémoire (`src/testing`).
 */

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error('useServices() hors de <ServicesProvider> : la racine de composition manque.');
  return services;
}
