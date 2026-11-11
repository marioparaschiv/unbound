import { createLogger } from '@unbound-app/logger';
import { useSyncExternalStore } from 'react';

import type { FormatVars, LocaleStrings } from '~/i18n/locale-strings';
import { parseLocaleStrings } from '~/i18n/locale-strings';
import { getLocale, onLocaleChange } from '~/i18n/locale';

/** Formats one message read from a messages proxy, as `~/i18n/message-format`'s `formatWith` does. */
export type MessageFormatter = (messages: LocaleStrings, key: string, vars?: FormatVars) => string;

/** Where an addon's translations live: the codes its manifest lists, and how to read one. */
export type LocaleSource = {
	/** The addon's id, named in errors. */
	owner: string;
	/** Every locale the addon ships beside its bundle, en-US aside. */
	codes: readonly string[];
	/** Reads one locale's JSON, such as from `<addon folder>/i18n/<code>.json`. */
	read: (code: string) => Promise<string>;
};

/** An addon's `messages`, `format` and `useMessages`, over en-US and at most one other locale. */
export type AddonLocales = {
	/** Each message in the active locale, falling back to en-US, then the key itself. */
	messages: LocaleStrings;
	/** Formats a message in the active locale, filling its placeholders from `vars`. */
	format: (key: string, vars?: FormatVars) => string;
	/**
	 * Re-renders the component when the locale changes or its table loads. Returns the active locale code,
	 * a dependency for `useMemo` and `useCallback` over strings.
	 */
	useMessages: () => string;
	/** The en-US messages inlined in the bundle. */
	source: Readonly<LocaleStrings>;
	/** Calls the listener when the locale changes or its table loads; returns the remover. */
	subscribe: (listener: () => void) => () => void;
	/** The locales held in memory: en-US, and the active one once it loaded. */
	loadedLocales: () => string[];
	/** Stops following locale changes and drops the loaded table. */
	dispose: () => void;
};

type LoadedLocale = {
	code: string;
	strings: LocaleStrings | undefined;
};

/**
 * @description Creates an addon's messages over its bundled en-US table. The active locale's table is read
 * on the first string read in that locale, and a locale change drops it and reads the new one.
 * @param fallback The en-US messages, inlined in the bundle.
 * @param source The addon's other locales.
 * @param formatWith Formats a message, injected so this module stays clear of metro.
 * @returns The messages, `format`, a re-rendering hook, and `dispose`.
 */
export function createAddonLocales(
	fallback: LocaleStrings,
	source: LocaleSource,
	formatWith: MessageFormatter,
): AddonLocales {
	const logger = createLogger('i18n', source.owner);
	const listeners = new Set<() => void>();
	let active: LoadedLocale | undefined;
	let touched = false;
	let version = 0;

	function notify() {
		version++;

		for (const listener of listeners) listener();
	}

	function load(code: string): LoadedLocale {
		const entry: LoadedLocale = { code, strings: undefined };

		source
			.read(code)
			.then((text) => {
				if (active !== entry) return;

				entry.strings = parseLocaleStrings(text);
				notify();
			})
			.catch((error) =>
				logger.error(`Failed to load locale ${code} for ${source.owner}:`, error),
			);

		return entry;
	}

	function tableFor(locale: string | null): LocaleStrings | undefined {
		if (!locale || !source.codes.includes(locale)) return;

		if (active?.code !== locale) {
			active = load(locale);
		}

		return active.strings;
	}

	const messages = new Proxy<LocaleStrings>(
		{},
		{
			get(_, key) {
				if (typeof key !== 'string') return;

				touched = true;

				return tableFor(getLocale())?.[key] ?? fallback[key] ?? key;
			},
		},
	);

	// Only mounted components need telling. A read with none mounted asks `tableFor` for the current locale,
	// which drops the previous table and loads the new one.
	function handleLocaleChange(locale: string) {
		if (active?.code !== locale) {
			active = void 0;
		}

		if (touched) {
			tableFor(locale);
		}

		notify();
	}

	let stopFollowing: (() => void) | undefined;

	function unfollow() {
		stopFollowing?.();
		stopFollowing = void 0;
	}

	// `useSyncExternalStore` subscribes once per mounted component; the first follows locale changes, the last stops.
	function subscribe(listener: () => void) {
		listeners.add(listener);
		stopFollowing ??= onLocaleChange(handleLocaleChange);

		return () => {
			if (!listeners.delete(listener) || listeners.size) return;

			unfollow();
		};
	}

	return {
		messages,
		source: fallback,
		subscribe,
		format: (key, vars) => formatWith(messages, key, vars),
		useMessages() {
			// The version, not the locale, is the snapshot: a table load keeps the locale but must re-render.
			useSyncExternalStore(subscribe, () => version);

			return getLocale() ?? 'en-US';
		},
		loadedLocales: () => (active?.strings ? ['en-US', active.code] : ['en-US']),
		dispose() {
			unfollow();
			listeners.clear();
			active = void 0;
		},
	};
}
