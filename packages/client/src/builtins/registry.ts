import { createLogger } from '@unbound-app/logger';

const Logger = createLogger('BuiltIns');

/** A built-in feature exposing optional `start`/`stop` lifecycle hooks. */
export type BuiltIn = {
	/** Runs when the built-in is registered; if it throws, the built-in is logged and left inactive. */
	start?: () => void;
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
	 * @param entries Every built-in under its registered name, in start order. Shutdown stops them in reverse.
	 */
	initialize(entries: BuiltInEntry[]) {
		if (this.initialized) {
			Logger.warn('Built-ins already initialized');

			return;
		}

		for (const [name, builtin] of entries) {
			if (typeof builtin.shouldStart === 'function' && !builtin.shouldStart()) {
				continue;
			}

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
