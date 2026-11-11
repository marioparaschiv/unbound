import { createLogger } from '@unbound-app/logger';

import { benchSpan } from '~/core/bench-span';

const Logger = createLogger('BuiltIns');

/** A built-in feature exposing optional `start`/`afterAddons`/`stop` lifecycle hooks. */
export type BuiltIn = {
	/** Runs when the built-in is registered, before the addon managers load; if it throws, the built-in is logged and left inactive. */
	start?: () => void;
	/** Runs once the addon managers have loaded their addons, for work that reads them. */
	afterAddons?: () => void;
	/** Runs when the built-in is unregistered or the built-ins shut down, in reverse start order. */
	stop?: () => void;
	/** Checked once at initialisation; returning `false` skips registering the built-in. */
	shouldStart?: () => boolean;
};

/** A built-in under the name it is registered with. */
export type BuiltInEntry = [name: string, builtin: BuiltIn];

/**
 * @description Registers, starts, and stops the framework's built-in features, tracking which are currently active.
 */
class BuiltInsManager {
	private active = new Map<string, BuiltIn>();
	private initialized = false;

	/**
	 * @description Starts a built-in and records it as active, logging and skipping if it is already registered.
	 * Twin of {@link unregister}.
	 * @param name The name the built-in is registered under.
	 * @param builtin The built-in to start.
	 */
	register(name: string, builtin: BuiltIn) {
		if (this.start(name, builtin)) {
			Logger.info(`Started built-in: ${name}`);
		}
	}

	private start(name: string, builtin: BuiltIn) {
		if (this.active.has(name)) {
			Logger.warn(`Built-in ${name} already registered`);

			return false;
		}

		try {
			benchSpan(`built-in ${name}`, () => builtin.start?.());
			this.active.set(name, builtin);

			return true;
		} catch (error) {
			Logger.error(`Failed to start built-in ${name}:`, error);

			return false;
		}
	}

	/**
	 * @description Stops an active built-in and removes it from the active set. Twin of {@link register}.
	 * @param name The name the built-in is registered under.
	 */
	unregister(name: string) {
		const builtin = this.active.get(name);

		if (!builtin) return;

		try {
			builtin.stop?.();
			this.active.delete(name);
			Logger.info(`Stopped built-in: ${name}`);
		} catch (error) {
			Logger.error(`Failed to stop built-in ${name}:`, error);
		}
	}

	/**
	 * @description Registers every built-in (skipping any whose `shouldStart` predicate returns false), then marks
	 * the manager initialised.
	 * @param entries Every built-in under its registered name, in start order. Shutdown stops them in reverse.
	 */
	initialize(entries: BuiltInEntry[]) {
		if (this.initialized) {
			Logger.warn('Built-ins already initialized');

			return;
		}

		const started: string[] = [];

		for (const [name, builtin] of entries) {
			if (typeof builtin.shouldStart === 'function' && !builtin.shouldStart()) {
				continue;
			}

			if (this.start(name, builtin)) {
				started.push(name);
			}
		}

		// One line, not one per built-in: each console call crosses to native, which startup pays for.
		Logger.info(`Started built-ins: ${started.join(', ')}`);
		this.initialized = true;
	}

	/**
	 * @description Runs each active built-in's `afterAddons` hook in start order, logging any that throw.
	 */
	afterAddons() {
		for (const [name, builtin] of this.active) {
			try {
				builtin.afterAddons?.();
			} catch (error) {
				Logger.error(`Failed to run afterAddons of built-in ${name}:`, error);
			}
		}
	}

	/**
	 * @description Stops every active built-in in reverse registration order, clears the active set, and marks the
	 * manager uninitialised.
	 */
	shutdown() {
		if (!this.initialized) return;

		const stopped: string[] = [];

		for (const [name, builtin] of [...this.active.entries()].reverse()) {
			try {
				builtin.stop?.();
				stopped.push(name);
			} catch (error) {
				Logger.error(`Failed to stop built-in ${name}:`, error);
			}
		}

		Logger.info(`Stopped built-ins: ${stopped.join(', ')}`);
		this.active.clear();
		this.initialized = false;
	}

	isInitialized() {
		return this.initialized;
	}
}

export const builtins = new BuiltInsManager();
