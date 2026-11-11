import type { PushedManifest, Plugin, PluginContext } from '@unbound-app/types';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';

import { attributeAddon, crashGuardKey, setFreezeListener } from '~/addons/crash-guard';
import { performRefresh, withRefreshScope } from '~/hot-refresh/runtime';
import { installDependencies } from '~/marketplace/install-dependencies';
import { getLoader, getPlugins } from '~/native/unbound-native';
import type { AddonGlobals, AddonScope } from '~/addons/scope';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { createPluginContext } from '~/native/plugin-context';
import type { AddonAttribution } from '~/addons/crash-guard';
import { readPluginEntry } from '~/plugins/legacy-entry';
import { rememberSourceDigest } from '~/addons/digests';
import type { ReloadResult } from '~/addons/addons';
import { createAddonScope } from '~/addons/scope';
import { setOwnerCheck } from '~/commands/owners';
import type { AddonFiles } from '~/addons/files';
import { registry } from '~/commands/registry';
import { benchSpan } from '~/core/bench-span';
import { Addons } from '~/addons/addons';
import fs from '~/native/fs';

/**
 * @description Manages plugins, building on the base {@link Addons} manager to load and evaluate plugin bundles.
 */
type PluginFactory = (
	...globals: AddonGlobals[keyof AddonGlobals][]
) => ReturnType<typeof JSON.parse>;

type ScannedPlugin = {
	bundle: string;
	folder: string;
};

type EvaluatedPlugin = {
	bundle: string;
	factory: PluginFactory;
};

// The CLI's entrypoint wraps the module; `__load` runs it and returns its named exports.
type LazyPlugin = {
	// UNKNOWN: the module is whatever the entry exported; `readPluginEntry` narrows it.
	__load: () => unknown;
};

