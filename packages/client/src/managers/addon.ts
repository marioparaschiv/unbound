import type {
	AddonAuthor,
	AddonHandle,
	AddonManifest,
	Plugin,
	PluginContext,
} from '@unbound-app/types';
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

/** Every event an addon manager emits, across its lifecycle and its distribution. */
export type AddonEvents<T> = {
	loaded: (entity: T) => void;
	unloaded: (entity: T) => void;
	started: (entity: T) => void;
	stopped: (entity: T) => void;
	enabled: (entity: T) => void;
	disabled: (entity: T) => void;
	toggled: (entity: T) => void;
	reloaded: (entity: T) => void;
	'reload-error': (entity: T, error: Error) => void;
	installed: (entity: T) => void;
	'install-error': (error: Error) => void;
	updated: (entity: T) => void;
	'update-error': (entity: T, error: Error) => void;
	deleted: (entity: T) => void;
	'consent-required': (entity: T) => void;
};

/** The manager calls an {@link Addon} forwards to. */
export type ManagerActions = Pick<
	AddonLifecycle<object>,
	'kind' | 'isEnabled' | 'enable' | 'disable' | 'restart'
>;

/**
 * @description A plugin, theme or icon pack its manager governs. Read its manifest and state, or ask
 * its manager to enable, disable or reload it. Stringifies to its manifest.
 * @template I What the addon's bundle evaluates to.
 */
export class Addon<I extends object = object> implements AddonHandle<I> {
	readonly #state: AddonState<I>;
	readonly #manager: ManagerActions;

	/**
	 * @description Creates an addon over the state its manager keeps and writes.
	 * @param state The manager's record of the addon.
	 * @param manager The manager that governs it.
	 */
	constructor(state: AddonState<I>, manager: ManagerActions) {
		this.#state = state;
		this.#manager = manager;
	}

	get id(): string {
		return this.#state.manifest.id;
	}

	get name(): string {
		return this.#state.manifest.name;
	}

	get version(): string {
		return this.#state.manifest.version;
	}

	get authors(): AddonAuthor[] {
		return this.#state.manifest.authors;
	}

	get manifest(): AddonManifest {
		return this.#state.manifest;
	}

	/** Whether the addon is running. */
	get started(): boolean {
		return this.#state.started;
	}

	/** Whether the addon failed to start. */
	get failed(): boolean {
		return this.#state.failed;
	}

	/** Renders the settings panel the running addon provides, if any. */
	get settingsPanel(): (() => ReactNode) | undefined {
		const instance = this.#state.instance;

		return instance?.getSettingsPanel ? () => instance.getSettingsPanel?.() : void 0;
	}

	/** @internal */
	get context(): PluginContext | undefined {
		return this.#state.context;
	}

	/** @deprecated Use manifest */
	get data(): AddonManifest {
		return this.#state.manifest;
	}

	/** @deprecated What the bundle evaluated to; readable until 1.0. */
	get instance(): (Plugin & I) | null {
		return this.#state.instance;
	}

	/** @deprecated The bundle source; readable until 1.0. */
	get bundle(): string {
		return this.#state.bundle;
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
		return this.#state.manifest;
	}
}
