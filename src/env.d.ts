/// <reference types="expo/types" />

// Les variables publiques d'Expo, inscrites dans le code à la construction (`.env`, profil EAS).
declare namespace NodeJS {
  interface ProcessEnv {
    /** L'adresse d'Apex Brain : `https://…`, sans barre finale. */
    readonly EXPO_PUBLIC_APEX_API_URL?: string;
  }
}
