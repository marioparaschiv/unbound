import { isEmpty, debounce } from '@utilities';
import EventEmitter from '@structures/emitter';

const { DCDFileManager } = ReactNative.NativeModules;
const Events = new EventEmitter();

export const settings = globalThis.ENMITY_SETTINGS ?? {};

export const on = Events.on.bind(Events);
export const off = Events.off.bind(Events);

export function get(store: string, key: string, def: any) {
  return settings[store]?.[key] ?? def;
}

export function set(store: string, key: string, value: any) {
  settings[store] ??= {};
  settings[store][key] = value;

  Events.emit('changed', { store, key, value });
  Events.emit('set', { store, key, value });
}

export function toggle(store: string, key: string, def: any) {
  settings[store] ??= {};

  const prev = settings[store][key] ?? def;
  settings[store][key] = !prev;

  Events.emit('changed', { store, key, value: !prev });
  Events.emit('toggled', { store, key, prev, value: !prev });
}

export function remove(store: string, key: string) {
  delete settings[store][key];

  if (isEmpty(settings[store])) {
    delete settings[store];
  }

  Events.emit('changed', { store, key, value: undefined });
  Events.emit('removed', { store, key });
}

export function getStore(store: string) {
  return {
    set: (key: string, value: any) => set(store, key, value),
    get: (key: string, def: any) => get(store, key, def),
    toggle: (key: string, def: any) => toggle(store, key, def),
    remove: (key: string) => remove(store, key),
    useSettingsStore: () => useSettingsStore(store)
  };
}

export function useSettingsStore(store: string) {
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

  return getStore(store);
}

Events.on('changed', debounce(() => {
  const payload = JSON.stringify(settings);
  const path = 'Enmity/settings.json';

  DCDFileManager.writeFile('documents', path, payload, 'utf8');
}, 250));

export default { useSettingsStore, getStore, get, set, remove, on, off };