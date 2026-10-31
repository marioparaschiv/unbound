import type { AddonAuthor, AddonManifest, Plugin, PluginContext } from '@unbound-app/types';
import type { ReactNode } from 'react';

import type { AddonLifecycle } from '~/managers/addon-lifecycle';

/** What a manager keeps for one addon it governs. The manager is its only writer. */
export type AddonState<I extends object> = {
	manifest: AddonManifest;
	bundle: string;
	/** What the bundle evaluated to. Every addon kind may implement the {@link Plugin} lifecycle hooks. */
	instance: (Plugin & I) | null;
	context: PluginContext | undefined;
	started: boolean;
	failed: boolean;
};

/** An addon referenced either by its id or the {@link Addon} itself. */
export type AddonResolveable<I extends object = object> = string | Addon<I>;

// Only the members an addon calls, so an `Addon<Theme>` still passes where any `Addon` is expected.
type AddonOwner = Pick<
	AddonLifecycle<object>,
	'kind' | 'isEnabled' | 'enable' | 'disable' | 'restart'
>;

/**
 * @description A plugin, theme or icon pack its manager governs. Read its manifest and state, or ask
 * its manager to enable, disable or reload it. Stringifies to its manifest.
 * @template I What the addon's bundle evaluates to.
 */
export class Addon<I extends object = object> {
	/** @internal The manager's record of this addon. Only the manager writes it. */
	readonly state: AddonState<I>;

	readonly #manager: AddonOwner;

	/**
	 * @description Creates the addon its manager registers from a validated manifest.
	 * @param manifest The addon's validated manifest.
	 * @param bundle The addon's bundle source.
	 * @param manager The manager that governs it.
	 */
	constructor(manifest: AddonManifest, bundle: string, manager: AddonOwner) {
		this.state = {
			manifest,
			bundle,
			instance: null,
			context: void 0,
			started: false,
			failed: false,
		};
		this.#manager = manager;
	}

	get id(): string {
		return this.state.manifest.id;
	}

	get name(): string {
		return this.state.manifest.name;
	}

	get version(): string {
		return this.state.manifest.version;
	}

	get authors(): AddonAuthor[] {
		return this.state.manifest.authors;
	}

	get manifest(): AddonManifest {
		return this.state.manifest;
	}

	/** Whether the addon is running. */
	get started(): boolean {
		return this.state.started;
	}

	/** Whether the addon failed to start. */
	get failed(): boolean {
		return this.state.failed;
	}

	/** Renders the settings panel the running addon provides, if any. */
	get settingsPanel(): (() => ReactNode) | undefined {
		const instance = this.state.instance;

		return instance?.getSettingsPanel ? () => instance.getSettingsPanel?.() : void 0;
	}

	/** @internal The native bridge of a running plugin, which the CLI's device probes borrow. */
	get context(): PluginContext | undefined {
		return this.state.context;
	}

	/**
	 * @description Whether the user has the addon enabled.
	 * @returns Its manager's answer.
	 */
	isEnabled(): boolean {
		return this.#manager.isEnabled(this.id);
	}

	/**
	 * @description Whether the addon is a plugin.
	 * @returns `true` when the plugin manager governs it.
	 */
	isPlugin(): this is Addon<Plugin> {
		return this.#manager.kind === 'plugin';
	}

	/**
	 * @description Enables the addon through its manager.
	 * @returns What the manager's `enable` returns.
	 */
	enable(): void | Promise<void> {
		return this.#manager.enable(this);
	}

	/**
	 * @description Disables the addon through its manager.
	 */
	disable(): void {
		this.#manager.disable(this);
	}

	/**
	 * @description Restarts the addon on its current bundle through its manager, if it is running.
	 * @returns Settles once the addon is running again.
	 */
	reload(): Promise<void> {
		return this.#manager.restart(this);
	}

	/**
	 * @description Serializes the addon as its manifest, so it never leaks its bundle or instance.
	 * @returns The addon's manifest.
	 */
	toJSON(): AddonManifest {
		return this.state.manifest;
	}
}
