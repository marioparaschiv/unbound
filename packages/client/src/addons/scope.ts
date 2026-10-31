import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import type { Plugin } from '@unbound-app/types';

import { createScopedReact } from '~/hot-refresh/runtime';
import { createScopedTimers } from '~/addons/timers';
import type { Addon } from '~/addons/addon';
import * as patcherApi from '~/patcher/api';
import type * as api from '~/core/api';

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
	logger: ReturnType<typeof createLogger>;
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

function liveUnboundView(patcher: AddonGlobals['patcher']): AddonGlobals['unbound'] {
	const view: object = {};

	return new Proxy(view, {
		get: (_target, key) => (key === 'patcher' ? patcher : Reflect.get(liveUnbound(), key)),
		has: (_target, key) => key in liveUnbound(),
	}) as AddonGlobals['unbound'];
}

function liveUnbound(): object {
	return Reflect.get(globalThis, 'unbound');
}

/**
 * @description Creates the globals a plugin's bundle runs with: a patcher whose patches carry the
 * plugin's id, timers that are cleared on stop, a named logger and an `unbound` that serves that patcher.
 * @param addon The plugin about to start.
 * @returns The globals, and a `dispose` that undoes each scoped part in reverse order of creation.
 */
export function createAddonScope(addon: Addon<Plugin>): PluginScope {
	const tagged = patcherApi.createPatcher(addon.id);
	const timers = createScopedTimers();
	const parts: ScopedPart[] = [{ dispose: tagged.unpatchAll }, timers];
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
			unbound: liveUnboundView(patcher),
			addon,
			patcher,
			logger: createLogger('Plugins', addon.name),
			setTimeout: timers.setTimeout,
			setInterval: timers.setInterval,
			clearTimeout: timers.clearTimeout,
			clearInterval: timers.clearInterval,
		},
		dispose() {
			let failure: Error | undefined;

			for (const part of [...parts].reverse()) {
				try {
					part.dispose();
				} catch (error) {
					failure ??= toError(error);
				}
			}

			if (failure) {
				throw failure;
			}
		},
	};
}

export default { createAddonScope };
