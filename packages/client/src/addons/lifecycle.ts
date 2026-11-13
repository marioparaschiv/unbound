import type { AddonManifest, PluginContext, Plugin } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';

import {
	beginAddonStart,
	crashGuardKey,
	finishAddonStart,
	withAddonAttribution,
	runAsAddon,
} from '~/addons/crash-guard';
import type { AddonAttribution, AddonFreeze, RunningAddon } from '~/addons/crash-guard';
import { parseAddonManifest, resolveManifestCapabilities } from '~/addons/manifest';
import type { AddonEvents, AddonResolveable, AddonState } from '~/addons/addon';
import { needsConsent, NativeConsentRequiredError } from '~/native/consent';
import { validateNativeBridgeRequirements } from '~/native/capabilities';
import { announceFreeze, freezeDisables } from '~/addons/freezes';
import { crashReportAddon } from '~/diagnostics/crash-report';
import { disableIfCrashed } from '~/addons/crash-disable';
import {
	CRASH_HOLDS_KEY,
	holdAddon,
	releaseAddon,
	updatedSinceHold,
	type CrashHolds,
} from '~/addons/crash-holds';
import { show } from '~/toasts/api';
import { reportCrash } from '~/diagnostics/crash-reports';
import { beginNativeStop } from '~/native/plugin-context';
import type { NativeConsents } from '~/native/consent';
import { afterFirstFrame } from '~/core/first-frame';
import { monotonicNow } from '~/core/monotonic-now';
import { currentPlatform } from '~/native/platform';
import { unpatchAllByCaller } from '~/patcher/api';
import { isSafeAddonMain } from '~/addons/paths';
import type { AddonScope } from '~/addons/scope';
import { getSetting } from '~/settings/unbound';
import { benchSpan } from '~/core/bench-span';
import { Manager } from '~/addons/manager';
import { Addon } from '~/addons/addon';
import storage from '~/storage/api';

