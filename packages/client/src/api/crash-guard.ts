import type { NativeCrashedAddon, NativePlatformCrashGuard } from '@unbound-app/types/native';

let disabledAfterCrash: Map<string, NativeCrashedAddon> | undefined;
let activityCell: Uint32Array | null | undefined;

/** Wraps a native bridge method so the loader attributes a crash inside it to one addon. */
export type AddonAttribution = <A extends unknown[], R>(
	method: (...args: A) => R,
) => (...args: A) => R;

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
export function beginAddonStart(key: string, name: string): void {
	bridge()?.begin(key, name);
}

/**
 * @description Clears the native start marker once an addon's start has returned.
 * @param key The addon's crash guard key.
 */
export function finishAddonStart(key: string): void {
	bridge()?.end(key);
}

/**
 * @description Registers an addon with the loader's crash attribution and returns a wrapper that marks the
 * addon as active while a native bridge method runs, so a native crash inside it disables that addon.
 * @param key The addon's crash guard key.
 * @param name The addon's display name.
 * @returns The wrapper, or `undefined` when the loader cannot attribute crashes.
 */
export function attributeAddon(key: string, name: string): AddonAttribution | undefined {
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
export function crashedAddon(key: string): NativeCrashedAddon | undefined {
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

let activeAttribution: AddonAttribution | undefined;

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

	const previous = activeAttribution;

	activeAttribution = attribution;

	try {
		return attribution(run)();
	} finally {
		activeAttribution = previous;
	}
}

/**
 * @description Returns the attribution of the addon whose code is running, while {@link withAddonAttribution} runs it.
 * @returns The active attribution, or `undefined` outside addon code.
 */
export function currentAddonAttribution(): AddonAttribution | undefined {
	return activeAttribution;
}

/**
 * @description Forgets the cached loader verdict so the next lookup asks the bridge again.
 */
export function resetCrashGuard(): void {
	disabledAfterCrash = undefined;
	activityCell = undefined;
}
