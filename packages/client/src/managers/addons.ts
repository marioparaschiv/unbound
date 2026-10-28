import type {
	Addon,
	AddonManifest,
	NativePluginCapability,
	PluginContext,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import type { AddonRelease } from '@unbound-app/contracts/updates';
import toError from '@unbound-app/utils/to-error';
import sha256 from '@unbound-app/utils/sha256';
import noop from '@unbound-app/utils/noop';

import {
	NativePlatform,
	NativePluginCapabilityError,
	NativePluginPlatformError,
	NativePluginUnsupportedPlatformError,
	validateNativePluginRequirements,
} from '~/api/native-runtime';
import {
	beginAddonStart,
	crashDisabledNotice,
	crashedAddon,
	finishAddonStart,
	withAddonAttribution,
} from '~/api/crash-guard';
import { compiledBundlePath, isSafeAddonId, isSafeAddonMain } from '~/lib/addon-paths';
import { consentCapabilities, consentKey, needsConsent } from '~/lib/native-consent';
import type { AddonAttribution, AddonFreeze } from '~/api/crash-guard';
import type { CrashReportAddon } from '~/lib/crash-reports';
import type { NativeConsents } from '~/lib/native-consent';
import { Manager, ManagerType } from '~/managers/base';
import { unpatchAllByCaller } from '~/api/patcher';
import { reportCrash } from '~/lib/crash-reports';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';
import fs from '~/api/fs';

type AddonResolveable = string | Addon;

const managerDirectories: Record<ManagerType, string> = {
	[ManagerType.PLUGINS]: 'Plugins',
	[ManagerType.THEMES]: 'Themes',
	[ManagerType.ICONS]: 'Icons',
	[ManagerType.FONTS]: 'Fonts',
};

/** The outcome of {@link Addons.reload}: success, or failure carrying the recorded error. */
export type ReloadResult = { ok: true } | { ok: false; error: Error };

/** A single freeze at least this long disables the addon at once. */
export const LONG_FREEZE_SECONDS = 20;

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
	updated: (entity: T) => void;
	'update-error': (entity: T, error: Error) => void;
	deleted: (entity: T) => void;
	'consent-required': (entity: T) => void;
};

/** Asks the user whether an addon may use consent-gated capabilities; resolves to their answer. */
export type ConsentPrompt = (
	addon: Addon,
	capabilities: readonly NativePluginCapability[],
) => Promise<boolean>;

let consentPrompt: ConsentPrompt | undefined;

/**
 * @description Registers how the UI asks for consent before an addon gets direct native access.
 * @param prompt The prompt, or `undefined` to refuse every request.
 */
export function setConsentPrompt(prompt: ConsentPrompt | undefined): void {
	consentPrompt = prompt;
}

/** Thrown when an addon asks for direct native access the user has not allowed. */
export class NativeConsentRequiredError extends Error {
	constructor(name: string) {
		super(`${name} needs your permission for direct native access.`);
		this.name = 'NativeConsentRequiredError';
	}
}

