import type { Plugin, PluginEntity } from '@unbound-app/types';

import { ManagerType } from '~/managers/base';
import { Addons } from '~/managers/addons';

/**
 * @description Manages plugins, building on the base {@link Addons} manager to load and evaluate plugin bundles.
 */
export class Plugins extends Addons<PluginEntity> {
	/**
	 * @description Creates the plugins manager bound to the {@link ManagerType.PLUGINS} type.
	 */
	constructor() {
		super(ManagerType.PLUGINS);
	}

	/**
	 * @description Loads every plugin exposed on `window.UNBOUND_PLUGINS`, then marks the manager initialised.
	 */
	initialize() {
		for (const { bundle, manifest } of window.UNBOUND_PLUGINS ?? []) {
			this.load(bundle, manifest);
		}

		this.initialized = true;
	}

	/**
	 * @description Evaluates a plugin bundle's IIFE and resolves it to the plugin instance.
	 * @param bundle The raw plugin bundle to evaluate.
	 * @returns The resolved plugin instance.
	 */
	protected handleBundle(bundle: string): Plugin {
		// oxlint-disable-next-line no-eval
		const iife = eval(`(() => { return ${bundle} })`);
		const payload = iife();
		const instance = typeof payload === 'function' ? payload() : payload;

		return instance?.default ?? instance;
	}

	protected get entityType() {
		return 'plugin' as const;
	}
}

/** @internal */
export const plugins = new Plugins();
