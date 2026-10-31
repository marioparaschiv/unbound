import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonManifest, PushedManifest } from '@unbound-app/types';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest';
import type { AddonRelease } from '@unbound-app/contracts/updates';
import type { AddonKind } from '@unbound-app/types/addons';
import toError from '@unbound-app/utils/to-error';
import sha256 from '@unbound-app/utils/sha256';

import {
	downloadBundle,
	downloadBytecode,
	downloadManifest,
	verifySignature,
} from '~/lib/addon-download';
import type { Addon, AddonResolveable } from '~/managers/addon';
import { AddonLifecycle } from '~/managers/addon-lifecycle';
import type { UpdatableKind } from '~/managers/manager-of';
import { compiledBundlePath } from '~/lib/addon-paths';
import type { InstalledEntry } from '~/lib/updates';
import { toRelease } from '~/lib/addon-versions';
import { Manager } from '~/managers/base';
import fs from '~/api/fs';

/** The outcome of {@link Addons.reload}: success, or failure carrying the recorded error. */
export type ReloadResult = { ok: true } | { ok: false; error: Error };

const INSTALL_EVENTS = ['loaded', 'unloaded', 'installed', 'updated', 'deleted'] as const;

type BundleDigest = {
	bundle: string;
	digest: string;
};

const bundleDigests = new Map<string, BundleDigest>();

function cachedDigest(id: string, bundle: string): string {
	const cached = bundleDigests.get(id);

	if (cached?.bundle === bundle) {
		return cached.digest;
	}

	const digest = sha256(bundle);

	bundleDigests.set(id, { bundle, digest });

	return digest;
}

// `downloadBundle` decodes the body as UTF-8; re-encoding gives back the served bytes for any valid
// UTF-8 bundle, and anything else fails closed as a mismatch.
function assertDigest(bundle: string, expected: string): void {
	const digest = sha256(bundle);

	if (digest !== expected) {
		throw new Error(`Bundle SHA-256 ${digest} does not match ${expected}.`);
	}
}

/**
 * @description Addon distribution on top of {@link AddonLifecycle}: install, update, hot reload and
 * delete, the on-disk layout, development copies and version holds.
 * @template I What the bundles of the addons this manager governs evaluate to.
 */
export abstract class Addons<I extends object> extends AddonLifecycle<I> {
	declare readonly kind: UpdatableKind;

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
		entity: AddonResolveable<I>,
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
			const state = this.stateOf(resolved);