function monotonicNow(): number {
	return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * @description Shared lifecycle manager for addons (plugins and themes), extending {@link Manager}.
 * Implements the load/unload, start/stop, and enable/disable operations common to every addon kind.
 * @template T The addon entity type this manager governs.
 */
export abstract class Addons<T extends Addon> extends Manager<T, AddonEvents<T>> {
	startDurations = new Map<string, number>();
	private freezes = new Map<string, number>();
	private pendingStops = new Map<string, Promise<void>>();
	private pendingStarts = new Set<string>();
	protected stopTimeoutMs = 5000;

	async shutdown(): Promise<void> {
		this.pendingStarts.clear();
		const pending = [...this.pendingStops.values()];
		const stops = this.getEntities().map((entity) => this.stop(entity));

		try {
			await Promise.all([...pending, ...stops]);
		} finally {
			this.pendingStops.clear();
			this.pendingStarts.clear();
			super.shutdown();
		}
	}

	/**
	 * @description Evaluates an addon's bundle source into a running instance. Implemented by each subclass.
	 * @param bundle The addon's bundle source.
	 * @param id The addon's id.
	 * @returns The addon's instance.
	 */
	protected abstract handleBundle(bundle: string, id: string): T['instance'];

	/** The manifest `type` value this manager installs; used to reject mismatched installs. */
	protected abstract get entityType(): NonNullable<AddonManifest['type']>;

	protected createContext(entity: T): PluginContext | undefined {
		void entity;

		return undefined;
	}

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

			if (states[manifest.id] && !this.disableAfterCrash(entity as T)) {
				this.start(entity);
			}

			this.emit('loaded', entity as T);
		} catch (error) {
			this.logger.error(`Failed to load addon ${manifest.id}:`, error);
			this.errors.set(manifest.id, toError(error));
		}
	}

	/**
	 * @description Unloads an addon from the manager, stopping it if running, and emits `unloaded`.
	 * @param entity The addon to unload, as its id or the entity itself.
	 */
	unload(entity: AddonResolveable): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			this.pendingStarts.delete(resolved.id);
			const stopping = this.stop(resolved);

			if (stopping) {
				return stopping.then(() => this.finishUnload(resolved));
			}

			this.finishUnload(resolved);
		} catch (error) {
			this.logger.error(`Failed to unload addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	private finishUnload(resolved: T): void {
		if (this.entities.get(resolved.id) !== resolved) return;

		try {
			this.entities.delete(resolved.id);
			this.errors.delete(resolved.id);
			this.emit('unloaded', resolved);
		} catch (error) {
			const failure = toError(error);

			this.logger.error(`Failed to unload addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);
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

		// Everything past here keys off `manifest.id`, so a mismatch would install a second addon under
		// the new id and leave the old one running. A hot swap can't rename an addon.
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
				const failure = toError(error);

				this.logger.error(`Failed to reload addon ${manifest.id}:`, failure);
				this.errors.set(manifest.id, failure);

				return { ok: false, error: failure };
			}
		}

		try {
			this.validateManifest(manifest);

			// Restart only what was running, mirroring enable/disable: a save must not start an addon the
			// user has explicitly disabled.
			const wasStarted = resolved.started || this.pendingStarts.has(resolved.id);

			await this.persist(bundle, manifest);

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
			const failure = toError(error);

			this.logger.error(`Failed to reload addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);
			this.emit('reload-error', resolved, failure);

			return { ok: false, error: failure };
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
			const manifest = await this.fetchManifest(url);
			const origin = url.split('/').slice(0, -1).join('/');
			const bundleUrl = new URL(manifest.main, `${origin}/`).toString();
			const [bundle, bytecode] = await Promise.all([
				this.fetchBundle(bundleUrl),
				this.fetchBytecode(manifest, bundleUrl),
			]);
			const trusted = this.verifySignature(manifest, bundle, this.getEntity(manifest.id));

			await this.persist(bundle, trusted);
			await this.persistBytecode(trusted, bytecode);

			this.load(bundle, trusted);
			const entity = this.getEntity(manifest.id);

			if (entity) {
				this.recordSource(entity.id, url);
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
				this.fetchBundle(update.bundleUrl),
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
				this.verifySignature(manifest, bundle, resolved),
			);

			if (!result.ok) {
				this.emit('update-error', resolved, result.error);

				return;
			}

			await this.persistBytecode(manifest, bytecode);

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
			this.emit('deleted', resolved);
		} catch (error) {
			this.logger.error(`Failed to delete addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Starts an addon, evaluating its bundle into an instance, running it, and emits `started`.
	 * @param entity The addon to start, as its id or the entity itself.
	 * @param consented Whether the user just allowed its consent-gated capabilities.
	 */
	start(entity: AddonResolveable, consented = false) {
		const resolved = this.resolve(entity);

		if (!resolved || resolved.started) return;

		if (this.pendingStops.has(resolved.id)) {
			this.pendingStarts.add(resolved.id);

			return;
		}

		this.pendingStarts.delete(resolved.id);

		if (!consented && needsConsent(resolved.data, this.getConsents())) {
			const error = new NativeConsentRequiredError(resolved.data.name);

			this.logger.warn(error.message);
			this.errors.set(resolved.id, error);
			this.emit('consent-required', resolved);

			return;
		}

		const recoveryMode = storage.get('unbound', 'recovery', false);
		const guardKey = this.crashGuardKey(resolved.id);
		const startedAt = monotonicNow();

		if (!recoveryMode) {
			beginAddonStart(guardKey, resolved.data.name);
		}

		try {
			const attribution = this.attribution(resolved);

			if (recoveryMode) {
				resolved.instance = { start: noop, stop: noop };
			} else {
				const instance = withAddonAttribution(attribution, () =>
					this.handleBundle(resolved.bundle, resolved.id),
				);

				resolved.instance = instance;
			}

			resolved.context = this.createContext(resolved);
			const context = resolved.context;

			withAddonAttribution(attribution, () => resolved.instance?.start?.(context));
			resolved.started = true;
			this.startDurations.set(resolved.id, monotonicNow() - startedAt);

			this.emit('started', resolved);
		} catch (error) {
			resolved.context?.dispose();
			resolved.context = undefined;
			this.logger.error(`Failed to start addon ${resolved.id}:`, error);
			const failure = toError(error);

			this.errors.set(resolved.id, failure);
			resolved.failed = true;
			void reportCrash({
				kind: 'start-failure',
				phase: 'starting',
				addon: this.reportedAddon(resolved),
				message: failure.message,
				stack: failure.stack,
			});
		} finally {
			if (!recoveryMode) {
				finishAddonStart(guardKey);
			}
		}
	}

	/**
	 * @description Handles a freeze the loader attributed to an addon: tells the user, and disables the
	 * addon after its second freeze this session or after one that lasted {@link LONG_FREEZE_SECONDS}.
	 * @param freeze The freeze the loader reported.
	 */
	handleFreeze(freeze: AddonFreeze): void {
		const entity = this.getEntities().find(
			(candidate) => this.crashGuardKey(candidate.id) === freeze.id,
		);

		if (!entity) return;

		const count = (this.freezes.get(entity.id) ?? 0) + 1;
		const seconds = Math.round(freeze.seconds);
		const disable = count >= 2 || freeze.seconds >= LONG_FREEZE_SECONDS;

		this.freezes.set(entity.id, count);
		void reportCrash({
			kind: 'freeze',
			phase: 'frozen',
			addon: this.reportedAddon(entity),
			seconds: freeze.seconds,
		});
		this.logger.warn(
			`${entity.data.name} froze Discord for ${seconds} seconds (freeze ${count} this session).`,
		);

		if (disable) {
			this.disable(entity);
		}

		showToast({
			title: entity.data.name,
			content: disable
				? `Disabled ${entity.data.name} because it froze Discord for ${seconds} seconds.`
				: `${entity.data.name} froze Discord for ${seconds} seconds.`,
		});
	}

	/**
	 * @description Describes an addon in a crash report.
	 * @param entity The addon.
	 * @returns Its id, version and whether it is signed.
	 */
	private reportedAddon(entity: T): CrashReportAddon {
		return {
			id: entity.id,
			version: entity.data.version,
			trust: Reflect.get(entity.data, 'trust') === 'signed' ? 'signed' : 'unsigned',
		};
	}

	/**
	 * @description Returns how the loader attributes an addon's code to it, so a crash or freeze inside it
	 * disables that addon. Only plugins run code, so other kinds return `undefined`.
	 * @param _entity The addon.
	 * @returns The attribution wrapper, or `undefined`.
	 */
	protected attribution(_entity: T): AddonAttribution | undefined {
		return undefined;
	}

	/**
	 * @description Names an addon in the loader's crash guard, unique across addon kinds.
	 * @param id The addon's id.
	 * @returns The crash guard key.
	 */
	protected crashGuardKey(id: string): string {
		return `${ManagerType[this.type].toLowerCase()}:${id}`;
	}

	/**
	 * @description Persistently disables an addon the loader reported crashing Discord on consecutive launches.
	 * @param entity The addon about to start.
	 * @returns Whether the addon was disabled instead of started.
	 */
	private disableAfterCrash(entity: T): boolean {
		const crashed = crashedAddon(this.crashGuardKey(entity.id));

		if (!crashed) {
			return false;
		}

		const states = this.getStates();

		states[entity.id] = false;
		this.settings.set('states', states);
		void storage.persist();

		this.logger.warn(crashDisabledNotice(crashed, entity.data.name));
		void reportCrash({
			kind: crashed.phase === 'frozen' ? 'freeze' : 'crash',
			phase: crashed.phase ?? 'starting',
			addon: this.reportedAddon(entity),
		});

		return true;
	}

	/**
	 * @description Stops an addon, tearing down its instance, and emits `stopped`.
	 * @param entity The addon to stop, as its id or the entity itself.
	 */
	stop(entity: AddonResolveable): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		this.pendingStarts.delete(resolved.id);

		if (!resolved.started) {
			return this.pendingStops.get(resolved.id);
		}

		const instance = resolved.instance;
		const context = resolved.context;

		resolved.instance = null;
		resolved.context = undefined;
		resolved.started = false;

		try {
			const result = withAddonAttribution(this.attribution(resolved), () =>
				instance?.stop?.(),
			);

			if (result && typeof result.then === 'function') {
				let timer: ReturnType<typeof setTimeout> | undefined;
				const timeout = new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error(`Addon ${resolved.id} cleanup timed out`)),
						this.stopTimeoutMs,
					);
				});
				let stopped = false;

				const pending = Promise.race([Promise.resolve(result), timeout])
					.then(
						() => {
							stopped = this.finishStop(resolved, context);
						},
						(error) => {
							this.finishStop(resolved, context, toError(error));
						},
					)
					.finally(() => {
						if (timer) {
							clearTimeout(timer);
						}

						if (this.pendingStops.get(resolved.id) === pending) {
							this.pendingStops.delete(resolved.id);
						}

						const shouldRestart = this.pendingStarts.delete(resolved.id);

						if (stopped && shouldRestart && this.getStates()[resolved.id]) {
							this.start(resolved);
						}
					});

				this.pendingStops.set(resolved.id, pending);

				return pending;
			}

			this.finishStop(resolved, context);
		} catch (error) {
			this.finishStop(resolved, context, toError(error));
		}
	}

	private finishStop(resolved: T, context: PluginContext | undefined, error?: Error): boolean {
		try {
			context?.dispose();
		} catch (disposeError) {
			error ??= toError(disposeError);
		}

		try {
			unpatchAllByCaller(resolved.id);
		} catch (unpatchError) {
			error ??= toError(unpatchError);
		}

		if (error) {
			const failure = toError(error);

			this.logger.error(`Failed to stop addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);

			return false;
		}

		try {
			this.emit('stopped', resolved);

			return true;
		} catch (emitError) {
			const failure = toError(emitError);

			this.logger.error(`Failed to stop addon ${resolved.id}:`, failure);
			this.errors.set(resolved.id, failure);

			return false;
		}
	}

	/**
	 * @description Enables an addon, persisting its state and starting it if not already running, and emits `enabled`.
	 * @param entity The addon to enable, as its id or the entity itself.
	 */
	enable(entity: AddonResolveable): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		if (needsConsent(resolved.data, this.getConsents())) {
			return this.requestConsent(resolved).then((granted) => {
				if (granted) {
					this.enableNow(resolved, true);
				}
			});
		}

		this.enableNow(resolved, false);
	}

	private enableNow(resolved: T, consented: boolean): void {
		try {
			const states = this.getStates();

			states[resolved.id] = true;
			this.settings.set('states', states);

			if (!resolved.started) {
				this.start(resolved, consented);
			}

			this.emit('enabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to enable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
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
			this.pendingStarts.delete(resolved.id);
			const states = this.getStates();

			states[resolved.id] = false;
			this.settings.set('states', states);

			if (resolved.started) {
				this.stop(resolved);
			}

			this.emit('disabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to disable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Reads the consents the user gave for consent-gated capabilities.
	 * @returns The consents keyed by addon id.
	 */
	protected getConsents(): NativeConsents {
		const consents: NativeConsents = this.settings.get('consents', {});

		return consents;
	}

	/**
	 * @description Asks the user to allow an addon's consent-gated capabilities and records the answer.
	 * @param entity The addon asking.
	 * @returns Whether the user allowed it.
	 */
	protected async requestConsent(entity: T): Promise<boolean> {
		const capabilities = consentCapabilities(entity.data);
		const granted = consentPrompt
			? await consentPrompt(entity, capabilities).catch(() => false)
			: false;

		if (!granted) {
			this.errors.set(entity.id, new NativeConsentRequiredError(entity.data.name));

			return false;
		}

		this.settings.set('consents', {
			...this.getConsents(),
			[entity.id]: consentKey(entity.data),
		});
		this.errors.delete(entity.id);

		return true;
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
	 * @description Downloads an addon manifest and validates it for this manager.
	 * @param url The manifest URL.
	 * @returns The validated manifest.
	 */
	private async fetchManifest(url: string): Promise<AddonManifest> {
		const res = await fetch(url, { cache: 'no-cache' });

		if (!res.ok) {
			throw new Error(`Failed to fetch manifest (${res.status}).`);
		}

		const manifest: AddonManifest = await res.json();

		this.validateManifest(manifest);

		if (manifest.type && manifest.type !== this.entityType) {
			throw new Error(`Expected a ${this.entityType} manifest, got ${manifest.type}.`);
		}

		return manifest;
	}

	/**
	 * @description Downloads an addon bundle.
	 * @param url The bundle URL.
	 * @returns The bundle source.
	 */
	/**
	 * @description Checks a downloaded addon's signature against the keys compiled into the loader and
	 * records the result as `trust`. A bundle whose signature does not match, or an unsigned bundle
	 * replacing a signed one, is refused.
	 * @param manifest The downloaded manifest.
	 * @param bundle The downloaded bundle.
	 * @param installed The installed copy the download replaces, if any.
	 * @returns The manifest with `trust` set.
	 */
	protected verifySignature(
		manifest: AddonManifest,
		bundle: string,
		installed?: T,
	): AddonManifest {
		const addons = globalThis.NativePlatform?.addons;
		const { trust: _ignored, ...rest } = manifest;

		if (!addons) {
			return { ...rest, trust: 'unsigned' };
		}

		const result = addons.verify(JSON.stringify(rest), bundle);

		if (result.status === 'invalid') {
			throw new Error(
				`Refused ${manifest.id}: ${result.problem ?? 'its signature does not match'}.`,
			);
		}

		if (result.status === 'unsigned' && installed?.data.trust === 'signed') {
			throw new Error(
				`Refused ${manifest.id}: the installed version is signed but this one is not.`,
			);
		}

		return { ...rest, trust: result.status };
	}

	private async fetchBytecode(
		manifest: AddonManifest,
		bundleUrl: string,
	): Promise<string | undefined> {
		const bytecodeVersion = globalThis.UNBOUND_LOADER?.bytecodeVersion;

		if (!bytecodeVersion || !manifest.bytecode?.[String(bytecodeVersion)]) return;

		try {
			const res = await fetch(compiledBundlePath(bundleUrl, bytecodeVersion), {
				cache: 'no-cache',
			});

			if (!res.ok) {
				throw new Error(`status ${res.status}`);
			}

			return Buffer.from(await res.arrayBuffer()).toString('base64');
		} catch (error) {
			this.logger.warn(
				`Failed to fetch the bytecode of ${manifest.id}, it will run from source:`,
				error,
			);

			return undefined;
		}
	}

	private async fetchBundle(url: string): Promise<string> {
		const res = await fetch(url, { cache: 'no-cache' });

		if (!res.ok) {
			throw new Error(`Failed to fetch bundle (${res.status}).`);
		}

		return res.text();
	}

	/**
	 * @description Names an addon's on-disk folder, matching the case the loader scans on case-sensitive file systems.
	 * @param id The addon's id.
	 * @returns The folder path relative to the documents directory.
	 */
	protected directoryOf(id: string): string {
		return `Unbound/${managerDirectories[this.type]}/${id}`;
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

		if (!isSafeAddonId(manifest.id)) {
			throw new Error('Manifest id must be alphanumeric segments joined by ".", "_" or "-"');
		}

		if (!isSafeAddonMain(manifest.main)) {
			throw new Error('Manifest main must be a relative path inside the addon');
		}

		if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
			throw new Error('Manifest authors must be a non-empty array');
		}

		if (manifest.capabilities !== undefined && !Array.isArray(manifest.capabilities)) {
			throw new Error('Manifest capabilities must be an array');
		}

		if (manifest.platforms !== undefined) {
			if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
				throw new Error('Manifest platforms must be a non-empty array');
			}

			for (const platform of manifest.platforms as readonly string[]) {
				if (platform !== 'ios' && platform !== 'android') {
					throw new Error(`Manifest platforms has unsupported platform: ${platform}`);
				}
			}
		}

		if (
			manifest.platformCapabilities !== undefined &&
			(typeof manifest.platformCapabilities !== 'object' ||
				manifest.platformCapabilities === null ||
				Array.isArray(manifest.platformCapabilities))
		) {
			throw new Error('Manifest platformCapabilities must be an object');
		}

		for (const [platform, capabilities] of Object.entries(
			manifest.platformCapabilities ?? {},
		)) {
			if (platform !== 'ios' && platform !== 'android') {
				throw new Error(
					`Manifest platformCapabilities has unsupported platform: ${platform}`,
				);
			}

			if (!Array.isArray(capabilities)) {
				throw new Error(`Manifest platformCapabilities.${platform} must be an array`);
			}

			const unsupported = capabilities.find(
				(capability) => !NATIVE_PLUGIN_CAPABILITIES.includes(capability),
			);

			if (unsupported) {
				throw new NativePluginCapabilityError(unsupported);
			}
		}

		const currentPlatform = NativePlatform?.device.platform ?? NativePlatform?.platform;

		if (manifest.platforms?.length && !manifest.platforms.includes(currentPlatform as never)) {
			throw new NativePluginUnsupportedPlatformError(
				manifest.platforms,
				String(currentPlatform),
			);
		}

		const hasPlatformRequirements = Object.keys(manifest.platformCapabilities ?? {}).length > 0;

		if (hasPlatformRequirements && currentPlatform !== 'ios' && currentPlatform !== 'android') {
			throw new NativePluginPlatformError();
		}

		if (manifest.unbound !== undefined) {
			if (typeof manifest.unbound !== 'object' || manifest.unbound === null) {
				throw new Error('Manifest unbound must be an object');
			}

			if (manifest.unbound.min !== undefined && typeof manifest.unbound.min !== 'string') {
				throw new Error('Manifest unbound.min must be a version string');
			}
		}

		if (
			!manifest.capabilities &&
			!manifest.minNativePluginApi &&
			!manifest.platformCapabilities
		) {
			return;
		}

		const capabilities = [
			...(manifest.capabilities ?? []),
			...(currentPlatform === 'ios' || currentPlatform === 'android'
				? (manifest.platformCapabilities?.[currentPlatform] ?? [])
				: []),
		];

		validateNativePluginRequirements(capabilities, manifest.minNativePluginApi);
	}
}
