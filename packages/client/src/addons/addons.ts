import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest-files';
import { getBytecodePath } from '@unbound-app/contracts/version-layout';
import type { AddonManifest, PushedManifest } from '@unbound-app/types';
import type { AddonRelease } from '@unbound-app/contracts/updates';
import toError from '@unbound-app/utils/to-error';

import {
	downloadBundle,
	downloadBytecode,
	downloadManifest,
	verifySignature,
} from '~/addons/download';
import { downloadAddonFiles, writeAddonFiles, type AddonFiles } from '~/addons/files';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { assertTextDigest, digestOf } from '~/addons/digests';
import type { InstalledEntry } from '~/updates/addon-updates';
import { countInstall } from '~/marketplace/count-install';
import type { UpdatableKind } from '~/addons/manager-of';
import { AddonSelection } from '~/addons/selection';
import { getLoader } from '~/native/unbound-native';
import { createRecord } from '~/addons/records';
import { toRelease } from '~/addons/versions';
import fs from '~/native/fs';

/** The outcome of an addon reload: success, or failure carrying the recorded error. */
export type ReloadResult = { ok: true } | { ok: false; error: Error };

/** How {@link Addons.installListed} leaves a listed version once installed. */
export type InstallListedOptions = {
	/** Whether automatic updates should leave the addon on this version. */
	hold?: boolean;
};

const INSTALL_EVENTS = ['loaded', 'unloaded', 'installed', 'updated', 'uninstalled'] as const;

/**
 * @description Addon distribution on top of {@link AddonSelection}: install, update, hot reload and
 * delete, the on-disk layout, development copies and version holds.
 * @template I What the bundles of the addons this manager governs evaluate to.
 */
export abstract class Addons<I extends object> extends AddonSelection<I> {
	declare readonly kind: UpdatableKind;
	/** The version each addon is held at. */
	protected readonly held = createRecord<string>(this.settings, 'held', (change) =>
		this.emit('record-changed', change),
	);
	/** The addons pushed from a dev machine, which update checks leave alone. */
	protected readonly development = createRecord<boolean>(this.settings, 'development', (change) =>
		this.emit('record-changed', change),
	);
	/** The URL each addon was installed from; addons loaded from disk or pushed over the debugger have none. */
	protected readonly sources = createRecord<string>(this.settings, 'sources', (change) =>
		this.emit('record-changed', change),
	);

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
	 * @param addon The addon to reload, as its id or the addon itself.
	 * @param bundle The freshly built bundle source.
	 * @param pushed The freshly built manifest, as received; it is validated before anything is swapped.
	 * @param bytecode The bundle compiled for this runtime, base64-encoded, whose digest the manifest lists.
	 * @param files The extra files to write beside the bundle, such as images, by path; the ones on disk stay when omitted.
	 * @returns The reload outcome: `{ ok: true }`, or `{ ok: false, error }` on failure.
	 */
	async reload(
		addon: AddonResolveable<I>,
		bundle: string,
		pushed: PushedManifest,
		bytecode?: string,
		files?: AddonFiles,
	): Promise<ReloadResult> {
		const resolved = this.resolve(addon);

		// Everything past here keys off `manifest.id`, so a mismatch would install a second addon under
		// the new id and leave the old one running. A hot swap can't rename an addon.
		const targetId = typeof addon === 'string' ? addon : addon.id;

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
			return this.reloadFailed(targetId, resolved, error);
		}

		// Absent addon: load the socket bytes fresh and persist them; load() starts it only if enabled.
		if (!resolved) {
			try {
				await this.persist(bundle, manifest, bytecode, files);
				this.register(bundle, manifest);

				const loaded = this.getAddon(manifest.id);
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
				return this.reloadFailed(targetId, resolved, error);
			}
		}

