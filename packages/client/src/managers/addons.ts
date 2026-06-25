import type { Addon, AddonManifest } from '@unbound-app/types';
import noop from '@unbound-app/utils/noop';

import { Manager } from '~/managers/base';
import storage from '~/api/storage';

type AddonResolveable = string | Addon;

type AddonEvents<T extends Addon> = {
	loaded: (entity: T) => void;
	unloaded: (entity: T) => void;
	started: (entity: T) => void;
	stopped: (entity: T) => void;
	enabled: (entity: T) => void;
	disabled: (entity: T) => void;
	toggled: (entity: T) => void;
	reloaded: (entity: T) => void;
};

/**
 * @description Shared lifecycle manager for addons (plugins and themes), extending {@link Manager}.
 * Implements the load/unload, start/stop, and enable/disable operations common to every addon kind.
 * @template T The addon entity type this manager governs.
 */
export abstract class Addons<T extends Addon> extends Manager<T, AddonEvents<T>> {
	/**
	 * @description Evaluates an addon's bundle source into a running instance. Implemented by each subclass.
	 * @param bundle The addon's bundle source.
	 * @returns The addon's instance.
	 */
	protected abstract handleBundle(bundle: string): any;

	/**
	 * @description Loads an addon into the manager from its bundle and manifest, starting it if its
	 * stored state is enabled, and emits `loaded`.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's validated manifest.
	 */
	load(bundle: string, manifest: AddonManifest) {
		try {
			this.validateManifest(manifest);

			const entity: Addon = {
				id: manifest.id,
				data: manifest,
				bundle,
				instance: null,
				started: false,
				failed: false,
			};

			this.entities.set(manifest.id, entity as T);

			const states = this.getStates();
			if (states[manifest.id]) {
				this.start(entity);
			}

			this.emit('loaded', entity as T);
		} catch (error: any) {
			this.logger.error(`Failed to load addon ${manifest.id}:`, error);
			this.errors.set(manifest.id, error);
		}
	}

	/**
	 * @description Unloads an addon from the manager, stopping it if running, and emits `unloaded`.
	 * @param entity The addon to unload, as its id or the entity itself.
	 */
	unload(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			if (resolved.started) {
				this.stop(resolved);
			}

			this.entities.delete(resolved.id);
			this.errors.delete(resolved.id);

			this.emit('unloaded', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to unload addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	/**
	 * @description Starts an addon, evaluating its bundle into an instance, running it, and emits `started`.
	 * @param entity The addon to start, as its id or the entity itself.
	 */
	start(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved || resolved.started) return;

		try {
			const recoveryMode = storage.get('unbound', 'recovery', false);

			if (recoveryMode) {
				resolved.instance = { start: noop, stop: noop };
			} else {
				const instance = this.handleBundle(resolved.bundle);
				resolved.instance = instance;
			}

			resolved.instance?.start?.();
			resolved.started = true;

			this.emit('started', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to start addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
			resolved.failed = true;
		}
	}

	/**
	 * @description Stops an addon, tearing down its instance, and emits `stopped`.
	 * @param entity The addon to stop, as its id or the entity itself.
	 */
	stop(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved || !resolved.started) return;

		try {
			resolved.instance?.stop?.();
			resolved.instance = null;
			resolved.started = false;

			this.emit('stopped', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to stop addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	/**
	 * @description Enables an addon, persisting its state and starting it if not already running, and emits `enabled`.
	 * @param entity The addon to enable, as its id or the entity itself.
	 */
	enable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			const states = this.getStates();
			states[resolved.id] = true;
			this.settings.set('states', states);

			if (!resolved.started) {
				this.start(resolved);
			}

			this.emit('enabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to enable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	/**
	 * @description Disables an addon, persisting its state and stopping it if currently running, and emits `disabled`.
	 * @param entity The addon to disable, as its id or the entity itself.
	 */
	disable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			const states = this.getStates();
			states[resolved.id] = false;
			this.settings.set('states', states);

			if (resolved.started) {
				this.stop(resolved);
			}

			this.emit('disabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to disable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	/**
	 * @description Toggles an addon between enabled and disabled based on its current state, and emits `toggled`.
	 * @param entity The addon to toggle, as its id or the entity itself.
	 */
	toggle(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		const states = this.getStates();
		if (states[resolved.id]) {
			this.disable(resolved);
		} else {
			this.enable(resolved);
		}

		this.emit('toggled', resolved);
	}

	/**
	 * @description Resolves an addon reference, accepting either an id (matched by id then name) or the entity itself.
	 * @param entity The addon to resolve, as its id or the entity itself.
	 * @returns The matching entity, or `undefined` if none is found.
	 */
	protected resolve(entity: AddonResolveable): T | undefined {
		if (typeof entity === 'string') {
			return this.entities.get(entity) ?? this.getByName(entity);
		}

		return entity as T;
	}

	/**
	 * @description Finds a governed addon by its manifest name.
	 * @param name The name to search for.
	 * @returns The matching entity, or `undefined` if none is found.
	 */
	protected getByName(name: string): T | undefined {
		for (const entity of this.entities.values()) {
			if (entity.data.name === name) {
				return entity;
			}
		}
	}

	/**
	 * @description Reads the persisted enabled/disabled state map for this manager's addons.
	 * @returns A record of addon id to its enabled state.
	 */
	protected getStates(): Record<string, boolean> {
		return this.settings.get('states', {});
	}

	/**
	 * @description Validates an addon manifest, throwing if a required field is missing or malformed.
	 * @param manifest The manifest to validate.
	 */
	protected validateManifest(manifest: AddonManifest) {
		const required = ['id', 'name', 'description', 'authors', 'version', 'main'];

		for (const field of required) {
			if (!(field in manifest) || manifest[field as keyof AddonManifest] === undefined) {
				throw new Error(`Manifest missing required field: ${field}`);
			}
		}

		if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
			throw new Error('Manifest authors must be a non-empty array');
		}
	}
}
