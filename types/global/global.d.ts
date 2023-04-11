import { Manifest } from '@typings/managers';

interface Addon {
  contents: string;
  path: string;
}

declare global {
  interface Window {
    modules: { [id: number]: any; };
    nativeLoggingHook: Fn;
    __r: {
      importAll: Fn;
    } & ((id: number) => void);

    React: typeof import('react');
    ReactNative: typeof import('react-native');
    Chroma: typeof import('chroma-js');

    enmity: typeof import('@api');

    ENMITY_DEV_IP: string;
    ENMITY_SETTINGS: Addon[];
    ENMITY_PLUGINS: {
      manifest: Manifest,
      bundle: string;
    }[];

    ENMITY_THEMES: {
      applied: Record<any, any>;
      list: Record<any, any>[];
    };
  }
}

export { };