// UNKNOWN: a bundle's payload is whatever its IIFE returned.
function isLazyPlugin(value: unknown): value is LazyPlugin {
	return (
		typeof value === 'object' &&
		value !== null &&
		'__load' in value &&
		typeof value.__load === 'function'
	);
}

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
			noun: 'UNBOUND_PLUGINS_NOUN',
			icon: 'PuzzlePieceIcon',
		});
	}

	/**
	 * @description Loads every plugin the loader scanned (`UnboundNative.getPlugins()`).
	 */
	initialize() {
		setFreezeListener((freeze) => this.handleFreeze(freeze));
		setOwnerCheck((owner) => Boolean(this.getAddon(owner)));

		for (const entry of benchSpan('native getPlugins', getPlugins)) {
			const { manifest } = entry;
			const bundle = 'bundle' in entry ? entry.bundle : '';

			if ('sha256' in entry) {
				rememberSourceDigest(manifest.id, entry.sha256);
			}

			if ('folder' in manifest && typeof manifest.folder === 'string') {
				this.scanned.set(manifest.id, { bundle, folder: manifest.folder });
			}

			this.load(bundle, manifest);
		}
	}

	/**
	 * @description Stops listening for freezes and restores the default command owner check, then shuts the plugins down.
	 * @returns A promise that resolves once every plugin has stopped.
	 */
	shutdown(): Promise<void> {
		setFreezeListener(undefined);
		setOwnerCheck(undefined);

		return super.shutdown();
	}

	/**
	 * @description Unloads a plugin and forgets its evaluated bundle, so a deleted plugin's code is not kept.
	 * @param addon The plugin to unload, as its id or the addon itself.
	 */
	unload(addon: AddonResolveable): void | Promise<void> {
		this.evaluated.delete(typeof addon === 'string' ? addon : addon.id);

		return super.unload(addon);
	}

	/**
	 * @description Restarts a plugin on its new bundle, then re-renders its mounted components in place.
	 * A component whose hooks changed can't keep its state, so the app reloads instead.
	 * @param addon The plugin to reload, as its id or the addon itself.
	 * @param bundle The freshly built bundle source.
	 * @param manifest The freshly built manifest, as received; {@link Addons.reload} validates it.
	 * @param bytecode The bundle compiled for this runtime, base64-encoded, which then runs instead of the source.
	 * @param files The extra files to write beside the bundle, such as images, by path.
	 * @returns The reload outcome.
	 */
	async reload(
		addon: AddonResolveable,
		bundle: string,
		manifest: PushedManifest,
		bytecode?: string,
		files?: AddonFiles,
	): Promise<ReloadResult> {
		// The bytecode lookup during the reload reads this entry; a rejected push puts the old one back.
		const previous = this.scanned.get(manifest.id);

		if (bytecode) {
			this.scanned.set(manifest.id, { bundle, folder: manifest.id });
		}

		const result = await super.reload(addon, bundle, manifest, bytecode, files);

		if (!result.ok && bytecode) {
			if (previous) {
				this.scanned.set(manifest.id, previous);
			} else {
				this.scanned.delete(manifest.id);
			}
		}

		if (result.ok) {
			const { remounted } = performRefresh();

			if (remounted) {
				this.logger.info(
					`${manifest.id}: remounted ${remounted} components whose hooks changed.`,
				);
			}
		}

		return result;
	}

	/**
	 * @description Installs or updates the plugins a listed version depends on, once the user agrees.
	 * @param version The version about to install.
	 * @returns Whether its dependencies are in place.
	 */
	protected installRequirements(version: AddonVersion): Promise<boolean> {
		return installDependencies(version.manifest);
	}

	protected createScope(addon: Addon<Plugin>): AddonScope {
		return createAddonScope(
			addon,
			addon.manifest.path ?? `${fs.documentsPath}/${this.directoryOf(addon.id)}`,
		);
	}

	/**
	 * @description Evaluates a plugin bundle's IIFE with its scope's globals and resolves it to the entry's named
	 * exports. A bundle built by `ubd dev` registers its components for hot refresh under the plugin's id.
	 * @param bundle The raw plugin bundle to evaluate.
	 * @param id The plugin's id.
	 * @param scope The globals {@link createScope} made for this start.
	 * @returns The entry's named exports: `start`, `stop` and `SettingsPanel`.
	 */
	protected handleBundle(bundle: string, id: string, scope: AddonScope): Plugin {
		const iife = this.factoryFor(bundle, id);
		const globals = ADDON_SCOPE_GLOBALS.map((name) => scope.globals[name]);

		return benchSpan(`addon ${id} eval`, () =>
			withRefreshScope(id, () => {
				const payload = iife(...globals);
				const instance = typeof payload === 'function' ? payload() : payload;

				// Running the module here registers its components under this plugin's refresh scope. Each start
				// evaluates the IIFE afresh, so `__load` runs the module once per start.
				return readPluginEntry(id, isLazyPlugin(instance) ? instance.__load() : instance);
			}),
		);
	}

	private factoryFor(bundle: string, id: string): PluginFactory {
		const cached = this.evaluated.get(id);

		if (cached?.bundle === bundle) {
			return cached.factory;
		}

		const factory =
			this.compiledFactory(bundle, id) ?? this.sourceFactory(this.sourceOf(bundle, id));

		this.evaluated.set(id, { bundle, factory });

		return factory;
	}

	private sourceOf(bundle: string, id: string): string {
		const scanned = this.scanned.get(id);

		if (bundle || !scanned || scanned.bundle !== bundle) {
			return bundle;
		}

		const source = globalThis.NativePlatform?.addons.readSource(scanned.folder);

		if (source === undefined || source === '') {
			throw new Error(`The loader kept ${id}'s source back, and it could not be read.`);
		}

		return source;
	}

	private sourceFactory(bundle: string): PluginFactory {
		// oxlint-disable-next-line typescript/no-implied-eval
		return new Function(...ADDON_SCOPE_GLOBALS, `return ${bundle}`) as PluginFactory;
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
		const bytecodeVersion = getLoader()?.bytecodeVersion;
		const addons = globalThis.NativePlatform?.addons;

		if (!scanned || scanned.bundle !== bundle || !bytecodeVersion || !addons) return;

		try {
			const factory = addons.evaluateBytecode(scanned.folder, bytecodeVersion);

			return typeof factory === 'function' ? (factory as PluginFactory) : undefined;
		} catch (error) {
			this.logger.warn(`Failed to evaluate the bytecode of ${id}, using its source:`, error);

			return undefined;
		}
	}

	protected createContext(addon: Addon): PluginContext {
		const context = createPluginContext(addon.manifest, this.attribution(addon));

		return {
			...context,
			dispose() {
				try {
					context.dispose();
				} finally {
					// Every way a plugin ends disposes its context, a failed start and a throwing stop included.
					registry.release(addon.id);
				}
			},
		};
	}

	protected attribution(addon: Addon): AddonAttribution | undefined {
		return attributeAddon(crashGuardKey(this.bucket, addon.id), addon.name);
	}
}

/** @internal */
export const plugins = new Plugins();
