import { Manifest } from '@typings/managers';

interface Addon {
  contents: string;
  path: string;
}

declare global {
  const modules: { [id: number]: any; };
  const nativeLoggingHook: Fn;
  const __r: {
    importAll: Fn;
  } & ((id: number) => void);

  var React: typeof import('react');
  var ReactNative: typeof import('react-native');
  var Chroma: typeof import('chroma-js');

  interface Window {
    enmity: typeof import('@api');

    ENMITY_DEV_IP: string;
    ENMITY_SETTINGS: Addon[];
    ENMITY_PLUGINS: {
      manifest: Manifest,
      bundle: string;
    }[];

    ENMITY_THEMES: {
      manifest: Manifest,
      bundle: string;
    }[];
  }
}

export { };