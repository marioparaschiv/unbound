import type { Addon, AddonManifest } from '@unbound-app/types';
import noop from '@unbound-app/utils/noop';

import { Manager, ManagerType } from '~/managers/base';
import storage from '~/api/storage';
import fs from '~/api/fs';

type AddonResolveable = string | Addon;

/** The outcome of {@link Addons.reload}: success, or failure carrying the recorded error. */
export type ReloadResult = { ok: true } | { ok: false; error: Error };

type AddonEvents<T extends Addon> = {
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
	deleted: (entity: T) => void;
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

	/** The manifest `type` value this manager installs; used to reject mismatched installs. */
	protected abstract get entityType(): NonNullable<AddonManifest['type']>;

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
	 * @description Hot-reloads an addon from a freshly pushed bundle and manifest: upserts it into the
	 * manager, persists it to disk so the reload survives the next launch, and emits `reloaded` on
	 * success. A loaded addon is swapped in place (bundle + manifest replaced, old instance stopped,
	 * new one started only if it was running); an absent one is loaded fresh, honouring its persisted
	 * enabled state. A throwing `stop()` or a failing `start()` is caught, never aborting the swap, and
	 * drives a `reload-error` emit for on-device feedback. Returns the outcome so the caller reports it
	 * over the wire rather than reading it back out of shared state.
	 * @param entity The addon to reload, as its id or the entity itself.
	 * @param bundle The freshly built bundle source.
	 * @param manifest The freshly built, validated manifest.
	 * @returns The reload outcome: `{ ok: true }`, or `{ ok: false, error }` on failure.
	 */
	async reload(
		entity: AddonResolveable,
		bundle: string,
		manifest: AddonManifest,
	): Promise<ReloadResult> {
		const resolved = this.resolve(entity);

		// The target id and the manifest's id must agree: everything past here keys off `manifest.id`
		// (persist, load, getEntity), so a mismatch would install a second addon under the new id and
		// leave the old one running. Renaming an addon's id is out of scope for a hot swap — it changes
		// the persisted state, on-disk folder, and settings key.
		const targetId = typeof entity === 'string' ? entity : entity.id;

		if (targetId !== manifest.id) {
			const error = new Error(
				`Push targeted ${targetId} but the manifest declares ${manifest.id}.`,
			);
			this.logger.error(`Failed to reload addon ${targetId}:`, error);

			return { ok: false, error };
		}

		// Absent addon: install path over the socket bytes — load it fresh and persist it. load()
		// consults the persisted state and starts it only if enabled.
		if (!resolved) {
			try {
				this.validateManifest(manifest);
				await this.persist(bundle, manifest);
				this.load(bundle, manifest);

				const loaded = this.getEntity(manifest.id);
				const loadError = this.errors.get(manifest.id);

				if (!loaded) throw loadError ?? new Error('Addon failed to load.');
				if (loadError) {
					this.emit('reload-error', loaded, loadError);
					return { ok: false, error: loadError };
				}

				this.emit('reloaded', loaded);
				return { ok: true };
			} catch (error: any) {
				this.logger.error(`Failed to reload addon ${manifest.id}:`, error);
				this.errors.set(manifest.id, error);

				return { ok: false, error };
			}
		}

		try {
			this.validateManifest(manifest);

			// Restart only what was running, mirroring enable/disable: a save must not start an addon the
			// user has explicitly disabled.
			const wasStarted = resolved.started;

			// A throwing stop() must not abort the swap; stop() catches and records internally, so its
			// failure surfaces as a recorded error rather than a throw.
			if (wasStarted) this.stop(resolved);

			// A throwing stop() leaves `started`/`instance` untouched (stop() bails before clearing them),
			// which would wedge start()'s `already started` guard. Force a stopped state so the new bundle
			// always starts, and clear any recorded stop error so start()'s own failure is detected cleanly.
			resolved.started = false;
			resolved.instance = null;

			resolved.bundle = bundle;
			resolved.data = manifest;
			resolved.failed = false;
			this.errors.delete(resolved.id);

			await this.persist(bundle, manifest);

			if (wasStarted) this.start(resolved);

			const startError = this.errors.get(resolved.id);
			if (startError || resolved.failed) {
				const error = startError ?? new Error('Addon failed to start after reload.');
				this.emit('reload-error', resolved, error);
				return { ok: false, error };
			}

			this.emit('reloaded', resolved);
			return { ok: true };
		} catch (error: any) {
			this.logger.error(`Failed to reload addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
			this.emit('reload-error', resolved, error);
			return { ok: false, error };
		}
	}

	/**
	 * @description Installs an addon from a manifest URL: fetches and validates the manifest, downloads
	 * the bundle, loads it, and emits `installed`. Twin of {@link delete}.
	 * @param url The manifest URL to install from.
	 * @returns The loaded addon, or `undefined` on failure.
	 */
	async install(url: string): Promise<T | undefined> {
		try {
			const manifest: AddonManifest = await fetch(url, { cache: 'no-cache' }).then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch manifest (${res.status}).`);
				return res.json();
			});

			this.validateManifest(manifest);

			if (manifest.type && manifest.type !== this.entityType) {
				throw new Error(`Expected a ${this.entityType} manifest, got ${manifest.type}.`);
			}

			const origin = url.split('/').slice(0, -1).join('/');
			const bundleUrl = new URL(manifest.main, `${origin}/`).toString();
			const bundle = await fetch(bundleUrl, { cache: 'no-cache' }).then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch bundle (${res.status}).`);
				return res.text();
			});

			await this.persist(bundle, manifest);

			this.load(bundle, manifest);
			const entity = this.getEntity(manifest.id);
			if (entity) this.emit('installed', entity);

			return entity;
		} catch (error: any) {
			this.logger.error('Failed to install addon:', error);
			this.emit('install-error', error);
			return undefined;
		}
	}

	/**
	 * @description Deletes an installed addon: unloads it and removes its folder from disk, emitting `deleted`.
	 * @param entity The addon to delete, as its id or the entity itself.
	 */
	async delete(entity: AddonResolveable): Promise<void> {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			this.unload(resolved);
			await fs.rm(`Unbound/${ManagerType[this.type]}/${resolved.id}`);
			this.emit('deleted', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to delete addon ${resolved.id}:`, error);
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
	 * @description Writes an addon's manifest and bundle to its on-disk folder, the same layout the
	 * loader reads at startup, so a fresh install or hot reload survives the next app launch.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's validated manifest.
	 */
	protected async persist(bundle: string, manifest: AddonManifest): Promise<void> {
		const dir = `Unbound/${ManagerType[this.type]}/${manifest.id}`;

		await fs.write(`${dir}/manifest.json`, JSON.stringify(manifest));
		await fs.write(`${dir}/${manifest.main}`, bundle);
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
