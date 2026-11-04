import { getLocalePath } from '@unbound-app/contracts/addon-locales';
import type { AddonLogger, Plugin } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import {
	scopeAssets,
	scopeCommands,
	scopeDialogs,
	scopeFlux,
	scopeI18n,
	scopeMetro,
	scopeSettings,
	scopeStorage,
	scopeToasts,
} from '~/addons/scoped-namespaces';
import { createSubscriptions, disposeInReverse } from '~/addons/subscriptions';
import type { ScopedCommands, ScopedI18n } from '~/addons/scoped-namespaces';
import { createMessageResolver } from '~/i18n/message-resolver';
import { manifestRegistrations } from '~/assets/plugin-assets';
import { createScopedReact } from '~/hot-refresh/runtime';
import { createPatcher } from '~/patcher/create-patcher';
import { createScopedTimers } from '~/addons/timers';
import type { Addon } from '~/addons/addon';
import * as patcherApi from '~/patcher/api';
import type * as api from '~/core/api';
import fs from '~/native/fs';

type ScopedTimers = ReturnType<typeof createScopedTimers>;

type ScopedPart = {
	dispose: () => void;
};

/** The globals one plugin's bundle is evaluated with, keyed by their parameter names. */
export type AddonGlobals = {
	React: ReturnType<typeof createScopedReact>;
	unbound: Omit<typeof api, 'default'>;
	addon: Addon<Plugin>;
	patcher: typeof patcherApi;
	logger: AddonLogger;
	commands: ScopedCommands['namespace'];
	setTimeout: ScopedTimers['setTimeout'];
	setInterval: ScopedTimers['setInterval'];
	clearTimeout: ScopedTimers['clearTimeout'];
	clearInterval: ScopedTimers['clearInterval'];
};

/** A plugin's globals, and the `dispose` that undoes everything they registered. */
export type PluginScope = {
	globals: AddonGlobals;
	dispose: () => void;
};

type ScopedNamespaces = Pick<AddonGlobals, 'patcher' | 'commands'> & {
	metro: ReturnType<typeof scopeMetro>;
	storage: ReturnType<typeof scopeStorage>;
	flux: ReturnType<typeof scopeFlux>;
	settings: ReturnType<typeof scopeSettings>;
	assets: ReturnType<typeof scopeAssets>;
	i18n: ScopedI18n['namespace'];
	toasts: ReturnType<typeof scopeToasts>;
	dialogs: ReturnType<typeof scopeDialogs>;
};

function liveUnboundView(scoped: ScopedNamespaces): AddonGlobals['unbound'] {
	const view: object = {};

	return new Proxy(view, {
		get: (_target, key) =>
			Object.hasOwn(scoped, key) ? Reflect.get(scoped, key) : Reflect.get(liveUnbound(), key),
		has: (_target, key) => key in liveUnbound(),
	}) as AddonGlobals['unbound'];
}

function liveUnbound(): object {
	return Reflect.get(globalThis, 'unbound');
}

/**
 * @description Creates the globals a plugin's bundle runs with: a patcher and commands carrying the plugin's id,
 * timers, listeners, settings sections and assets removed on stop, a named logger and an `unbound` that serves the scoped namespaces.
 * @param addon The plugin about to start.
 * @param directory The plugin's folder, as an absolute path, which holds its images and locale files.
 * @returns The globals, and a `dispose` that undoes each scoped part in reverse order of creation.
 */
export function createAddonScope(addon: Addon<Plugin>, directory: string): PluginScope {
	const tagged = createPatcher(addon.id);
	const timers = createScopedTimers();
	const subscriptions = createSubscriptions();
	const logger = createLogger('Plugins', addon.name);
	const assets = scopeAssets(subscriptions, addon.id);
	const { main, assets: listed = {} } = addon.manifest;
	const i18n = scopeI18n(subscriptions, {
		owner: addon.id,
		codes: Object.keys(addon.manifest.locales ?? {}),
		read: (code) => fs.readFile(`${directory}/${getLocalePath(main, code)}`, 'utf8', false),
	});
	// One `resolveMessage` for the plugin's toasts, dialogs and commands, over the locales its bundle creates.
	const messages = createMessageResolver(addon.id, i18n.locales);
	const commands = scopeCommands(addon.id, messages.commandLocales);
	const parts: ScopedPart[] = [{ dispose: tagged.unpatchAll }, timers, subscriptions, commands];
	const patcher = {
		...patcherApi,
		before: tagged.before,
		instead: tagged.instead,
		after: tagged.after,
		react: tagged.react,
		unpatchAll: tagged.unpatchAll,
	};

	// The bundle reads the manifest's images as soon as it is evaluated, so they register first.
	for (const registration of manifestRegistrations(directory, main, listed)) {
		try {
			assets.register(registration);
		} catch (error) {
			logger.error(`Failed to register asset ${registration.name} for ${addon.id}:`, error);
		}
	}

	return {
		globals: {
			React: createScopedReact(),
			unbound: liveUnboundView({
				patcher,
				commands: commands.namespace,
				metro: scopeMetro(subscriptions),
				storage: scopeStorage(subscriptions, addon.id),
				flux: scopeFlux(subscriptions),
				settings: scopeSettings(subscriptions),
				assets,
				i18n: i18n.namespace,
				toasts: scopeToasts(messages, logger),
				dialogs: scopeDialogs(messages),
			}),
			addon,
			patcher,
			logger,
			commands: commands.namespace,
			setTimeout: timers.setTimeout,
			setInterval: timers.setInterval,
			clearTimeout: timers.clearTimeout,
			clearInterval: timers.clearInterval,
		},
		dispose() {
			disposeInReverse(parts.map((part) => part.dispose));
		},
	};
}

export default { createAddonScope };
