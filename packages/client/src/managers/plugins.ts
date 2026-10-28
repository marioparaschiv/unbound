import type { Addon, AddonManifest, Plugin, PluginContext, PluginEntity } from '@unbound-app/types';

import { createScopedReact, performRefresh, withRefreshScope } from '~/lib/hot/runtime';
import { attributeAddon, setFreezeListener } from '~/api/crash-guard';
import { createPluginContext } from '~/api/native-runtime';
import type { AddonAttribution } from '~/api/crash-guard';
import type { ReloadResult } from '~/managers/addons';
import { reload as reloadApp } from '~/api/native';
import { registry } from '~/lib/commands/registry';
import { ManagerType } from '~/managers/base';
import { Addons } from '~/managers/addons';

/**
 * @description Manages plugins, building on the base {@link Addons} manager to load and evaluate plugin bundles.
 */
type PluginFactory = (react: ReturnType<typeof createScopedReact>) => ReturnType<typeof JSON.parse>;

type ScannedPlugin = {
	bundle: string;
	folder: string;
};

export class Plugins extends Addons<PluginEntity> {
	private scanned = new Map<string, ScannedPlugin>();

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
		setFreezeListener((freeze) => this.handleFreeze(freeze));

		for (const { bundle, manifest } of window.UNBOUND_PLUGINS ?? []) {
			if ('folder' in manifest && typeof manifest.folder === 'string') {
				this.scanned.set(manifest.id, { bundle, folder: manifest.folder });
			}

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
		const iife: PluginFactory = this.compiledFactory(bundle, id) ?? this.sourceFactory(bundle);

		return withRefreshScope(id, () => {
			const payload = iife(createScopedReact());
			const instance = typeof payload === 'function' ? payload() : payload;

			return instance?.default ?? instance;
		});
	}

	private sourceFactory(bundle: string): PluginFactory {
		// oxlint-disable-next-line no-eval
		return eval(`((React) => { return ${bundle} })`);
	}

	/**
	 * @description Evaluates the bytecode the loader compiled for this runtime, when the bundle being
	 * started is the one it scanned at launch, so a hot-reloaded or updated bundle always runs from source.
	 * @param bundle The bundle about to start.
	 * @param id The plugin's id.
	 * @returns The compiled plugin factory, or `undefined` to evaluate the source.
	 */
	private compiledFactory(bundle: string, id: string): PluginFactory | undefined {
		const scanned = this.scanned.get(id);
		const bytecodeVersion = window.UNBOUND_LOADER?.bytecodeVersion;
		const addons = globalThis.NativePlatform?.addons;

		if (!scanned || scanned.bundle !== bundle || !bytecodeVersion || !addons?.evaluateBytecode)
			return;

		try {
			const factory = addons.evaluateBytecode(scanned.folder, bytecodeVersion);

			return typeof factory === 'function' ? (factory as PluginFactory) : undefined;
		} catch (error) {
			this.logger.warn(`Failed to evaluate the bytecode of ${id}, using its source:`, error);

			return undefined;
		}
	}

	protected get entityType() {
		return 'plugin' as const;
	}

	protected createContext(entity: PluginEntity): PluginContext {
		const context = createPluginContext(entity.data, this.attribution(entity));

		return {
			...context,
			dispose() {
				try {
					context.dispose();
				} finally {
					// Every way a plugin ends disposes its context, a failed start and a throwing stop included.
					registry.release(entity.id);
				}
			},
		};
	}

	protected attribution(entity: PluginEntity): AddonAttribution | undefined {
		return attributeAddon(this.crashGuardKey(entity.id), entity.data.name);
	}
}

/** @internal */
export const plugins = new Plugins();
