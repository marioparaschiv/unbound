import type { PredicateResult } from '@unbound-app/types/global';
import debounce from '@unbound-app/utils/debounce';
import isEmpty from '@unbound-app/utils/is-empty';
import { useEffect, useState } from 'react';
import { EventEmitter } from 'tseep';

import fs from '~/api/fs';

export interface SettingsPayload {
	store: string;
	key: string | null;
	value: any;
}

type EventMap = {
	set: (payload: { store: string; key: string; value: any }) => void;
	changed: (payload: SettingsPayload) => void;
	cleared: (payload: { store: string }) => void;
	removed: (payload: { store: string; key: string }) => void;
	toggled: (payload: { store: string; key: string; prev: any; value: any }) => void;
};

const Events = new EventEmitter<EventMap>();

export const settings = globalThis.UNBOUND_SETTINGS ?? {};

export const on = Events.on.bind(Events);
export const off = Events.off.bind(Events);

export function addListener(
	predicate: (payload: SettingsPayload) => PredicateResult,
	callback: (payload: SettingsPayload) => void,
) {
	function handler(payload: SettingsPayload) {
		if (predicate(payload)) {
			callback(payload);
		}
	}

	Events.on('changed', handler);

	return () => Events.off('changed', handler);
}

export function removeListener(callback: (payload: SettingsPayload) => void) {
	Events.off('changed', callback);
}

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
	const data = { current: (settings[store] ??= {}), changed: false };

	for (let i = 0; keys.length > i; i++) {
		data.current[keys[i]] ??= {};

		if (keys.length - 1 === i) {
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
	Events.emit('cleared', { store });
}

export function getStore(store: string) {
	return {
		set: (key: string, value: any) => set(store, key, value),
		get: <T extends any>(key: string, def: T): T & {} => get(store, key, def),
		toggle: (key: string, def: any) => toggle(store, key, def),
		remove: (key: string) => remove(store, key),
		clear: () => clear(store),
		useSettingsStore: (predicate?: (payload: SettingsPayload) => PredicateResult) =>
			useSettingsStore(store, predicate),
		addListener: (
			predicate: (payload: SettingsPayload) => PredicateResult,
			callback: (payload: SettingsPayload) => void,
		) => {
			function handler(payload: SettingsPayload) {
				if (payload.store !== store) return;
				if (predicate(payload)) {
					callback(payload);
				}
			}

			Events.on('changed', handler);

			return () => Events.off('changed', handler);
		},
	};
}

export function useSettingsStore(
	store: string,
	predicate?: (payload: SettingsPayload) => PredicateResult,
) {
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

export async function persist() {
	const payload = JSON.stringify(settings, null, 2);
	await fs.write('Unbound/settings.json', payload);
}

Events.on('changed', debounce(persist, 100));

export default {
	addListener,
	get,
	getStore,
	off,
	on,
	persist,
	remove,
	removeListener,
	set,
	useSettingsStore,
};