			state.started = false;
			state.instance = null;
			state.bundle = bundle;
			state.manifest = manifest;
			this.clearFailure(resolved);

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
	private reloadFailed(id: string, resolved: Addon<I> | undefined, error: Error): ReloadResult {
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
	 * @param digest The SHA-256 the bundle must have, when the release lists one.
	 * @returns The loaded addon, or `undefined` on failure.
	 */
	async install(url: string, digest?: string): Promise<Addon<I> | undefined> {
		try {
			const manifest = await this.fetchManifest(url);
			const origin = url.split('/').slice(0, -1).join('/');
			const bundleUrl = new URL(manifest.main, `${origin}/`).toString();
			const [bundle, bytecode] = await Promise.all([
				downloadBundle(bundleUrl),
				this.fetchBytecode(manifest, bundleUrl),
			]);

			if (digest) {
				assertDigest(bundle, digest);
			}

			const installedTrust = this.getEntity(manifest.id)?.manifest.trust;
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
	 * verifies the bundle's SHA-256, then swaps it in through {@link reload} and emits `updated`. An
	 * addon that is not installed stays absent.
	 * @param id The addon's id.
	 * @param update The release the updater returned for this addon.
	 * @returns Whether the addon now runs the release's version; the manager records why when it doesn't.
	 */
	async update(id: string, update: AddonRelease): Promise<boolean> {
		const resolved = this.resolve(id);

		if (!resolved) {
			return false;
		}

		try {
			const [manifest, bundle] = await Promise.all([
				this.fetchManifest(update.manifestUrl),
				downloadBundle(update.bundleUrl),
			]);
			const bytecode = await this.fetchBytecode(manifest, update.bundleUrl);

			assertDigest(bundle, update.sha256);

			const result = await this.reload(
				resolved,
				bundle,
				verifySignature(manifest, bundle, resolved.manifest.trust),
				bytecode,
			);

			if (!result.ok) {
				this.emit('update-error', resolved, result.error);

				return false;
			}

			this.releaseStaleHold(resolved.id);
			this.emit('updated', resolved);

			return resolved.version === update.version;
		} catch (error) {
			const failure = toError(error);

			this.logger.error(`Failed to update addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);
			this.emit('update-error', resolved, failure);

			return false;
		}
	}

	/**
	 * @description Moves an addon to a release: updates it when installed, installs it otherwise. The
	 * updater calls {@link update} instead, which never installs.
	 * @param id The addon's id.
	 * @param release The release to move it to.
	 * @returns Whether the addon now runs the release's version; the manager records why when it doesn't.
	 */
	async applyRelease(id: string, release: AddonRelease): Promise<boolean> {
		if (this.getEntity(id)) {
			return this.update(id, release);
		}

		await this.install(release.manifestUrl, release.sha256);

		return this.getEntity(id)?.version === release.version;
	}

	/**
	 * @description Installs one version of a listed addon, newer or older than the installed one, then
	 * holds it there or lets automatic updates move it on.
	 * @param listed The listed addon.
	 * @param version The version to install.
	 * @param hold Whether automatic updates should leave the addon on this version.
	 * @returns Whether the addon now runs the version.
	 */
	async installListed(
		listed: ListedAddon,
		version: AddonVersion,
		hold: boolean = false,
	): Promise<boolean> {
		if (!(await this.applyRelease(listed.id, toRelease(listed.id, version)))) {
			return false;
		}

		if (hold) {
			this.holdVersion(listed.id, version.version);
		} else {
			this.releaseHold(listed.id);
		}

		return true;
	}

	/**
	 * @description Reads the version of a listed addon that is installed on this device.
	 * @param listed The listed addon.
	 * @returns The installed version, or `undefined` if absent.
	 */
	getInstalledVersion(listed: ListedAddon): string | undefined {
		return this.getEntity(listed.id)?.version;
	}

	/**
	 * @description Calls a listener whenever an addon's installed version may have changed.
	 * @param listener The listener.
	 * @returns A function that removes the listener.
	 */
	onInstalledChange(listener: () => void): () => void {
		for (const event of INSTALL_EVENTS) {
			this.on(event, listener);
		}

		return () => {
			for (const event of INSTALL_EVENTS) {
				this.off(event, listener);
			}
		};
	}

	/**
	 * @description Lists the installed addons for an update check, leaving out development copies.
	 * @returns One entry per installed addon.
	 */
	listInstalled(): InstalledEntry[] {
		return this.getEntities()
			.filter((entity) => !this.isDevelopmentCopy(entity.id))
			.map((entity) => {
				const { bundle } = this.stateOf(entity);

				return {
					kind: this.kind,
					id: entity.id,
					name: entity.name,
					version: entity.version,
					...(bundle ? { sha256: cachedDigest(entity.id, bundle) } : {}),
				};
			});
	}

	/**
	 * @description Deletes an installed addon: unloads it and removes its folder from disk, emitting `deleted`.
	 * @param entity The addon to delete, as its id or the entity itself.
	 */
	async delete(entity: AddonResolveable<I>): Promise<void> {
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

		if (manifest.type && manifest.type !== this.kind) {
			throw new Error(`Expected a ${this.kind} manifest, got ${manifest.type}.`);
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
	 * @description Names an addon's on-disk folder, inside the manager's directory.
	 * @param id The addon's id.
	 * @returns The folder path relative to the documents directory.
	 */
	protected directoryOf(id: string): string {
		return `${this.directory}/${id}`;
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

		return held !== void 0 && held === this.getEntity(id)?.version ? held : void 0;
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

/**
 * @description Whether an addon kind installs from a manifest URL, which also makes it updatable and holdable.
 * @param kind The addon kind.
 * @returns Whether the kind's manager is an {@link Addons} manager.
 */
export function installsFromManifest(kind: AddonKind): kind is UpdatableKind {
	return Manager.for(kind) instanceof Addons;
}
