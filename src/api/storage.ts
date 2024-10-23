import type { SettingsPayload } from '@typings/api/storage';
import EventEmitter from '@structures/emitter';
import { debounce, isEmpty } from '@utilities';
import { useEffect, useState } from 'react';
import { BundleManager } from '@api/native';
import fs from '@api/fs';


export type * from '@typings/api/storage';

const Events = new EventEmitter();

export const settings = globalThis.UNBOUND_SETTINGS ?? {};
export const data = { isPendingReload: false };

export const on = Events.on.bind(Events);
export const off = Events.off.bind(Events);

export function get<T extends any>(store: string, key: string, def: T): T & {} {
	const keys = key.split('.');
	const data = { result: settings[store] };

	for (const key of keys) {
		if (data.result === void 0 || data.result[key] === void 0) {
			data.result = def;
			break;
		}

		data.result = data.result[key];
	}

	return data.result;
}

export function set(store: string, key: string, value: any) {
	const keys = key.split('.');
	const data = { current: settings[store] ??= {}, changed: false };

	for (let i = 0; keys.length > i; i++) {
		data.current[keys[i]] ??= {};

		if ((keys.length - 1) === i) {
			data.current[keys[i]] = value;
		} else {
			data.current = data.current[keys[i]];
		}
	}

	Events.emit('changed', { store, key, value });
	Events.emit('set', { store, key, value });
}

export function toggle(store: string, key: string, def: any) {
	const prev = get(store, key, def);
	set(store, key, !prev);

	Events.emit('toggled', { store, key, prev, value: !prev });
}

export function remove(store: string, key: string) {
	if (!settings[store][key]) return;

	delete settings[store][key];

	if (isEmpty(settings[store])) {
		delete settings[store];
	}

	Events.emit('changed', { store, key, value: undefined });
	Events.emit('removed', { store, key });
}

export function clear(store: string) {
	if (!settings[store]) return;

	delete settings[store];

	Events.emit('changed', { store, key: null, value: undefined });
	Events.emit('cleared', { store, key: null });
}

export function getStore(store: string) {
	return {
		set: (key: string, value: any) => set(store, key, value),
		get: <T extends any>(key: string, def: T): T & {} => get(store, key, def),
		toggle: (key: string, def: any) => toggle(store, key, def),
		remove: (key: string) => remove(store, key),
		clear: () => clear(store),
		useSettingsStore: (predicate?: (payload: SettingsPayload) => boolean) => useSettingsStore(store, predicate)
	};
}

export function useSettingsStore(store: string, predicate?: (payload: SettingsPayload) => boolean) {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		function handler(payload: SettingsPayload) {
			if (payload.store !== store) return;

			if (!predicate || predicate(payload)) {
				forceUpdate({});
			}
		}

		Events.on('changed', handler);

		return () => void Events.off('changed', handler);
	}, []);


	return {
		set: (key: string, value: any) => set(store, key, value),
		get: <T = any>(key: string, def: NoInfer<T>): T => get(store, key, def),
		toggle: (key: string, def: any) => toggle(store, key, def),
		remove: (key: string) => remove(store, key),
	};
}

Events.on('changed', debounce(() => {
	const payload = JSON.stringify(settings, null, 2);
	const promise = fs.write('Unbound/settings.json', payload);

	promise.then(() => data.isPendingReload && BundleManager.reload());
}, 100));

export default { useSettingsStore, getStore, get, set, remove, on, off };