import type { NativeCrashedAddon, NativePlatformCrashGuard } from '@unbound-app/types/native';

let disabledAfterCrash: Map<string, NativeCrashedAddon> | undefined;
let activityCell: Uint32Array | null | undefined;

/** Wraps a native bridge method so the loader attributes a crash inside it to one addon. */
export type AddonAttribution = <A extends unknown[], R>(
	method: (...args: A) => R,
) => (...args: A) => R;

/** How the loader names an addon in its crash guard, persisted across launches: `<settings bucket>:<addon id>`. */
export type CrashGuardKey = `${string}:${string}`;

/**
 * @description Names an addon in the loader's crash guard, unique across addon kinds.
 * @param bucket The settings bucket of the addon's manager.
 * @param id The addon's id.
 * @returns The crash guard key.
 */
export function crashGuardKey(bucket: string, id: string): CrashGuardKey {
	return `${bucket}:${id}`;
}

function bridge(): NativePlatformCrashGuard | undefined {
	return globalThis.NativePlatform?.crashGuard;
}

function sharedActivityCell(guard: NativePlatformCrashGuard): Uint32Array | null {
	if (activityCell === undefined) {
		const buffer = guard.activity?.();

		activityCell = buffer && buffer.byteLength >= 4 ? new Uint32Array(buffer, 0, 1) : null;
	}

	return activityCell;
}

/**
 * @description Records natively that an addon is starting, so a crash during its start survives into the next launch.
 * @param key The addon's crash guard key.
 * @param name The addon's display name.
 */
export function beginAddonStart(key: CrashGuardKey, name: string): void {
	bridge()?.begin(key, name);
}

/**
 * @description Clears the native start marker once an addon's start has returned.
 * @param key The addon's crash guard key.
 */
export function finishAddonStart(key: CrashGuardKey): void {
	bridge()?.end(key);
}

/**
 * @description Registers an addon with the loader's crash attribution and returns a wrapper that marks the
 * addon as active while a native bridge method runs, so a native crash inside it disables that addon.
 * @param key The addon's crash guard key.
 * @param name The addon's display name.
 * @returns The wrapper, or `undefined` when the loader cannot attribute crashes.
 */
export function attributeAddon(key: CrashGuardKey, name: string): AddonAttribution | undefined {
	const guard = bridge();
	const slot = guard?.register?.(key, name) ?? 0;
	const cell = guard && slot > 0 ? sharedActivityCell(guard) : null;

	if (!cell) {
		return undefined;
	}

	return (method) =>
		(...args) => {
			const previous = cell[0];

			cell[0] = slot;

			try {
				return method(...args);
			} finally {
				cell[0] = previous;
			}
		};
}

/**
 * @description Looks up whether the loader disabled an addon because Discord crashed while starting or running it on
 * consecutive launches.
 * @param key The addon's crash guard key.
 * @returns The crashed addon reported by the loader, or `undefined`.
 */
export function crashedAddon(key: CrashGuardKey): NativeCrashedAddon | undefined {
	disabledAfterCrash ??= new Map((bridge()?.disabled() ?? []).map((addon) => [addon.id, addon]));

	return disabledAfterCrash.get(key);
}

/**
 * @description Describes why the loader disabled an addon after consecutive crashes.
 * @param addon The crashed addon reported by the loader.
 * @param name The addon's display name.
 * @returns The notice shown to the user.
 */
export function crashDisabledNotice(addon: NativeCrashedAddon, name: string): string {
	if (addon.phase === 'frozen') {
		return `Disabled ${name} because Discord froze in it and had to be closed.`;
	}

	const activity = addon.phase === 'running' ? 'running' : 'starting';

	return `Disabled ${name} because Discord crashed while ${activity} it.`;
}

/** A freeze of Discord's JavaScript thread the loader attributed to an addon, reported once it ended. */
export type AddonFreeze = {
	/** The addon's crash guard key. */
	id: string;
	name: string;
	seconds: number;
	/** Where the JavaScript thread was stuck, such as the native call it was inside, when the loader knows. */
	detail?: string;
	/** The JavaScript frames the thread was sampled in, one `at` line each, when the loader could sample them. */
	stack?: string;
};

type FreezeListenerGlobal = typeof globalThis & {
	__UnboundFreezeListener?: (freeze: AddonFreeze) => void;
};

/**
 * @description Receives the freezes the loader's watchdog attributes to an addon, after each one ends.
 * @param listener Called with each freeze, or `undefined` to stop listening.
 */
export function setFreezeListener(listener: ((freeze: AddonFreeze) => void) | undefined): void {
	(globalThis as FreezeListenerGlobal).__UnboundFreezeListener = listener;
}

/** The addon whose code is running: how the loader attributes it, and where a later failure in it is reported. */
export type AddonScope = {
	attribution?: AddonAttribution;
	/** Records a failure in code the addon registered that runs after its start, such as a deferred patch. */
	fail?: (error: Error) => void;
};

let activeScope: AddonScope | undefined;

/**
 * @description Runs addon code with the loader attributing it to the addon, so a crash or freeze inside it
 * is blamed on that addon. Patches registered while it runs are attributed the same way.
 * @param attribution The addon's attribution wrapper from {@link attributeAddon}.
 * @param run The addon code to run.
 * @returns What `run` returned.
 */
export function withAddonAttribution<R>(
	attribution: AddonAttribution | undefined,
	run: () => R,
): R {
	if (!attribution) {
		return run();
	}

	return withAddonScope({ attribution }, run);
}

/**
 * @description Runs code as an addon's, or as no addon's when `scope` is `undefined`, restoring the previous scope after.
 * @param scope The addon's scope, as {@link currentAddonScope} returned it.
 * @param run The code to run.
 * @returns What `run` returned.
 */
export function withAddonScope<R>(scope: AddonScope | undefined, run: () => R): R {
	const previous = activeScope;

	activeScope = scope;

	try {
		return scope?.attribution ? scope.attribution(run)() : run();
	} finally {
		activeScope = previous;
	}
}

/**
 * @description Returns the scope of the addon whose code is running.
 * @returns The active scope, or `undefined` outside addon code.
 */
export function currentAddonScope(): AddonScope | undefined {
	return activeScope;
}

/**
 * @description Returns the attribution of the addon whose code is running, while {@link withAddonAttribution} runs it.
 * @returns The active attribution, or `undefined` outside addon code.
 */
export function currentAddonAttribution(): AddonAttribution | undefined {
	return activeScope?.attribution;
}

/**
 * @description Forgets the cached loader verdict so the next lookup asks the bridge again.
 */
export function resetCrashGuard(): void {
	disabledAfterCrash = undefined;
	activityCell = undefined;
}
