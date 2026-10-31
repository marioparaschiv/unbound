import type { AddonManifest, PluginContext, Plugin } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';

import {
	beginAddonStart,
	crashDisabledNotice,
	crashedAddon,
	crashGuardKey,
	finishAddonStart,
	withAddonAttribution,
} from '~/api/crash-guard';
import {
	consentKey,
	needsConsent,
	NativeConsentRequiredError,
	promptForConsent,
} from '~/lib/native-consent';
import { currentPlatform, validateNativePluginRequirements } from '~/api/native-runtime';
import { parseAddonManifest, resolveManifestCapabilities } from '~/lib/addon-manifest';
import type { AddonAttribution, AddonFreeze } from '~/api/crash-guard';
import type { CrashReportAddon } from '~/lib/crash-reports';
import type { NativeConsents } from '~/lib/native-consent';
import type { AddonEvents, AddonResolveable, AddonState } from '~/managers/addon';
import { isSafeAddonMain } from '~/lib/addon-paths';
import { getSetting } from '~/lib/unbound-settings';
import { unpatchAllByCaller } from '~/api/patcher';
import { reportCrash } from '~/lib/crash-reports';
import { Manager } from '~/managers/base';
import { showToast } from '~/api/toasts';
import { Addon } from '~/managers/addon';
import storage from '~/api/storage';

/** A single freeze at least this long disables the addon at once. */
const LONG_FREEZE_SECONDS = 20;

