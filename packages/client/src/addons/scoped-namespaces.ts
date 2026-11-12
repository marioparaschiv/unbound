import type {
	FluxActionInterceptor,
	FluxActionListener,
	FluxChangeListener,
	FluxActionType,
	FluxStore,
} from '@unbound-app/types/flux';
import type { CommandsHandle, CommandsOptions } from '@unbound-app/types/commands';
import type { SettingsEntry, SettingsSchema } from '@unbound-app/types/settings';
import type { AddonLogger } from '@unbound-app/types';
import noop from '@unbound-app/utils/noop';

import type {
	MetroWaitOptions,
	MetroLazySearchOptions,
	MetroModuleLoadListener,
} from '~/metro/types';
import { findOwnedId, registerOwnedAsset, type AssetRegistration } from '~/assets/plugin-assets';
import type { SettingsPayload, SettingsPredicate } from '~/storage/api';
import type { AddonLocales, LocaleSource } from '~/i18n/addon-locales';
import type { MessageResolver } from '~/i18n/message-resolver';
import type { AssetRegistrationListener } from '~/assets/api';
import type { Subscriptions } from '~/addons/subscriptions';
import { createFeedbackDialogs } from '~/dialogs/feedback';
import type { LocaleStrings } from '~/i18n/locale-strings';
import { createFeedbackToasts } from '~/toasts/feedback';
import { createOwnerCommands } from '~/commands/handle';
import type { LocalesGetter } from '~/commands/handle';
import type { MetroFilter } from '~/metro/filters';
import { coreMessages } from '~/i18n/core-lookup';
import type * as api from '~/core/api';

type Api = Omit<typeof api, 'default'>;

type Overlay<K extends keyof Api, O> = Omit<O, keyof Api[K]> & Api[K];

type ChangeCallback = (payload: SettingsPayload) => void;

type PluginCommands = CommandsHandle & {
	createCommands(owner: string, options?: CommandsOptions): CommandsHandle;
};

export type ScopedCommands = {
	namespace: Overlay<'commands', PluginCommands>;
	dispose: () => void;
};

export type ScopedI18n = {
	namespace: Overlay<'i18n', Pick<Api['i18n'], 'createLocales'>>;
	/** The plugin's locales, once its `@unbound-app/i18n` module created them. */
	locales: () => AddonLocales | undefined;
};

function liveNamespace<K extends keyof Api>(key: K): Api[K] {
	const unbound: object = Reflect.get(globalThis, 'unbound');

	return Reflect.get(unbound, key);
}

function overlay<K extends keyof Api, O extends Partial<Api[K]>>(
	key: K,
	overrides: O,
): Overlay<K, O> {
	const view: object = {};

	return new Proxy(view, {
		get: (_target, prop) =>
			Object.hasOwn(overrides, prop)
				? Reflect.get(overrides, prop)
				: Reflect.get(liveNamespace(key), prop),
		has: (_target, prop) => Object.hasOwn(overrides, prop) || prop in liveNamespace(key),
	}) as Overlay<K, O>;
}

/**
 * @description Creates a plugin's `metro` namespace, whose module listeners and pending `findLazy` and `onModuleLoaded` waits end on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @returns The namespace.
 */
export function scopeMetro(subscriptions: Subscriptions): Api['metro'] {
	function onModuleLoad(listener: MetroModuleLoadListener) {
		return subscriptions.add(liveNamespace('metro').onModuleLoad(listener));
	}

	function findLazy(filter: MetroFilter, options: MetroLazySearchOptions = {}) {
		const controller = new AbortController();
		const { signal } = options;

		function abort() {
			controller.abort();
		}

		if (signal?.aborted) {
			abort();
		} else {
			signal?.addEventListener('abort', abort, { once: true });
		}

		const release = subscriptions.add(abort);
		const result = liveNamespace('metro').findLazy(filter, {
			...options,
			signal: controller.signal,
		});

		function settle() {
			signal?.removeEventListener('abort', abort);
			release();
		}

		if (result instanceof Promise) {
			void result.finally(settle);
		} else {
			settle();
		}

		return result;
	}

	function onModuleLoaded(
		filter: MetroFilter,
		onLoad: (mdl: MetroExport) => void,
		options?: MetroWaitOptions,
	) {
		let settled = false;
		let release = noop;
		const stop = liveNamespace('metro').onModuleLoaded(
			filter,
			(mdl) => {
				settled = true;
				release();
				onLoad(mdl);
			},
			options,
		);

		// A module that already loaded calls back before there is anything to track.
		if (settled) {
			return noop;
		}

		release = subscriptions.add(stop);

		return release;
	}

	return overlay('metro', {
		onModuleLoaded,
		onModuleLoad,
		findLazy,
	});
}

/**
 * @description Creates a plugin's `storage` namespace: `getBucket()` and `define()` with no name use the plugin's own Bucket,
 * and every listener it adds is removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @param owner The plugin id, which names its own Bucket.
 * @returns The namespace.
 */
export function scopeStorage(subscriptions: Subscriptions, owner: string): Api['storage'] {
	function getBucket(name: string = owner) {
		return liveNamespace('storage').getBucket(name);
	}

	function define(schema: SettingsSchema, name: string = owner) {
		return liveNamespace('storage').define(schema, name);
	}

	function onChange(predicate: SettingsPredicate, callback: ChangeCallback) {
		return subscriptions.add(liveNamespace('storage').onChange(predicate, callback));
	}

	return overlay('storage', { getBucket, define, onChange });
}

/**
 * @description Creates a plugin's `flux` namespace, whose store listeners, action listeners and interceptors are removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @returns The namespace.
 */
