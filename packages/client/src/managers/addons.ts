import type { Addon, AddonManifest, AddonResolveable, PushedManifest } from '@unbound-app/types';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest';
import type { AddonRelease } from '@unbound-app/contracts/updates';
import toError from '@unbound-app/utils/to-error';
import sha256 from '@unbound-app/utils/sha256';

import {
	downloadBundle,
	downloadBytecode,
	downloadManifest,
	verifySignature,
} from '~/lib/addon-download';
import { AddonLifecycle } from '~/managers/addon-lifecycle';
import { compiledBundlePath } from '~/lib/addon-paths';
import fs from '~/api/fs';

/** The outcome of {@link Addons.reload}: success, or failure carrying the recorded error. */
export type ReloadResult = { ok: true } | { ok: false; error: Error };

/**
 * @description Addon distribution on top of {@link AddonLifecycle}: install, update, hot reload and
 * delete, the on-disk layout, development copies and version holds.
 * @template T The addon entity type this manager governs.
 */
export abstract class Addons<T extends Addon> extends AddonLifecycle<T> {
	/** The manifest `type` value this manager installs; used to reject mismatched installs. */
	protected abstract get entityType(): NonNullable<AddonManifest['type']>;

	protected registered(id: string): void {
		void this.adoptDevelopmentMarker(id);
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
	 * @param pushed The freshly built manifest, as received; it is validated before anything is swapped.
	 * @param bytecode The bundle compiled for this runtime, base64-encoded, whose digest the manifest lists.
	 * @returns The reload outcome: `{ ok: true }`, or `{ ok: false, error }` on failure.
	 */
	async reload(
		entity: AddonResolveable,
		bundle: string,
		pushed: PushedManifest,
		bytecode?: string,
	): Promise<ReloadResult> {
		const resolved = this.resolve(entity);

		// Everything past here keys off `manifest.id`, so a mismatch would install a second addon under
		// the new id and leave the old one running. A hot swap can't rename an addon.
		const targetId = typeof entity === 'string' ? entity : entity.id;

		if (targetId !== pushed.id) {
			const error = new Error(
				`Push targeted ${targetId} but the manifest declares ${pushed.id}.`,
			);

			this.logger.error(`Failed to reload addon ${targetId}:`, error);

			return { ok: false, error };
		}

		let manifest: AddonManifest;

		try {
			manifest = this.validateManifest(pushed);
		} catch (error) {
			return this.reloadFailed(targetId, resolved, toError(error));
		}

		// Absent addon: install path over the socket bytes — load it fresh and persist it. load()
		// consults the persisted state and starts it only if enabled.
		if (!resolved) {
			try {
				await this.persist(bundle, manifest);
				await this.persistBytecode(manifest, bytecode);
				this.register(bundle, manifest);

				const loaded = this.getEntity(manifest.id);
				const loadError = this.errors.get(manifest.id);

				if (!loaded) {
					throw loadError ?? new Error('Addon failed to load.');
				}

				if (loadError) {
					this.emit('reload-error', loaded, loadError);

					return { ok: false, error: loadError };
				}

				this.emit('reloaded', loaded);

				return { ok: true };
			} catch (error) {
				return this.reloadFailed(targetId, resolved, toError(error));
			}
		}

		try {
			// Restart only what was running, mirroring enable/disable: a save must not start an addon the
			// user has explicitly disabled.
			const wasStarted = resolved.started || this.pendingStarts.has(resolved.id);

			await this.persist(bundle, manifest);
			await this.persistBytecode(manifest, bytecode);

			this.pendingStarts.delete(resolved.id);

			if (resolved.started) {
				await this.stop(resolved);
			} else {
				await this.pendingStops.get(resolved.id);
			}

			// A throwing stop() leaves `started`/`instance` set, wedging start()'s guard. Force a stopped
			// state and clear the stop error so start()'s own failure is detected cleanly.
			resolved.started = false;
			resolved.instance = null;

			resolved.bundle = bundle;
			resolved.data = manifest;
			resolved.failed = false;
			this.errors.delete(resolved.id);

			if (wasStarted) {
				this.start(resolved);
			}

			const startError = this.errors.get(resolved.id);

			if (startError || resolved.failed) {
				const error = startError ?? new Error('Addon failed to start after reload.');

				this.emit('reload-error', resolved, error);

				return { ok: false, error };
			}

			this.emit('reloaded', resolved);

			return { ok: true };
		} catch (error) {
			return this.reloadFailed(targetId, resolved, toError(error));
		}
	}

	// Only a loaded addon gets a `reload-error` emit; an absent one has no entity to report against.
	private reloadFailed(id: string, resolved: T | undefined, error: Error): ReloadResult {
		this.logger.error(`Failed to reload addon ${id}:`, error);
		this.errors.set(id, error);

		if (resolved) {
			this.emit('reload-error', resolved, error);
		}

		return { ok: false, error };
	}

	/**
	 * @description Installs an addon from a manifest URL: fetches and validates the manifest, downloads
	 * the bundle, loads it, and emits `installed`. Twin of {@link delete}.
	 * @param url The manifest URL to install from.
	 * @returns The loaded addon, or `undefined` on failure.
	 */
	async install(url: string): Promise<T | undefined> {
		try {
			const manifest = await this.fetchManifest(url);
			const origin = url.split('/').slice(0, -1).join('/');
			const bundleUrl = new URL(manifest.main, `${origin}/`).toString();
			const [bundle, bytecode] = await Promise.all([
				downloadBundle(bundleUrl),
				this.fetchBytecode(manifest, bundleUrl),
			]);
			const installedTrust = this.getEntity(manifest.id)?.data.trust;
			const trusted = verifySignature(manifest, bundle, installedTrust);

			await this.persist(bundle, trusted);
			await this.persistBytecode(trusted, bytecode);

			this.register(bundle, trusted);
			const entity = this.getEntity(manifest.id);

			if (entity) {
				this.clearDevelopmentCopy(entity.id);
				this.recordSource(entity.id, url);
				this.releaseStaleHold(entity.id);
				this.emit('installed', entity);
			}

			return entity;
		} catch (error) {
			this.logger.error('Failed to install addon:', error);
			this.emit('install-error', toError(error));

			return undefined;
		}
	}

	/**
	 * @description Applies an updater release to an installed addon: downloads its manifest and bundle,
	 * verifies the bundle's SHA-256, then swaps it in through {@link reload} and emits `updated`.
	 * @param entity The addon to update, as its id or the entity itself.
	 * @param update The release the updater returned for this addon.
	 */
	async update(entity: AddonResolveable, update: AddonRelease): Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			const [manifest, bundle] = await Promise.all([
				this.fetchManifest(update.manifestUrl),
				downloadBundle(update.bundleUrl),
			]);
			const bytecode = await this.fetchBytecode(manifest, update.bundleUrl);

			// `fetchBundle` decodes the body as UTF-8; re-encoding gives back the served bytes for
			// any valid UTF-8 bundle, and anything else fails closed as a mismatch.
			const digest = sha256(bundle);

			if (digest !== update.sha256) {
				throw new Error(`Bundle SHA-256 ${digest} does not match ${update.sha256}.`);
			}

			const result = await this.reload(
				resolved,
				bundle,
				verifySignature(manifest, bundle, resolved.data.trust),
				bytecode,
			);

			if (!result.ok) {
				this.emit('update-error', resolved, result.error);

				return;
			}

			this.releaseStaleHold(resolved.id);
			this.emit('updated', resolved);
		} catch (error) {
			const failure = toError(error);

			this.logger.error(`Failed to update addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);
			this.emit('update-error', resolved, failure);
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
			await this.unload(resolved);
			await fs.rm(this.directoryOf(resolved.id));
			this.forgetSource(resolved.id);
			this.clearDevelopmentCopy(resolved.id);
			this.releaseHold(resolved.id);
			this.emit('deleted', resolved);
		} catch (error) {
			this.logger.error(`Failed to delete addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Downloads an addon manifest and validates it for this manager.
	 * @param url The manifest URL.
	 * @returns The validated manifest.
	 */
	private async fetchManifest(url: string): Promise<AddonManifest> {
		const manifest = await downloadManifest(url, (raw) => this.validateManifest(raw));

		if (manifest.type && manifest.type !== this.entityType) {
			throw new Error(`Expected a ${this.entityType} manifest, got ${manifest.type}.`);
		}

		return manifest;
	}

	// A missing compiled bundle is not fatal: the addon runs from source instead.
	private async fetchBytecode(
		manifest: AddonManifest,
		bundleUrl: string,
	): Promise<string | undefined> {
		try {
			return await downloadBytecode(manifest, bundleUrl);
		} catch (error) {
			this.logger.warn(
				`Failed to fetch the bytecode of ${manifest.id}, it will run from source:`,
				error,
			);

			return undefined;
		}
	}

	/**
	 * @description Names an addon's on-disk folder, matching the case the loader scans on case-sensitive file systems.
	 * @param id The addon's id.
	 * @returns The folder path relative to the documents directory.
	 */
	protected directoryOf(id: string): string {
		const folder = `${this.type.charAt(0).toUpperCase()}${this.type.slice(1)}`;

		return `Unbound/${folder}/${id}`;
	}

	/**
	 * @description Writes an addon's manifest and bundle to its on-disk folder, the same layout the
	 * loader reads at startup, so a fresh install or hot reload survives the next app launch.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's validated manifest.
	 */
	protected async persist(bundle: string, manifest: AddonManifest): Promise<void> {
		const dir = this.directoryOf(manifest.id);

		await fs.write(`${dir}/manifest.json`, JSON.stringify(manifest));
		await fs.write(`${dir}/${manifest.main}`, bundle);
	}

	/**
	 * @description Writes the bundle compiled for this runtime beside the source, where the loader looks for it on the next launch.
	 * @param manifest The addon's validated manifest.
	 * @param bytecode The compiled bundle, base64-encoded.
	 */
	protected async persistBytecode(
		manifest: AddonManifest,
		bytecode: string | undefined,
	): Promise<void> {
		const bytecodeVersion = globalThis.UNBOUND_LOADER?.bytecodeVersion;

		if (!bytecode || !bytecodeVersion) return;

		const path = `${this.directoryOf(manifest.id)}/${compiledBundlePath(manifest.main, bytecodeVersion)}`;

		await fs.write(path, bytecode, 'base64');
	}

	/**
	 * @description Marks an addon as a development copy pushed from a dev machine, so update checks leave it alone until it is installed from the store again.
	 * @param id The addon's id.
	 */
	markDevelopmentCopy(id: string): void {
		this.settings.set('development', { ...this.getDevelopmentCopies(), [id]: true });
	}

	/**
	 * @description Whether an addon is a development copy pushed from a dev machine.
	 * @param id The addon's id.
	 * @returns `true` until the addon is installed from the store or deleted.
	 */
	isDevelopmentCopy(id: string): boolean {
		return this.getDevelopmentCopies()[id] === true;
	}

	private getDevelopmentCopies(): Record<string, boolean> {
		return this.settings.get('development', {});
	}

	/**
	 * @description Stops treating an addon as a development copy, removing the marker `ubd install` leaves, so update checks include it again.
	 * @param id The addon's id.
	 */
	clearDevelopmentCopy(id: string): void {
		void fs.rm(this.developmentMarkerOf(id)).catch(() => undefined);

		const copies = this.getDevelopmentCopies();

		if (!(id in copies)) return;

		delete copies[id];
		this.settings.set('development', copies);
	}

	/**
	 * @description Holds an addon at a version the user chose, so automatic updates leave it there until they update it themselves.
	 * @param id The addon's id.
	 * @param version The version to hold it at.
	 */
	holdVersion(id: string, version: string): void {
		this.settings.set('held', { ...this.getHolds(), [id]: version });
	}

	/**
	 * @description The version an addon is held at, counted only while that version is the installed one.
	 * @param id The addon's id.
	 * @returns The held version, or `undefined` when it is not held or runs another version.
	 */
	getHeldVersion(id: string): string | undefined {
		const held = this.getHolds()[id];

		return held !== void 0 && held === this.getEntity(id)?.data.version ? held : void 0;
	}

	private getHolds(): Record<string, string> {
		return this.settings.get('held', {});
	}

	/**
	 * @description Stops holding an addon at a version, so automatic updates include it again.
	 * @param id The addon's id.
	 */
	releaseHold(id: string): void {
		const holds = this.getHolds();

		if (!(id in holds)) return;

		delete holds[id];
		this.settings.set('held', holds);
	}

	// A hold left on a version the addon moved off would otherwise come back if it returns there.
	private releaseStaleHold(id: string): void {
		if (this.getHeldVersion(id) !== void 0) return;

		this.releaseHold(id);
	}

	private developmentMarkerOf(id: string): string {
		return `${this.directoryOf(id)}/${DEVELOPMENT_MARKER}`;
	}

	private async adoptDevelopmentMarker(id: string): Promise<void> {
		try {
			if (await fs.exists(this.developmentMarkerOf(id))) {
				this.markDevelopmentCopy(id);
			}
		} catch {
			return;
		}
	}
}