function monotonicNow(): number {
	return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * @description Runtime lifecycle shared by every addon kind: load/unload, start/stop, enable/disable,
 * consent, and freeze/crash handling. {@link Addons} layers distribution on top.
 * @template I What the bundles of the addons this manager governs evaluate to.
 */
export abstract class AddonLifecycle<I extends object> extends Manager<
	Addon<I>,
	AddonEvents<Addon<I>>
> {
	startDurations = new Map<string, number>();
	private freezes = new Map<string, number>();
	protected pendingStops = new Map<string, Promise<void>>();
	protected pendingStarts = new Set<string>();
	protected stopTimeoutMs = 5000;
	private readonly records = new WeakMap<Addon<I>, AddonState<I>>();

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
	protected abstract handleBundle(bundle: string, id: string): (Plugin & I) | null;

	protected createAddon(manifest: AddonManifest, bundle: string): Addon<I> {
		const state: AddonState<I> = {
			manifest,
			bundle,
			instance: null,
			context: void 0,
			started: false,
			failed: false,
		};
		const addon = new Addon<I>(state, this);

		this.records.set(addon, state);

		return addon;
	}

	protected stateOf(addon: Addon<I>): AddonState<I> {
		const state = this.records.get(addon);

		if (!state) {
			throw new Error(`Addon ${addon.id} is not governed by ${this.name}.`);
		}

		return state;
	}

	protected clearFailure(addon: Addon<I>): void {
		this.stateOf(addon).failed = false;
		this.errors.delete(addon.id);
	}

	protected createContext(entity: Addon<I>): PluginContext | undefined {
		void entity;

		return undefined;
	}

	/**
	 * @description Validates an addon the loader read from disk, then registers it through {@link register}.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's manifest, as the loader read it.
	 */
	load(bundle: string, manifest: AddonManifest) {
		try {
			this.validateManifest(manifest);
		} catch (error) {
			this.logger.error(`Failed to load addon ${manifest.id}:`, error);
			this.errors.set(manifest.id, toError(error));

			return;
		}

		this.register(bundle, manifest);
	}

	/**
	 * @description Adds an addon with a validated manifest to the manager, starting it if its stored
	 * state is enabled, and emits `loaded`.
	 * @param bundle The addon's bundle source.
	 * @param manifest The addon's validated manifest.
	 */
	protected register(bundle: string, manifest: AddonManifest) {
		try {
			const entity = this.createAddon(manifest, bundle);

			this.entities.set(manifest.id, entity);
			this.registered(manifest.id);

			const states = this.getStates();

			if (states[manifest.id] && !this.disableAfterCrash(entity)) {
				this.start(entity);
			}

			this.emit('loaded', entity);
		} catch (error) {
			this.logger.error(`Failed to load addon ${manifest.id}:`, error);
			this.errors.set(manifest.id, toError(error));
		}
	}

	/**
	 * @description Runs once an addon is in the manager, before it starts.
	 * @param _id The addon's id.
	 */
	protected registered(_id: string): void {
		// No.
	}

	/**
	 * @description Unloads an addon from the manager, stopping it if running, and emits `unloaded`.
	 * @param entity The addon to unload, as its id or the entity itself.
	 */
	unload(entity: AddonResolveable<I>): void | Promise<void> {
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

	private finishUnload(resolved: Addon<I>): void {
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
	 * @description Starts an addon, evaluating its bundle into an instance, running it, and emits `started`.
	 * @param entity The addon to start, as its id or the entity itself.
	 * @param consented Whether the user just allowed its consent-gated capabilities.
	 */
	start(entity: AddonResolveable<I>, consented = false) {
		const resolved = this.resolve(entity);

		if (!resolved || resolved.started) return;

		if (this.pendingStops.has(resolved.id)) {
			this.pendingStarts.add(resolved.id);

			return;
		}

		this.pendingStarts.delete(resolved.id);

		if (!consented && needsConsent(resolved.manifest, this.getConsents())) {
			const error = new NativeConsentRequiredError(resolved.name);

			this.logger.warn(error.message);
			this.errors.set(resolved.id, error);
			this.emit('consent-required', resolved);

			return;
		}

		const recoveryMode = getSetting('recovery');
		const guardKey = crashGuardKey(this.bucket, resolved.id);
		const startedAt = monotonicNow();

		if (!recoveryMode) {
			beginAddonStart(guardKey, resolved.name);
		}

		const state = this.stateOf(resolved);

		try {
			const attribution = this.attribution(resolved);

			state.instance = recoveryMode
				? null
				: withAddonAttribution(attribution, () =>
						this.handleBundle(state.bundle, resolved.id),
					);

			state.context = this.createContext(resolved);
			const context = state.context;

			withAddonAttribution(attribution, () => state.instance?.start?.(context));
			state.started = true;
			this.startDurations.set(resolved.id, monotonicNow() - startedAt);

			this.emit('started', resolved);
		} catch (error) {
			state.context?.dispose();
			state.context = undefined;
			this.logger.error(`Failed to start addon ${resolved.id}:`, error);
			const failure = toError(error);

			this.errors.set(resolved.id, failure);
			state.failed = true;
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
			(candidate) => crashGuardKey(this.bucket, candidate.id) === freeze.id,
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
			...(freeze.detail ? { message: freeze.detail } : {}),
			...(freeze.stack ? { stack: freeze.stack } : {}),
		});
		const detail = freeze.detail ? ` ${freeze.detail}` : '';
		const stack = freeze.stack ? `\n${freeze.stack}` : '';

		this.logger.warn(
			`${entity.name} froze Discord for ${seconds} seconds (freeze ${count} this session).${detail}${stack}`,
		);

		if (disable) {
			this.disable(entity);
		}

		showToast({
			title: entity.name,
			content: disable
				? `Disabled ${entity.name} because it froze Discord for ${seconds} seconds.${detail}`
				: `${entity.name} froze Discord for ${seconds} seconds.${detail}`,
		});
	}

	/**
	 * @description Describes an addon in a crash report.
	 * @param entity The addon.
	 * @returns Its id, version and whether it is signed.
	 */
	private reportedAddon(entity: Addon<I>): CrashReportAddon {
		return {
			id: entity.id,
			version: entity.version,
			trust: entity.manifest.trust === 'signed' ? 'signed' : 'unsigned',
		};
	}

	/**
	 * @description Returns how the loader attributes an addon's code to it, so a crash or freeze inside it
	 * disables that addon. Only plugins run code, so other kinds return `undefined`.
	 * @param _entity The addon.
	 * @returns The attribution wrapper, or `undefined`.
	 */
	protected attribution(_entity: Addon<I>): AddonAttribution | undefined {
		return undefined;
	}

	/**
	 * @description Persistently disables an addon the loader reported crashing Discord on consecutive launches.
	 * @param entity The addon about to start.
	 * @returns Whether the addon was disabled instead of started.
	 */
	private disableAfterCrash(entity: Addon<I>): boolean {
		const crashed = crashedAddon(crashGuardKey(this.bucket, entity.id));

		if (!crashed) {
			return false;
		}

		const states = this.getStates();

		states[entity.id] = false;
		this.settings.set('states', states);
		void storage.persist();

		this.logger.warn(crashDisabledNotice(crashed, entity.name));
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
	stop(entity: AddonResolveable<I>): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		this.pendingStarts.delete(resolved.id);

		if (!resolved.started) {
			return this.pendingStops.get(resolved.id);
		}

		const state = this.stateOf(resolved);
		const { instance, context } = state;

		state.instance = null;
		state.context = undefined;
		state.started = false;

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

	private finishStop(
		resolved: Addon<I>,
		context: PluginContext | undefined,
		error?: Error,
	): boolean {
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
	 * @description Stops a running addon and starts it again on the same bundle. An addon that isn't running stays stopped.
	 * @param entity The addon to restart, as its id or the entity itself.
	 */
	async restart(entity: AddonResolveable<I>): Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved?.started) return;

		await this.stop(resolved);
		this.clearFailure(resolved);
		this.start(resolved);
	}

	/**
	 * @description Enables an addon, persisting its state and starting it if not already running, and emits `enabled`.
	 * @param entity The addon to enable, as its id or the entity itself.
	 */
	enable(entity: AddonResolveable<I>): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		if (needsConsent(resolved.manifest, this.getConsents())) {
			return this.requestConsent(resolved).then((granted) => {
				if (granted) {
					this.enableNow(resolved, true);
				}
			});
		}

		this.enableNow(resolved, false);
	}

	private enableNow(resolved: Addon<I>, consented: boolean): void {
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
	disable(entity: AddonResolveable<I>) {
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
		return this.settings.get<NativeConsents>('consents', {});
	}

	/**
	 * @description Asks the user to allow an addon's consent-gated capabilities and records the answer.
	 * @param entity The addon asking.
	 * @returns Whether the user allowed it.
	 */
	protected async requestConsent(entity: Addon<I>): Promise<boolean> {
		const granted = await promptForConsent(entity).catch((error) => {
			this.logger.error(`Failed to ask for consent for ${entity.id}:`, error);

			return false;
		});

		if (!granted) {
			this.errors.set(entity.id, new NativeConsentRequiredError(entity.name));

			return false;
		}

		this.settings.set('consents', {
			...this.getConsents(),
			[entity.id]: consentKey(entity.manifest),
		});
		this.errors.delete(entity.id);

		return true;
	}

	/**
	 * @description Toggles an addon between enabled and disabled based on its current state, and emits `toggled`.
	 * @param entity The addon to toggle, as its id or the entity itself.
	 */
	toggle(entity: AddonResolveable<I>) {
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
	protected resolve(entity: AddonResolveable<I>): Addon<I> | undefined {
		if (typeof entity === 'string') {
			return this.entities.get(entity) ?? this.getByName(entity);
		}

		return entity;
	}

	/**
	 * @description Finds a governed addon by its manifest name.
	 * @param name The name to search for.
	 * @returns The matching entity, or `undefined` if none is found.
	 */
	protected getByName(name: string): Addon<I> | undefined {
		for (const entity of this.entities.values()) {
			if (entity.name === name) {
				return entity;
			}
		}
	}

	/**
	 * @description Whether the user has an addon enabled.
	 * @param id The addon's id.
	 * @returns Its persisted enabled state.
	 */
	isEnabled(id: string): boolean {
		return Boolean(this.getStates()[id]);
	}

	/**
	 * @description Reads the persisted enabled/disabled state map for this manager's addons.
	 * @returns A record of addon id to its enabled state.
	 */
	protected getStates(): Record<string, boolean> {
		return this.settings.get('states', {});
	}

	/**
	 * @description Checks a manifest's `main` before the addon is installed or loaded.
	 * @param main The manifest's `main`.
	 * @returns Whether it is a relative path inside the addon's folder.
	 */
	protected isAcceptableMain(main: unknown): main is string {
		return isSafeAddonMain(main);
	}

	/**
	 * @description Parses a manifest from the loader, the network or the debugger socket, and checks this
	 * host can run it: its platform and the native capabilities and API version it needs.
	 * @param manifest The manifest as read from JSON.
	 * @returns The validated manifest.
	 */
	// UNKNOWN: manifests arrive as JSON from the loader, the network and the debugger socket.
	protected validateManifest(manifest: unknown): AddonManifest {
		const parsed = parseAddonManifest(manifest, (main) => this.isAcceptableMain(main));
		const capabilities = resolveManifestCapabilities(parsed, currentPlatform());

		validateNativePluginRequirements(capabilities, parsed.minNativePluginApi);

		return parsed;
	}
}
