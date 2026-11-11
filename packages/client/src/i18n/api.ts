import { createLogger } from '@unbound-app/logger';
import enUS from '@i18n/en-US.json';

import { i18n as Discord, Moment } from '~/metro/common';
import { I18N_BASE_URL } from '~/core/constants';
import { onModuleLoaded } from '~/metro/wait';
import { Dispatcher } from '~/flux/modules';
import { byProps } from '~/metro/filters';
import { getBucket } from '~/storage/api';
import fs from '~/native/fs';

import type { AddonLocales, LocaleSource } from './addon-locales';
import type { FormatVars, LocaleStrings } from './locale-strings';

import createMomentCalendarLocale from './create-moment-calendar-locale';
import createMomentLocaleDefiner from './create-moment-locale-definer';
import createMomentLocaleSetter from './create-moment-locale-setter';
import resolveMomentLocale from './resolve-moment-locale';
import { parseLocaleStrings } from './locale-strings';
import { createAddonLocales } from './addon-locales';
import { getLocale, setLocale } from './locale';
import { formatWith } from './message-format';

/** A string table: each locale code, such as `en-US`, mapped to its messages. */
type StringStore = Record<string, LocaleStrings>;
type I18nLoadSuccess = { locale: string };

// UNKNOWN: Moment comes untyped from Discord's bundle.
type MomentMethod = (this: unknown, ...args: unknown[]) => unknown;

const strings: StringStore = { 'en-US': enUS };
const storage = getBucket('unbound::i18n');
const logger = createLogger('i18n');
let previousMomentLocale: string | null = null;
let originalMomentLocaleSetter: MomentMethod | null = null;
let wrappedMomentLocaleSetter: MomentMethod | null = null;
let originalMomentInstanceLocaleSetter: MomentMethod | null = null;
let wrappedMomentInstanceLocaleSetter: MomentMethod | null = null;
let originalMomentCalendar: MomentMethod | null = null;
let wrappedMomentCalendar: MomentMethod | null = null;
let originalMomentDefineLocale: MomentMethod | null = null;
let wrappedMomentDefineLocale: MomentMethod | null = null;
// Discord loads Moment when it first shows a date; until then there is no locale to sync.
let momentLoaded = false;

function syncMomentLocale(locale: string): void {
	if (
		!momentLoaded ||
		typeof Moment?.locale !== 'function' ||
		typeof Moment?.locales !== 'function'
	)
		return;

	previousMomentLocale ||= Moment.locale();

	if (!originalMomentLocaleSetter) {
		const localeSetter = Moment.locale;

		originalMomentLocaleSetter = localeSetter;
		wrappedMomentLocaleSetter = createMomentLocaleSetter(
			localeSetter,
			() => getLocale() ?? Discord.intl?.currentLocale ?? locale,
			() => Moment.locales(),
		);
		Moment.locale = wrappedMomentLocaleSetter;

		if (typeof Moment.prototype?.locale === 'function') {
			const instanceLocaleSetter = Moment.prototype.locale;

			originalMomentInstanceLocaleSetter = instanceLocaleSetter;
			wrappedMomentInstanceLocaleSetter = createMomentLocaleSetter(
				instanceLocaleSetter,
				() => getLocale() ?? Discord.intl?.currentLocale ?? locale,
				() => Moment.locales(),
			);
			Moment.prototype.locale = wrappedMomentInstanceLocaleSetter;
		}

		if (typeof Moment.defineLocale === 'function') {
			originalMomentDefineLocale = Moment.defineLocale;
			wrappedMomentDefineLocale = createMomentLocaleDefiner(Moment.defineLocale, () =>
				Reflect.apply(localeSetter, Moment, [
					resolveMomentLocale(
						getLocale() ?? Discord.intl?.currentLocale ?? locale,
						Moment.locales(),
					),
				]),
			);
			Moment.defineLocale = wrappedMomentDefineLocale;
		}

		const calendar = Moment.prototype?.calendar;
		const instanceLocale = Moment.prototype?.locale;

		if (typeof calendar === 'function' && typeof instanceLocale === 'function') {
			originalMomentCalendar = calendar;
			wrappedMomentCalendar = createMomentCalendarLocale(
				calendar,
				() => getLocale() ?? Discord.intl?.currentLocale ?? locale,
				() => Moment.locales(),
				instanceLocale,
			);
			Moment.prototype.calendar = wrappedMomentCalendar;
		}
	}

	Moment.locale(resolveMomentLocale(locale, Moment.locales()));
}

const subscriptions: Array<() => void> = [];

/**
 * @description Builds a `Messages` proxy over a string store, resolving each key against the active locale, then en-US, then the bundled strings, then the key itself.
 * @param store The string store to read translations from.
 * @param getLocale Returns the currently active locale, shared across every proxy.
 * @param bundled Strings shipped in the bundle, for keys a fetched locale does not have yet.
 * @returns A proxy whose property accesses resolve to localized strings.
 */