/**
 * @description Runtime lifecycle shared by every addon kind: load/unload, start/stop and freeze/crash
 * handling. {@link AddonSelection} decides which addons are on; {@link Addons} layers distribution on top.
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

	/**
	 * @description Whether the user has an addon on. {@link AddonSelection} decides.
	 * @param id The addon's id.
	 * @returns Its persisted state.
	 */
	abstract isEnabled(id: string): boolean;

	/**
	 * @description Turns an addon on and starts it. {@link AddonSelection} decides. Twin of {@link disable}.
	 * @param addon The addon, as its id or the addon itself.
	 * @returns Settles once the addon is on.
	 */
	abstract enable(addon: AddonResolveable<I>): void | Promise<void>;

	/**
	 * @description Turns an addon off and stops it. {@link AddonSelection} decides. Twin of {@link enable}.
	 * @param addon The addon, as its id or the addon itself.
	 */
	abstract disable(addon: AddonResolveable<I>): void;

	/**
	 * @description Starts an addon the user has on, and puts it on screen if its kind does so.
	 * @param addon The addon.
	 * @param consented Whether the user just allowed its consent-gated capabilities.
	 * @returns Settles once it is on screen.
	 */
	protected abstract activate(addon: Addon<I>, consented?: boolean): void | Promise<void>;

	/**
	 * @description Records whether the user has an addon on.
	 * @param addon The addon.
	 * @param enabled Whether it is now on.
	 */
	protected abstract select(addon: Addon<I>, enabled: boolean): void;

	/**
	 * @description Reads the consents the user gave for consent-gated capabilities.
	 * @returns The consents keyed by addon id.
	 */
	protected abstract getConsents(): NativeConsents;

	async shutdown(): Promise<void> {
		this.pendingStarts.clear();
		const pending = [...this.pendingStops.values()];
		const stops = this.getAddons().map((addon) => this.stop(addon));

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
	 * @param scope The globals {@link createScope} made for this start, if the kind has any.
	 * @returns The addon's instance.
	 */
	protected abstract handleBundle(
		bundle: string,
		id: string,
		scope: AddonScope | undefined,
	): (Plugin & I) | null;

	protected createAddon(manifest: AddonManifest, bundle: string): Addon<I> {
		const state: AddonState<I> = {
			manifest,
			bundle,
			instance: null,
			context: void 0,
			scope: void 0,
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

	/**
	 * @description Records a failed operation on an addon: logs it naming the operation and the addon,
	 * and keeps the error for the UI.
	 * @param action What the manager tried to do, such as `unload`.
	 * @param id The addon's id.
	 * @param error The value `catch` bound.
	 * @param noun What the manager calls the addon, when it is not an addon.
	 * @returns The recorded error.
	 */
	// UNKNOWN: catch binds whatever was thrown, not necessarily an Error.
	protected fail(action: string, id: string, error: unknown, noun = 'addon'): Error {
		const failure = toError(error);

		this.logger.error(`Failed to ${action} ${noun} ${id}:`, failure);
		this.errors.set(id, failure);

		return failure;
	}

	protected createContext(addon: Addon<I>): PluginContext | undefined {
		void addon;

		return undefined;
	}

	protected createScope(_addon: Addon<I>): AddonScope | undefined {
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
			this.fail('load', manifest.id, error);

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
			const addon = this.createAddon(manifest, bundle);

			this.addons.set(manifest.id, addon);
			this.registered(manifest.id);

			if (this.isEnabled(manifest.id) && !this.disableAfterCrash(addon)) {
				this.startWhenDue(addon);
			}

			this.emit('loaded', addon);
		} catch (error) {
			this.fail('load', manifest.id, error);
		}
	}

	private startWhenDue(addon: Addon<I>) {
		if (!addon.manifest.startAfterFirstFrame) {
			void this.activate(addon);

			return;
		}

		afterFirstFrame(() => {
			if (this.addons.get(addon.id) === addon && this.isEnabled(addon.id)) {
				void this.activate(addon);
			}
		});
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
	 * @param addon The addon to unload, as its id or the addon itself.
	 */
	unload(addon: AddonResolveable<I>): void | Promise<void> {
		const resolved = this.resolve(addon);

		if (!resolved) return;

		try {
			this.pendingStarts.delete(resolved.id);
			const stopping = this.stop(resolved);

			if (stopping) {
				return stopping.then(() => this.finishUnload(resolved));
			}

			this.finishUnload(resolved);
		} catch (error) {
			this.fail('unload', resolved.id, error);
		}
	}

	private finishUnload(resolved: Addon<I>): void {
		if (this.addons.get(resolved.id) !== resolved) return;

		try {
			this.addons.delete(resolved.id);
			this.errors.delete(resolved.id);
			this.emit('unloaded', resolved);
		} catch (error) {
			this.fail('unload', resolved.id, error);
		}
	}

	/**
	 * @description Starts an addon, evaluating its bundle into an instance, running it, and emits `started`.
	 * @param addon The addon to start, as its id or the addon itself.
	 * @param consented Whether the user just allowed its consent-gated capabilities.
	 */
	start(addon: AddonResolveable<I>, consented = false) {
		const resolved = this.resolve(addon);

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
		const state = this.stateOf(resolved);

		if (!recoveryMode) {
			beginAddonStart(guardKey, resolved.name);
		}

		try {
			const running: RunningAddon = {
				attribution: this.attribution(resolved),
				recordDeferredFailure: (failure) =>
					this.recordStartFailure(resolved, failure, 'running'),
			};

			state.scope = this.createScope(resolved);
			const addonScope = state.scope;

			state.instance = recoveryMode
				? null
				: runAsAddon(running, () =>
						this.handleBundle(state.bundle, resolved.id, addonScope),
					);

			state.panel = state.instance?.SettingsPanel;
			state.context = this.createContext(resolved);
			const context = state.context;

			const starting = benchSpan(`addon ${resolved.id} start`, () =>
				runAsAddon(running, () => state.instance?.start?.(context)),
			);

			// An async start runs on in the background, so its rejection is recorded like a deferred failure.
			if (starting && typeof starting.then === 'function') {
				state.settling = 'starting';
				starting.then(
					() => {
						addonScope?.endStart();
						this.settle(resolved, 'starting');
					},
					(cause: unknown) => {
						addonScope?.endStart();
						this.settle(resolved, 'starting');
						this.recordStartFailure(resolved, toError(cause), 'running');
					},
				);
			} else {
				addonScope?.endStart();
			}

			state.started = true;
			this.startDurations.set(resolved.id, monotonicNow() - startedAt);

			this.emit('started', resolved);
			this.emit('changed', resolved);
		} catch (error) {
			state.context?.dispose();
			state.context = undefined;
			state.scope?.dispose();
			state.scope = undefined;
			this.recordStartFailure(resolved, toError(error), 'starting');
		} finally {
			if (!recoveryMode) {
				finishAddonStart(guardKey);
			}
		}
	}

	/**
	 * @description Handles a freeze the loader attributed to an addon: tells the user, and disables the
	 * addon when {@link freezeDisables} says so.
	 * @param freeze The freeze the loader reported.
	 */
	handleFreeze(freeze: AddonFreeze): void {
		const addon = this.getAddons().find(
			(candidate) => crashGuardKey(this.bucket, candidate.id) === freeze.id,
		);

		if (!addon) return;

		const count = (this.freezes.get(addon.id) ?? 0) + 1;
		const disable = freezeDisables(count, freeze);

		this.freezes.set(addon.id, count);

		if (disable) {
			this.disable(addon);
			this.holdAfterCrash(addon);
		}

		announceFreeze(addon, freeze, count, disable, this.logger);
	}

	// An async start or stop finished; a stop that began meanwhile keeps its own phase.
	private settle(resolved: Addon<I>, phase: 'starting' | 'stopping'): void {
		const state = this.stateOf(resolved);

		if (state.settling !== phase) return;

		state.settling = void 0;
		this.emit('changed', resolved);
	}

	private recordStartFailure(
		resolved: Addon<I>,
		failure: Error,
		phase: 'starting' | 'running',
	): void {
		this.logger.error(`Failed to start addon ${resolved.id}:`, failure);
		this.errors.set(resolved.id, failure);
		this.stateOf(resolved).failed = true;
		this.emit('changed', resolved);
		void reportCrash({
			kind: 'start-failure',
			phase,
			addon: crashReportAddon(resolved),
			message: failure.message,
			stack: failure.stack,
		});
	}

	/**
	 * @description Returns how the loader attributes an addon's code to it, so a crash or freeze inside it
	 * disables that addon. Only plugins run code, so other kinds return `undefined`.
	 * @param _addon The addon.
	 * @returns The attribution wrapper, or `undefined`.
	 */
	protected attribution(_addon: Addon<I>): AddonAttribution | undefined {
		return undefined;
	}

	/**
	 * @description Persistently disables an addon the loader reported crashing Discord on consecutive launches.
	 * @param addon The addon about to start.
	 * @returns Whether the addon was disabled instead of started.
	 */
	private disableAfterCrash(addon: Addon<I>): boolean {
		return disableIfCrashed(addon, this.bucket, this.logger, () => {
			this.select(addon, false);
			this.holdAfterCrash(addon);
			void storage.persist();
		});
	}

	private crashHolds(): CrashHolds {
		return this.settings.get<CrashHolds>(CRASH_HOLDS_KEY, {});
	}

	private holdAfterCrash(addon: Addon<I>): void {
		this.settings.set(CRASH_HOLDS_KEY, holdAddon(this.crashHolds(), addon));
	}

	/**
	 * @description Forgets that a crash or freeze disabled an addon, once the user turns it back on.
	 * @param id The addon's id.
	 */
	protected releaseCrashHold(id: string): void {
		if (this.crashHolds()[id] === undefined) return;

		this.settings.set(CRASH_HOLDS_KEY, releaseAddon(this.crashHolds(), id));
	}

	/**
	 * @description Turns an addon a crash or freeze disabled back on once it updates to another version, and says so.
	 * @param addon The addon that just updated.
	 * @returns Settles once it is back on.
	 */
	protected async retryAfterUpdate(addon: Addon<I>): Promise<void> {
		if (!updatedSinceHold(this.crashHolds(), addon)) return;

		this.releaseCrashHold(addon.id);
		await this.enable(addon);
		this.logger.info(
			`Turned ${addon.name} back on: it updated to ${addon.version} since it crashed.`,
		);
		show({
			title: addon.name,
			content: `Turned ${addon.name} back on: it updated since it crashed Discord.`,
		});
	}

	/**
	 * @description Stops an addon, tearing down its instance, and emits `stopped`.
	 * @param addon The addon to stop, as its id or the addon itself.
	 */
	stop(addon: AddonResolveable<I>): void | Promise<void> {
		const resolved = this.resolve(addon);

		if (!resolved) return;

		this.pendingStarts.delete(resolved.id);

		if (!resolved.started) {
			return this.pendingStops.get(resolved.id);
		}

		const state = this.stateOf(resolved);
		const { instance, context, scope } = state;

		state.instance = null;
		state.context = undefined;
		state.scope = undefined;
		state.started = false;

		try {
			beginNativeStop(context);

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
							stopped = this.finishStop(resolved, context, scope);
						},
						(error) => {
							this.finishStop(resolved, context, scope, toError(error));
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

						if (stopped && shouldRestart && this.isEnabled(resolved.id)) {
							this.start(resolved);
						}
					});

				this.pendingStops.set(resolved.id, pending);
				state.settling = 'stopping';
				this.emit('changed', resolved);

				return pending;
			}

			this.finishStop(resolved, context, scope);
		} catch (error) {
			this.finishStop(resolved, context, scope, toError(error));
		}
	}

	private finishStop(
		resolved: Addon<I>,
		context: PluginContext | undefined,
		scope: AddonScope | undefined,
		error?: Error,
	): boolean {
		const newestFirst = [context, scope];
		const state = this.stateOf(resolved);

		// Stopped, whatever the outcome: the panel is gone and nothing is in flight.
		state.settling = void 0;
		state.panel = void 0;

		for (const part of newestFirst) {
			try {
				part?.dispose();
			} catch (disposeError) {
				error ??= toError(disposeError);
			}
		}

		try {
			unpatchAllByCaller(resolved.id);
		} catch (unpatchError) {
			error ??= toError(unpatchError);
		}

		if (error) {
			this.fail('stop', resolved.id, error);
			this.emit('changed', resolved);

			return false;
		}

		try {
			this.emit('stopped', resolved);
			this.emit('changed', resolved);

			return true;
		} catch (emitError) {
			this.fail('stop', resolved.id, emitError);

			return false;
		}
	}

	/**
	 * @description Stops a running addon and starts it again on the same bundle. An addon that isn't running stays stopped.
	 * @param addon The addon to restart, as its id or the addon itself.
	 */
	async restart(addon: AddonResolveable<I>): Promise<void> {
		const resolved = this.resolve(addon);

		if (!resolved?.started) return;

		await this.stop(resolved);
		this.clearFailure(resolved);
		await this.activate(resolved);
	}

	/**
	 * @description Resolves an addon reference, accepting either an id (matched by id then name) or the addon itself.
	 * @param addon The addon to resolve, as its id or the addon itself.
	 * @returns The matching addon, or `undefined` if none is found.
	 */
	protected resolve(addon: AddonResolveable<I>): Addon<I> | undefined {
		if (typeof addon !== 'string') {
			return addon;
		}

		const byId = this.addons.get(addon);

		if (byId) {
			return byId;
		}

		for (const candidate of this.addons.values()) {
			if (candidate.name === addon) {
				return candidate;
			}
		}
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

		validateNativeBridgeRequirements(capabilities, parsed.minNativeBridgeApi);

		return parsed;
	}
}
