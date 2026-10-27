import type { Addon, AddonManifest, Plugin, PluginContext, PluginEntity } from '@unbound-app/types';

import { createScopedReact, performRefresh, withRefreshScope } from '~/lib/hot/runtime';
import { createPluginContext } from '~/api/native-runtime';
import type { ReloadResult } from '~/managers/addons';
import { attributeAddon } from '~/api/crash-guard';
import { reload as reloadApp } from '~/api/native';
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
	 * @description Restarts a plugin on its new bundle, then re-renders its mounted components in place.
	 * A component whose hooks changed can't keep its state, so the app reloads instead.
	 * @param entity The plugin to reload, as its id or the entity itself.
	 * @param bundle The freshly built bundle source.
	 * @param manifest The freshly built, validated manifest.
	 * @returns The reload outcome.
	 */
	async reload(
		entity: string | Addon,
		bundle: string,
		manifest: AddonManifest,
	): Promise<ReloadResult> {
		const result = await super.reload(entity, bundle, manifest);

		if (result.ok && performRefresh().needsRemount) {
			this.logger.info(`${manifest.id} changed a component's hooks; reloading.`);
			reloadApp();
		}

		return result;
	}

	/**
	 * @description Evaluates a plugin bundle's IIFE and resolves it to the plugin instance. A bundle built
	 * by `ubd dev` registers its components for hot refresh under the plugin's id.
	 * @param bundle The raw plugin bundle to evaluate.
	 * @param id The plugin's id.
	 * @returns The resolved plugin instance.
	 */
	protected handleBundle(bundle: string, id: string): Plugin {
		// oxlint-disable-next-line no-eval
		const iife = eval(`((React) => { return ${bundle} })`);

		return withRefreshScope(id, () => {
			const payload = iife(createScopedReact());
			const instance = typeof payload === 'function' ? payload() : payload;

			return instance?.default ?? instance;
		});
	}

	protected get entityType() {
		return 'plugin' as const;
	}

	protected createContext(entity: PluginEntity): PluginContext {
		return createPluginContext(
			entity.data,
			attributeAddon(this.crashGuardKey(entity.id), entity.data.name),
		);
	}
}

/** @internal */
export const plugins = new Plugins();