export function scopeFlux(subscriptions: Subscriptions): Api['flux'] {
	return overlay('flux', {
		onStoreChange(store: FluxStore, listener: FluxChangeListener) {
			return subscriptions.add(liveNamespace('flux').onStoreChange(store, listener));
		},
		onAction<K extends FluxActionType>(type: K, listener: FluxActionListener<K>) {
			return subscriptions.add(liveNamespace('flux').onAction(type, listener));
		},
		interceptAction<K extends FluxActionType>(type: K, interceptor: FluxActionInterceptor<K>) {
			return subscriptions.add(liveNamespace('flux').interceptAction(type, interceptor));
		},
	});
}

/**
 * @description Creates a plugin's `toasts` namespace, whose shorthands resolve the plugin's own message keys and log to its logger.
 * @param messages The plugin's message resolver.
 * @param logger The plugin's logger, which receives each error toast's error.
 * @returns The namespace.
 */
export function scopeToasts(messages: MessageResolver, logger: AddonLogger): Api['toasts'] {
	return overlay(
		'toasts',
		createFeedbackToasts({
			messages,
			core: coreMessages,
			logger,
			show: (options) => liveNamespace('toasts').show(options),
		}),
	);
}

/**
 * @description Creates a plugin's `dialogs` namespace, whose `confirm` and `alert` resolve the plugin's own message keys.
 * @param messages The plugin's message resolver.
 * @returns The namespace.
 */
export function scopeDialogs(messages: MessageResolver): Api['dialogs'] {
	return overlay(
		'dialogs',
		createFeedbackDialogs({
			messages,
			core: coreMessages,
			showDialog: (options) => liveNamespace('dialogs').showDialog(options),
		}),
	);
}

/**
 * @description Creates a plugin's `settings` namespace, whose registered sections are removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @returns The namespace.
 */
export function scopeSettings(subscriptions: Subscriptions): Api['settings'] {
	const owned = new Map<string, () => void>();

	function registerSection(...entries: SettingsEntry[]) {
		liveNamespace('settings').registerSection(...entries);

		for (const { key } of entries) {
			if (owned.has(key)) {
				continue;
			}

			owned.set(
				key,
				subscriptions.add(() => {
					owned.delete(key);
					liveNamespace('settings').removeSection(key);
				}),
			);
		}
	}

	// A key the plugin did not register, such as Discord's or Unbound's, is removed without tracking.
	function removeSection(...keys: string[]) {
		for (const key of keys) {
			const release = owned.get(key);

			if (release) {
				release();
			} else {
				liveNamespace('settings').removeSection(key);
			}
		}
	}

	return overlay('settings', { registerSection, removeSection });
}

/**
 * @description Creates a plugin's `assets` namespace: its registered assets and listeners end on dispose, and
 * `getIdByName` and `getByName` find the plugin's own names before anything else.
 * @param subscriptions The plugin's subscription tracker.
 * @param owner The plugin id, which keeps its asset names apart from every other plugin's.
 * @returns The namespace.
 */
export function scopeAssets(subscriptions: Subscriptions, owner: string): Api['assets'] {
	function register(options: AssetRegistration) {
		const registered = registerOwnedAsset(owner, options);

		return { id: registered.id, unregister: subscriptions.add(registered.unregister) };
	}

	function onAssetRegistered(listener: AssetRegistrationListener) {
		return subscriptions.add(liveNamespace('assets').onAssetRegistered(listener));
	}

	function getIdByName(name: string, type?: string) {
		return findOwnedId(owner, name, type) ?? liveNamespace('assets').getIdByName(name, type);
	}

	function getByName(name: string, type?: string) {
		const id = getIdByName(name, type);

		return id === void 0 ? void 0 : liveNamespace('assets').getById(id);
	}

	return overlay('assets', { register, onAssetRegistered, getIdByName, getByName });
}

/**
 * @description Creates a plugin's `i18n` namespace, whose `createLocales` reads the plugin's own locale files and stops following locale changes on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @param source The plugin's locales and how to read them.
 * @returns The namespace, and the locales it created.
 */
export function scopeI18n(subscriptions: Subscriptions, source: LocaleSource): ScopedI18n {
	let created: AddonLocales | undefined;

	// A lazy module builds its own copy of the locale module; it gets the plugin's one instance and table.
	function createLocales(fallback: LocaleStrings) {
		if (created) {
			return created;
		}

		const locales = liveNamespace('i18n').createLocales(fallback, source);

		created = locales;
		subscriptions.add(locales.dispose);

		return locales;
	}

	return { namespace: overlay('i18n', { createLocales }), locales: () => created };
}

/**
 * @description Creates a plugin's `commands` namespace, which registers commands under the plugin's id and
 * resolves their message keys through the plugin's own translations, its `createCommands` handles too.
 * @param owner The plugin id.
 * @param getLocales Reads the plugin's translations; `undefined` until its `@unbound-app/i18n` module loads.
 * @returns The namespace, and a `dispose` that removes every command the plugin registered.
 */
export function scopeCommands(owner: string, getLocales: LocalesGetter): ScopedCommands {
	const handle = createOwnerCommands(owner, {}, getLocales);
	const handles = [handle];

	function createCommands(id: string, options: CommandsOptions = {}) {
		const created = createOwnerCommands(id, options, getLocales);

		handles.push(created);

		return created;
	}

	function dispose() {
		for (const created of handles.splice(0)) {
			created.unregisterAll();
		}
	}

	return { namespace: overlay('commands', { ...handle, createCommands }), dispose };
}
