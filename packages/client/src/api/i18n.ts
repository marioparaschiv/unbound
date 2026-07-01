import { createLogger } from '@unbound-app/logger';

import { Dispatcher, i18n as Discord } from '~/api/metro/common';
import { DEV, I18N_BASE_URL } from '~/lib/constants';
import { findByName } from '~/api/metro';
import { getStore } from '~/api/storage';
import fs from '~/api/fs';

type LocaleStrings = Record<string, string>;
type StringStore = Record<string, LocaleStrings>;
type FormatVars = Record<string, unknown>;
type I18nLoadSuccess = { locale: string };

type Localizations = {
	Messages: Record<string, string>;
	format: (key: string, vars?: FormatVars) => string;
};

let currentLocale: string | null = null;

const strings: StringStore = {};
const storage = getStore('unbound::i18n');
const logger = createLogger('i18n');

let MessageFormat: any;

/**
 * @description Resolves and memoises the `MessageFormat` constructor. Uses `findByName` (which unwraps
 * the module's default export) because the value is used with `new`; a lazy proxy cannot be constructed.
 * @returns The `MessageFormat` constructor.
 */
function getMessageFormat() {
	MessageFormat ??= findByName('MessageFormat');
	return MessageFormat;
}

const subscriptions: Array<() => void> = [];

/**
 * @description Builds a `Messages` proxy over a string store, resolving each key against the active locale, then en-US, then the key itself.
 * @param store The string store to read translations from.
 * @param getLocale Returns the currently active locale, shared across every proxy.
 * @returns A proxy whose property accesses resolve to localized strings.
 */
function createMessages(store: StringStore, getLocale: () => string | null) {
	return new Proxy(
		{},
		{
			get(_, key: string) {
				const locale = getLocale();

				if (locale && store[locale]?.[key] !== void 0) {
					return store[locale][key];
				}

				return store['en-US']?.[key] ?? key;
			},
		},
	) as Record<string, string>;
}

/**
 * @description Loads a locale's string table into the core store. In dev builds it always fetches fresh from the dev server, bypassing the disk + ETag cache so local edits show on every reload; in production it reads any cached copy first, then revalidates against the source via ETag.
 * @param locale The Discord locale code to ensure is loaded.
 * @returns A promise that resolves once the cache read and revalidation attempt complete. Never throws.
 */
async function ensureLocale(locale: string): Promise<void> {
	if (DEV) {
		try {
			const res = await fetch(`${I18N_BASE_URL}/${locale}.json`);
			if (!res.ok) return;

			strings[locale] = await res.json();
		} catch (error) {
			logger.error(`Failed to fetch locale ${locale}:`, error);
		}

		return;
	}

	const path = `Unbound/i18n/${locale}.json`;

	if (await fs.exists(path)) {
		try {
			strings[locale] = JSON.parse(await fs.read(path));
		} catch (error) {
			logger.error(`Failed to parse cached locale ${locale}:`, error);
		}
	}

	try {
		const etags = storage.get<LocaleStrings>('etags', {});
		const headers: Record<string, string> = {};

		if (etags[locale]) {
			headers['If-None-Match'] = etags[locale];
		}

		const res = await fetch(`${I18N_BASE_URL}/${locale}.json`, { headers });

		if (res.status === 304) return;
		if (!res.ok) return;

		const text = await res.text();
		strings[locale] = JSON.parse(text);

		await fs.write(path, text);

		const etag = res.headers.get('etag');
		if (etag) storage.set('etags', { ...etags, [locale]: etag });
	} catch (error) {
		logger.error(`Failed to fetch locale ${locale}:`, error);
	}
}

/** The core `Messages` proxy, resolving Unbound's own UI strings against the active Discord locale. */
export const Messages = createMessages(strings, () => currentLocale);

/**
 * @description Formats a localized string, interpolating ICU `MessageFormat` placeholders.
 * @param key The message key to resolve and format.
 * @param vars The variables to interpolate into the message.
 * @returns The formatted string.
 */
export function format(key: string, vars?: FormatVars): string {
	const MessageFormat = getMessageFormat();
	return new MessageFormat(Messages[key]).format(vars);
}

/**
 * @description Creates an isolated, in-memory `Messages`/`format` pair over an addon-supplied string table, sharing the active locale with core.
 * @param table The addon's string store, keyed by locale then message key.
 * @returns A `Messages` proxy and `format` function scoped to the supplied table.
 */
export function defineLocalizations(table: StringStore): Localizations {
	const Messages = createMessages(table, () => currentLocale);

	function format(key: string, vars?: FormatVars): string {
		const MessageFormat = getMessageFormat();
		return new MessageFormat(Messages[key]).format(vars);
	}

	return { Messages, format };
}

/**
 * @description Loads the fallback and active locales, then subscribes to Discord locale changes. Fire-and-forget; never blocks startup. Twin of {@link destroy}.
 * @returns A promise that resolves once the initial locales have been ensured and the subscription is wired.
 */
export async function init(): Promise<void> {
	const locale = Discord.intl?.currentLocale ?? Discord.getSystemLocale?.() ?? null;

	await ensureLocale('en-US');

	if (locale && locale !== 'en-US') {
		await ensureLocale(locale);
		currentLocale = locale;
	} else {
		currentLocale = 'en-US';
	}

	async function handler({ locale }: I18nLoadSuccess) {
		if (!locale) return;

		await ensureLocale(locale);
		currentLocale = locale;
	}

	Dispatcher.subscribe('I18N_LOAD_SUCCESS', handler);
	subscriptions.push(() => Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', handler));
}

/**
 * @description Drains every active locale-change subscription. Idempotent. Twin of {@link init}.
 */
export function destroy() {
	subscriptions.splice(0).map((unsubscribe) => unsubscribe());
}

export default { Messages, format, defineLocalizations, init, destroy };
