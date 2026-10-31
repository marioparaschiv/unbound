import type { PushedManifest, Plugin, PluginContext } from '@unbound-app/types';

import { createScopedReact, performRefresh, withRefreshScope } from '~/hot-refresh/runtime';
import { attributeAddon, crashGuardKey, setFreezeListener } from '~/addons/crash-guard';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { createPluginContext } from '~/native/plugin-context';
import type { AddonAttribution } from '~/addons/crash-guard';
import { reload as reloadApp } from '~/native/native';
import type { ReloadResult } from '~/addons/addons';
import { setOwnerCheck } from '~/commands/owners';
import { registry } from '~/commands/registry';
import { Manager } from '~/addons/manager';
import { Addons } from '~/addons/addons';

/**
 * @description Manages plugins, building on the base {@link Addons} manager to load and evaluate plugin bundles.
 */
type PluginFactory = (react: ReturnType<typeof createScopedReact>) => ReturnType<typeof JSON.parse>;

type ScannedPlugin = {
	bundle: string;
	folder: string;
};

type EvaluatedPlugin = {
	bundle: string;
	factory: PluginFactory;
};

export class Plugins extends Addons<Plugin> {
	private scanned = new Map<string, ScannedPlugin>();
	private evaluated = new Map<string, EvaluatedPlugin>();

	constructor() {
		super({
			kind: 'plugin',
			name: 'Plugins',
			directory: 'Unbound/Plugins',
			bucket: 'plugins',
			label: 'UNBOUND_PLUGINS',
			icon: 'PuzzlePieceIcon',
		});

		Manager.register('plugin', this);
	}

	/**
	 * @description Loads every plugin exposed on `window.UNBOUND_PLUGINS`, then marks the manager initialised.
	 */
	initialize() {
		setFreezeListener((freeze) => this.handleFreeze(freeze));
		setOwnerCheck((owner) => Boolean(this.getEntity(owner)));

		for (const { bundle, manifest } of window.UNBOUND_PLUGINS ?? []) {
			if ('folder' in manifest && typeof manifest.folder === 'string') {
				this.scanned.set(manifest.id, { bundle, folder: manifest.folder });
			}

			this.load(bundle, manifest);
		}

		this.initialized = true;
	}

	/**
	 * @description Unloads a plugin and forgets its evaluated bundle, so a deleted plugin's code is not kept.
	 * @param entity The plugin to unload, as its id or the entity itself.
	 */
	unload(entity: AddonResolveable): void | Promise<void> {
		this.evaluated.delete(typeof entity === 'string' ? entity : entity.id);

		return super.unload(entity);
	}

	/**
	 * @description Restarts a plugin on its new bundle, then re-renders its mounted components in place.
	 * A component whose hooks changed can't keep its state, so the app reloads instead.
	 * @param entity The plugin to reload, as its id or the entity itself.
	 * @param bundle The freshly built bundle source.
	 * @param manifest The freshly built manifest, as received; {@link Addons.reload} validates it.
	 * @param bytecode The bundle compiled for this runtime, base64-encoded, which then runs instead of the source.
	 * @returns The reload outcome.
	 */
	async reload(
		entity: AddonResolveable,
		bundle: string,
		manifest: PushedManifest,
		bytecode?: string,
	): Promise<ReloadResult> {
		// The bytecode lookup during the reload reads this entry; a rejected push puts the old one back.
		const previous = this.scanned.get(manifest.id);

		if (bytecode) {
			this.scanned.set(manifest.id, { bundle, folder: manifest.id });
		}

		const result = await super.reload(entity, bundle, manifest, bytecode);

		if (!result.ok && bytecode) {
			if (previous) {
				this.scanned.set(manifest.id, previous);
			} else {
				this.scanned.delete(manifest.id);
			}
		}

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
		const iife = this.factoryFor(bundle, id);

		return withRefreshScope(id, () => {
			const payload = iife(createScopedReact());
			const instance = typeof payload === 'function' ? payload() : payload;

			return instance?.default ?? instance;
		});
	}

	private factoryFor(bundle: string, id: string): PluginFactory {
		const cached = this.evaluated.get(id);

		if (cached?.bundle === bundle) {
			return cached.factory;
		}

		const factory = this.compiledFactory(bundle, id) ?? this.sourceFactory(bundle);

		this.evaluated.set(id, { bundle, factory });

		return factory;
	}

	private sourceFactory(bundle: string): PluginFactory {
		// oxlint-disable-next-line no-eval
		return eval(`((React) => { return ${bundle} })`);
	}

	/**
	 * @description Evaluates the bytecode compiled for this runtime, when the bundle being started is the
	 * one the loader scanned at launch or one reloaded with its bytecode, so any other bundle runs from source.
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

	protected createContext(entity: Addon): PluginContext {
		const context = createPluginContext(entity.manifest, this.attribution(entity));

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

	protected attribution(entity: Addon): AddonAttribution | undefined {
		return attributeAddon(crashGuardKey(this.bucket, entity.id), entity.name);
	}
}

/** @internal */
export const plugins = new Plugins();