function createMessages(
	store: StringStore,
	getLocale: () => string | null,
	bundled: LocaleStrings = {},
) {
	return new Proxy(
		{},
		{
			get(_, key: string) {
				const locale = getLocale();

				if (locale && store[locale]?.[key] !== void 0) {
					return store[locale][key];
				}

				return store['en-US']?.[key] ?? bundled[key] ?? key;
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
	if (import.meta.env.DEV) {
		try {
			const res = await fetch(`${I18N_BASE_URL}/${locale}.json`);

			if (!res.ok) return;

			strings[locale] = parseLocaleStrings(await res.text());
		} catch (error) {
			logger.error(`Failed to fetch locale ${locale}:`, error);
		}

		return;
	}

	const path = `Unbound/i18n/${locale}.json`;

	if (await fs.exists(path)) {
		try {
			strings[locale] = parseLocaleStrings(await fs.readFile(path));
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

		strings[locale] = parseLocaleStrings(text);

		await fs.writeFile(path, text);

		const etag = res.headers.get('etag');

		if (etag) {
			storage.set('etags', { ...etags, [locale]: etag });
		}
	} catch (error) {
		logger.error(`Failed to fetch locale ${locale}:`, error);
	}
}

/** The core messages proxy, resolving Unbound's own UI strings against the active Discord locale. */
export const messages = createMessages(strings, getLocale, enUS);

/**
 * @description Formats a localized string, interpolating ICU `MessageFormat` placeholders.
 * @param key The message key to resolve and format.
 * @param vars The variables to interpolate into the message.
 * @returns The formatted string.
 */
export function format(key: string, vars?: FormatVars): string {
	return formatWith(messages, key, vars);
}

/**
 * @description Creates a plugin's messages over its bundled en-US table, reading its other locales from its folder.
 * A plugin's scope supplies `source`; plugins import their `i18n/` folder, which `ubd build` turns into a module, instead.
 * @param fallback The plugin's en-US messages.
 * @param source The plugin's locales and how to read them; only a plugin's scope has one.
 * @returns The plugin's messages, `format`, `useMessages` and `dispose`.
 * @internal
 */
export function createLocales(fallback: LocaleStrings, source?: LocaleSource): AddonLocales {
	if (!source) {
		throw new Error(
			'i18n.createLocales runs only inside a plugin, which imports its i18n/ folder.',
		);
	}

	return createAddonLocales(fallback, source, formatWith);
}

/**
 * @description Loads the locales once Discord's localisation module loads, so startup never initializes it early. Twin of {@link destroy}.
 * @internal
 */
export function init() {
	let active = true;

	subscriptions.push(
		onModuleLoaded(byProps('getLanguages', 'getSystemLocale', 'intl'), () => {
			// This runs inside the module's factory, before its importer has it, so load after the factory returns.
			queueMicrotask(() => {
				if (active) {
					void load();
				}
			});
		}),
		() => {
			active = false;
		},
	);
}

// Loads the fallback and active locales, then subscribes to Discord locale changes.
async function load() {
	const locale = Discord.intl?.currentLocale ?? Discord.getSystemLocale?.() ?? null;
	const initialLocale = locale ?? 'en-US';

	setLocale(initialLocale);
	subscriptions.push(
		onModuleLoaded(byProps('isMoment'), () => {
			momentLoaded = true;
			syncMomentLocale(getLocale() ?? initialLocale);
		}),
	);

	async function handler({ locale }: I18nLoadSuccess) {
		if (!locale) return;

		const activeLocale = Discord.intl?.currentLocale ?? locale;

		syncMomentLocale(activeLocale);
		await ensureLocale(activeLocale);
		// Listeners such as the commands re-read strings, so they hear of a change once its table has loaded.
		setLocale(activeLocale);
	}

	Dispatcher.subscribe('I18N_LOAD_SUCCESS', handler);
	subscriptions.push(() => Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', handler));

	await ensureLocale('en-US');

	const activeLocale = Discord.intl?.currentLocale ?? getLocale() ?? 'en-US';

	if (activeLocale !== 'en-US') {
		await ensureLocale(activeLocale);
	}

	setLocale(activeLocale);
	syncMomentLocale(activeLocale);
}

/**
 * @description Drains every active locale-change subscription. Idempotent. Twin of {@link init}.
 * @internal
 */
export function destroy() {
	subscriptions.splice(0).map((unsubscribe) => unsubscribe());

	if (
		originalMomentLocaleSetter &&
		wrappedMomentLocaleSetter &&
		Moment?.locale === wrappedMomentLocaleSetter
	) {
		Moment.locale = originalMomentLocaleSetter;
	}

	if (
		originalMomentInstanceLocaleSetter &&
		wrappedMomentInstanceLocaleSetter &&
		Moment?.prototype?.locale === wrappedMomentInstanceLocaleSetter
	) {
		Moment.prototype.locale = originalMomentInstanceLocaleSetter;
	}

	if (
		originalMomentCalendar &&
		wrappedMomentCalendar &&
		Moment?.prototype?.calendar === wrappedMomentCalendar
	) {
		Moment.prototype.calendar = originalMomentCalendar;
	}

	if (
		originalMomentDefineLocale &&
		wrappedMomentDefineLocale &&
		Moment?.defineLocale === wrappedMomentDefineLocale
	) {
		Moment.defineLocale = originalMomentDefineLocale;
	}

	if (previousMomentLocale && originalMomentLocaleSetter) {
		Reflect.apply(originalMomentLocaleSetter, Moment, [previousMomentLocale]);
	}

	momentLoaded = false;
	previousMomentLocale = null;
	originalMomentLocaleSetter = null;
	wrappedMomentLocaleSetter = null;
	originalMomentInstanceLocaleSetter = null;
	wrappedMomentInstanceLocaleSetter = null;
	originalMomentCalendar = null;
	wrappedMomentCalendar = null;
	originalMomentDefineLocale = null;
	wrappedMomentDefineLocale = null;
}
