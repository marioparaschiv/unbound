import { EventEmitter, React, ReactNative } from '@metro/common';
import { debounce, isEmpty } from './utilities';

const Events = new EventEmitter();

const { DCDFileManager } = ReactNative.NativeModules;
const { Platform } = ReactNative;

const makePath: (file: string) => string = Platform.select({
  ios: file => 'Documents' + '/' + 'Enmity' + '/' + file,
  default: file => 'Enmity' + '/' + file
});

export const listeners = {};
export const settings = globalThis.ENMITY_SETTINGS ?? {};

export function get(store: string, key: string, def: any) {
  return settings[store]?.[key] ?? def;
}

export function set(store: string, key: string, value: any) {
  settings[store] ??= {};
  settings[store][key] = value;

  Events.emit('changed', { store, key, value });
}

export function remove(store: string, key: string) {
  delete settings[store][key];

  if (isEmpty(settings[store])) {
    delete settings[store];
  }

  Events.emit('changed', { store, key });
}

export function makeStore(store: string) {
  return {
    set: (key: string, value: any) => set(store, key, value),
    get: (key: string, def: any) => get(store, key, def),
    remove: (key: string) => remove(store, key),
    useStore: () => useStore(store)
  };
}

export function useStore(store: string) {
  const [, forceUpdate] = React.useState({});

  React.useEffect(() => {
    function handler(payload) {
      if (payload.store !== store) {
        return;
      }

      forceUpdate({});
    }

    Events.on('changed', handler);

    return () => void Events.off('changed', handler);
  }, []);

  return;
}

async function onChange() {
  DCDFileManager.writeFile('documents', makePath('settings.json'), JSON.stringify(settings), 'utf8');
  // ReactNative.Settings.set({ enmity: JSON.stringify(settings) });
}

Events.on('changed', debounce(onChange, 250));