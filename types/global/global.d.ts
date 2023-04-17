import { Manifest } from '@typings/managers';

interface Addon {
  contents: string;
  path: string;
}

declare global {
  const modules: { [id: number]: any; };
  const __r: {
    importAll: Fn;
  } & ((id: number) => void);

  var React: typeof import('react');
  var ReactNative: typeof import('react-native');
  var nativeLoggingHook: Fn;


  interface Window {
    enmity: typeof import('@api') & { version: string; };
    loader: {
      type: string;
      version: string;
    };

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