		try {
			// Restart only what was running, mirroring enable/disable: a save must not start an addon the
			// user has explicitly disabled.
			const wasStarted = resolved.started || this.pendingStarts.has(resolved.id);

			await this.persist(bundle, manifest, bytecode, files);

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
				await this.activate(resolved);
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
			return this.reloadFailed(targetId, resolved, error);
		}
	}

	// Only a loaded addon gets a `reload-error` emit; an absent one has no addon to report against.
	// UNKNOWN: catch binds whatever was thrown, not necessarily an Error.
	private reloadFailed(id: string, resolved: Addon<I> | undefined, error: unknown): ReloadResult {
		const failure = this.fail('reload', id, error);

		if (resolved) {
			this.emit('reload-error', resolved, failure);
		}

		return { ok: false, error: failure };
	}

	/**
	 * @description Installs an addon from a manifest URL: fetches and validates the manifest, downloads
	 * the bundle, loads it, and emits `installed`. Twin of {@link uninstall}.
	 * @param url The manifest URL to install from.
	 * @param digest The SHA-256 the bundle must have, when the release lists one.
	 * @returns The loaded addon, or `undefined` on failure.
	 */
	async install(url: string, digest?: string): Promise<Addon<I> | undefined> {
		try {
			const manifest = await this.fetchManifest(url);
			const origin = url.split('/').slice(0, -1).join('/');
			const bundleUrl = new URL(manifest.main, `${origin}/`).toString();
			const [bundle, bytecode, files] = await Promise.all([
				downloadBundle(bundleUrl),
				this.fetchBytecode(manifest, bundleUrl),
				downloadAddonFiles(manifest, bundleUrl, this.logger),
			]);

			if (digest) {
				assertTextDigest(bundle, digest);
			}

			const installedTrust = this.getAddon(manifest.id)?.manifest.trust;
			const trusted = verifySignature(manifest, bundle, installedTrust);

			await this.persist(bundle, trusted, bytecode, files);

			this.register(bundle, trusted);

			return this.installed(manifest.id, url);
		} catch (error) {
			this.logger.error('Failed to install addon:', error);
			this.emit('install-error', toError(error));

			return undefined;
		}
	}

	/**
	 * @description Finishes an install once the addon is registered: it is no longer a development copy,
	 * remembers its URL, drops a hold on a version it moved off, and emits `installed`.
	 * @param id The addon's id.
	 * @param url The manifest URL it was installed from.
	 * @returns The installed addon, or `undefined` when it failed to load.
	 */
	protected installed(id: string, url: string): Addon<I> | undefined {
		const addon = this.getAddon(id);

		if (!addon) return;

		this.clearDevelopmentCopy(addon.id);
		this.recordSource(addon.id, url);
		this.releaseStaleHold(addon.id);
		this.emit('installed', addon);

		return addon;
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
			const [bytecode, files] = await Promise.all([
				this.fetchBytecode(manifest, update.bundleUrl),
				downloadAddonFiles(manifest, update.bundleUrl, this.logger),
			]);

			assertTextDigest(bundle, update.sha256);

			const result = await this.reload(
				resolved,
				bundle,
				verifySignature(manifest, bundle, resolved.manifest.trust),
				bytecode,
				files,
			);

			if (!result.ok) {
				this.emit('update-error', resolved, result.error);

				return false;
			}

			this.releaseStaleHold(resolved.id);
			this.emit('updated', resolved);

			return resolved.version === update.version;
		} catch (error) {
			const failure = this.fail('update', resolved.id, error);

			this.emit('update-error', resolved, failure);

			return false;
		}
	}

	/**
	 * @description Moves an addon to a release: updates it when installed, installs it otherwise.
	 * @param id The addon's id.
	 * @param release The release to move it to.
	 * @returns Whether the addon now runs the release's version; the manager records why when it doesn't.
	 */
	async applyRelease(id: string, release: AddonRelease): Promise<boolean> {
		if (this.getAddon(id)) {
			return this.update(id, release);
		}

		await this.install(release.manifestUrl, release.sha256);

		return this.getAddon(id)?.version === release.version;
	}

	/**
	 * @description Installs one version of a listed addon, newer or older than the installed one, once
	 * its requirements are in place, then holds it there or lets automatic updates move it on. A first
	 * install turns itself on; an update keeps the user's choice.
	 * @param listed The listed addon; only its id is read.
	 * @param version The version to install.
	 * @param options `hold`: whether automatic updates should leave the addon on this version.
	 * @returns Whether the addon now runs the version.
	 */
	async installListed(
		listed: Pick<ListedAddon, 'id'>,
		version: AddonVersion,
		{ hold = false }: InstallListedOptions = {},
	): Promise<boolean> {
		if (!(await this.installRequirements(version))) {
			return false;
		}

		const fresh = !this.getAddon(listed.id);

		if (!(await this.applyRelease(listed.id, toRelease(listed.id, version)))) {
			return false;
		}

		if (hold) {
			this.holdVersion(listed.id, version.version);
		} else {
			this.releaseHold(listed.id);
		}

		if (fresh) {
			countInstall(listed.id);
			await this.enable(listed.id);
		}

		return true;
	}

	/**
	 * @description Puts in place what a listed version needs before it installs. Plugins install their dependencies here.
	 * @param _version The version about to install.
	 * @returns Whether the version can install.
	 */
	protected async installRequirements(_version: AddonVersion): Promise<boolean> {
		return true;
	}

	getInstalledVersion(listed: ListedAddon): string | undefined {
		return this.getAddon(listed.id)?.version;
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
		return this.getAddons()
			.filter((addon) => !this.isDevelopmentCopy(addon.id))
			.map((addon) => {
				const sha256 = digestOf(addon.id, this.stateOf(addon).bundle);

				return {
					kind: this.kind,
					id: addon.id,
					name: addon.name,
					version: addon.version,
					...(sha256 ? { sha256 } : {}),
				};
			});
	}

	/**
	 * @description Uninstalls an addon: unloads it and removes its folder from disk, emitting `uninstalled`.
	 * @param addon The addon to uninstall, as its id or the addon itself.
	 */
	async uninstall(addon: AddonResolveable<I>): Promise<void> {
		const resolved = this.resolve(addon);

		if (!resolved) return;

		try {
			// A deleted addon cannot stay the applied one.
			if (this.selection === 'one' && this.isEnabled(resolved.id)) {
				this.disable(resolved);
			}

			await this.unload(resolved);
			await fs.removeFile(this.directoryOf(resolved.id));
			this.forgetSource(resolved.id);
			this.clearDevelopmentCopy(resolved.id);
			this.releaseHold(resolved.id);
			this.emit('uninstalled', resolved);
		} catch (error) {
			this.fail('delete', resolved.id, error);
		}
	}

	/**
	 * @description Downloads an addon manifest and validates it for this manager.
	 * @param url The manifest URL.
	 * @returns The validated manifest.
	 */
	protected async fetchManifest(url: string): Promise<AddonManifest> {
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

	protected directoryOf(id: string): string {
		return `${this.directory}/${id}`;
	}

	/**
	 * @description Writes an addon to its on-disk folder, the same layout the loader reads at startup, so a
	 * fresh install or hot reload survives the next app launch.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's validated manifest.
	 * @param bytecode The bundle compiled for this runtime, base64-encoded, written beside the source.
	 * @param files The extra files beside the bundle, such as images, by path; the ones on disk stay when omitted.
	 */
	protected async persist(
		bundle: string,
		manifest: AddonManifest,
		bytecode?: string,
		files?: AddonFiles,
	): Promise<void> {
		const dir = this.directoryOf(manifest.id);
		const bytecodeVersion = getLoader()?.bytecodeVersion;

		await fs.writeFile(`${dir}/manifest.json`, JSON.stringify(manifest));
		await fs.writeFile(`${dir}/${manifest.main}`, bundle);

		if (bytecode && bytecodeVersion) {
			const path = `${dir}/${getBytecodePath(manifest.main, bytecodeVersion)}`;

			await fs.writeFile(path, bytecode, 'base64');
		}

		if (files) {
			await writeAddonFiles(dir, manifest, files);
		}
	}

	/**
	 * @description Marks an addon as a development copy pushed from a dev machine, so update checks leave it alone until it is installed from the store again.
	 * @param id The addon's id.
	 */
	markDevelopmentCopy(id: string): void {
		this.development.set(id, true);
	}

	/**
	 * @description Whether an addon is a development copy pushed from a dev machine.
	 * @param id The addon's id.
	 * @returns `true` until the addon is installed from the store or deleted.
	 */
	isDevelopmentCopy(id: string): boolean {
		return this.development.get(id) === true;
	}

	/**
	 * @description Stops treating an addon as a development copy, removing the marker `ubd device install` leaves, so update checks include it again.
	 * @param id The addon's id.
	 */
	clearDevelopmentCopy(id: string): void {
		void fs.removeFile(this.developmentMarkerOf(id)).catch(() => undefined);
		this.development.delete(id);
	}

	/**
	 * @description Holds an addon at a version the user chose, so automatic updates leave it there until they update it themselves.
	 * @param id The addon's id.
	 * @param version The version to hold it at.
	 */
	holdVersion(id: string, version: string): void {
		this.held.set(id, version);
	}

	/**
	 * @description The version an addon is held at, counted only while that version is the installed one.
	 * @param id The addon's id.
	 * @returns The held version, or `undefined` when it is not held or runs another version.
	 */
	getHeldVersion(id: string): string | undefined {
		const held = this.held.get(id);

		return held !== void 0 && held === this.getAddon(id)?.version ? held : void 0;
	}

	/**
	 * @description Stops holding an addon at a version, so automatic updates include it again.
	 * @param id The addon's id.
	 */
	releaseHold(id: string): void {
		this.held.delete(id);
	}

	getSources(): Record<string, string> {
		return this.sources.all();
	}

	/**
	 * @description Records the URL an addon was installed from. Twin of {@link forgetSource}.
	 * @param id The addon's id.
	 * @param url The install URL.
	 */
	recordSource(id: string, url: string): void {
		this.sources.set(id, url);
	}

	/**
	 * @description Forgets the URL an addon was installed from. Twin of {@link recordSource}.
	 * @param id The addon's id.
	 */
	forgetSource(id: string): void {
		this.sources.delete(id);
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
