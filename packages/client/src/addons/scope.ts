import { createLogger } from '@unbound-app/logger';
import type { Plugin } from '@unbound-app/types';

import { scopeCommands, scopeFlux, scopeMetro, scopeStorage } from '~/addons/scoped-namespaces';
import { createSubscriptions, disposeInReverse } from '~/addons/subscriptions';
import type { ScopedCommands } from '~/addons/scoped-namespaces';
import { createScopedReact } from '~/hot-refresh/runtime';
import { createScopedTimers } from '~/addons/timers';
import type { Addon } from '~/addons/addon';
import * as patcherApi from '~/patcher/api';

type ScopedTimers = ReturnType<typeof createScopedTimers>;

type ScopedPart = {
	dispose: () => void;
};

/** The globals one plugin's bundle is evaluated with, keyed by their parameter names. */
export type AddonGlobals = {
	React: ReturnType<typeof createScopedReact>;
	unbound: typeof window.unbound;
	addon: Addon<Plugin>;
	patcher: typeof patcherApi;
	logger: ReturnType<typeof createLogger>;
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
};

function liveUnboundView(scoped: ScopedNamespaces): AddonGlobals['unbound'] {
	const view: object = {};

	return new Proxy(view, {
		get: (_target, key) =>
			Object.hasOwn(scoped, key)
				? Reflect.get(scoped, key)
				: Reflect.get(window.unbound, key),
		has: (_target, key) => key in window.unbound,
	}) as AddonGlobals['unbound'];
}

/**
 * @description Creates the globals a plugin's bundle runs with: a patcher and commands carrying the plugin's id,
 * timers and listeners removed on stop, a named logger and an `unbound` that serves the scoped namespaces.
 * @param addon The plugin about to start.
 * @returns The globals, and a `dispose` that undoes each scoped part in reverse order of creation.
 */
export function createAddonScope(addon: Addon<Plugin>): PluginScope {
	const tagged = patcherApi.createPatcher(addon.id);
	const timers = createScopedTimers();
	const subscriptions = createSubscriptions();
	const commands = scopeCommands(addon.id);
	const parts: ScopedPart[] = [{ dispose: tagged.unpatchAll }, timers, subscriptions, commands];
	const patcher = {
		...patcherApi,
		before: tagged.before,
		instead: tagged.instead,
		after: tagged.after,
		unpatchAll: tagged.unpatchAll,
	};

	return {
		globals: {
			React: createScopedReact(),
			unbound: liveUnboundView({
				patcher,
				commands: commands.namespace,
				metro: scopeMetro(subscriptions),
				storage: scopeStorage(subscriptions, addon.id),
				flux: scopeFlux(subscriptions),
			}),
			addon,
			patcher,
			logger: createLogger('Plugins', addon.name),
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
