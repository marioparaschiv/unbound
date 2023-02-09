declare global {
  const __r: {
    importAll: Fn;
  } & ((id: number) => void);
  const modules: { [id: number]: any; };

  var enmity: typeof import('@api');
  var nativeLoggingHook: Fn;
  var ENMITY_DEV_IP: String;
}

import './modules';

export { };