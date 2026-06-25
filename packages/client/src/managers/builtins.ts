import { createLogger } from '@unbound-app/logger';

import * as allBuiltIns from '~/builtins';

const Logger = createLogger('BuiltIns');

/** A built-in feature exposing optional `start`/`stop` lifecycle hooks. */
export interface BuiltIn {
	start?: () => void;
	stop?: () => void;
	shouldStart?: () => boolean;
}

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
		if (this.active.has(name)) {
			Logger.warn(`Built-in ${name} already registered`);
			return;
		}

		try {
			builtin.start?.();
			this.active.set(name, builtin);
			Logger.info(`Started built-in: ${name}`);
		} catch (error) {
			Logger.error(`Failed to start built-in ${name}:`, error);
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
	 */
	initialize() {
		if (this.initialized) {
			Logger.warn('Built-ins already initialized');
			return;
		}

		for (const [name, builtin] of Object.entries<BuiltIn>(allBuiltIns)) {
			if (typeof builtin.shouldStart === 'function' && !builtin.shouldStart()) continue;

			this.register(name, builtin);
		}

		this.initialized = true;
	}

	/**
	 * @description Stops every active built-in in reverse registration order, clears the active set, and marks the
	 * manager uninitialised.
	 */
	shutdown() {
		if (!this.initialized) return;

		for (const [name, builtin] of [...this.active.entries()].reverse()) {
			try {
				builtin.stop?.();
				Logger.info(`Stopped built-in: ${name}`);
			} catch (error) {
				Logger.error(`Failed to stop built-in ${name}:`, error);
			}
		}

		this.active.clear();
		this.initialized = false;
	}

	/**
	 * @description Reports whether the built-ins have been initialised.
	 * @returns `true` if {@link initialize} has run and {@link shutdown} has not.
	 */
	isInitialized() {
		return this.initialized;
	}
}

export const builtins = new BuiltInsManager();
