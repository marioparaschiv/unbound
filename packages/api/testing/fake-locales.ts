import { useSyncExternalStore } from 'react';

import { SOURCE_LOCALE } from '../src/_conventions/addon-locales';
import { formatIcu, type IcuVars } from './icu-format';

/** One locale's messages, keyed by message key, as a plugin's `i18n/<code>.json` holds them. */
export type LocaleTable = Record<string, string>;

/** The fake `@unbound-app/i18n`, over a plugin's real tables, and the locale a test switches with `setLocale`. */
export type FakeLocales = {
	/** Each message in the active locale, falling back to en-US, then the key itself. */
	messages: LocaleTable;
	/** Formats a message in the active locale with a real ICU formatter. */
	format: (key: string, vars?: IcuVars) => string;
	/** Re-renders the component when the locale changes, and returns the active locale code. */
	useMessages: () => string;
	/** Every locale the plugin ships, en-US first. */
	codes: string[];
	/** The active locale code. */
	locale: () => string;
	/** Switches the active locale and re-renders every component that called `useMessages`. */
	setLocale: (code: string) => void;
};

/**
 * @description Creates a plugin's messages over its `i18n/` tables, as the client's `createAddonLocales` serves them.
 * @param tables Each locale's messages by code; en-US is required.
 * @returns The locales.
 */
export function createFakeLocales(tables: Map<string, LocaleTable>): FakeLocales {
	const fallback = tables.get(SOURCE_LOCALE);

	if (!fallback) {
		throw new Error(
			`Failed to load the plugin's locales: i18n/${SOURCE_LOCALE}.json is missing.`,
		);
	}

	const listeners = new Set<() => void>();
	let active = SOURCE_LOCALE;
	let version = 0;

	const messages = new Proxy<LocaleTable>(
		{},
		{
			get(_, key) {
				if (typeof key !== 'string') return;

				return tables.get(active)?.[key] ?? fallback[key] ?? key;
			},
		},
	);

	function subscribe(listener: () => void) {
		listeners.add(listener);

		return () => void listeners.delete(listener);
	}

	return {
		messages,
		format: (key, vars) => formatIcu(messages[key] ?? key, vars, active),
		useMessages() {
			// The version, not the locale, is the snapshot, as on device: a table load keeps the locale but re-renders.
			useSyncExternalStore(subscribe, () => version);

			return active;
		},
		codes: [
			SOURCE_LOCALE,
			...[...tables.keys()].filter((code) => code !== SOURCE_LOCALE).sort(),
		],
		locale: () => active,
		setLocale(code) {
			if (code === active) return;

			active = code;
			version++;

			for (const listener of listeners) listener();
		},
	};
}
