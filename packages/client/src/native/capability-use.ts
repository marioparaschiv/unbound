import type { NativeBridgeCapability } from '@unbound-app/types';

type CapabilityRecord = {
	declared: Set<NativeBridgeCapability>;
	used: Set<NativeBridgeCapability>;
	uiScope: boolean;
};

/** What a plugin declared and what its JavaScript-thread calls used. UI-thread worklets are not counted. */
export type CapabilityUse = {
	plugin: string;
	declared: NativeBridgeCapability[];
	used: NativeBridgeCapability[];
	unused: NativeBridgeCapability[];
	uiScope: boolean;
};

const records = new Map<string, CapabilityRecord>();

/**
 * @description Starts counting which declared capabilities a plugin's native scope uses.
 * @param owner The plugin's id.
 * @param declared The capabilities it declares for this platform.
 * @returns Records one use of a capability.
 */
export function trackCapabilities(
	owner: string,
	declared: readonly NativeBridgeCapability[],
): (capability: NativeBridgeCapability) => void {
	const record: CapabilityRecord = {
		declared: new Set(declared),
		used: new Set(),
		uiScope: false,
	};

	records.set(owner, record);

	return (capability) => {
		record.used.add(capability);
	};
}

/**
 * @description Notes that a plugin opened a UI-thread scope, whose worklets may use capabilities this count misses.
 * @param owner The plugin's id.
 */
export function markUIScope(owner: string): void {
	const record = records.get(owner);

	if (record) {
		record.uiScope = true;
	}
}

/**
 * @description Lists each plugin's declared capabilities beside the ones its JavaScript-thread calls used.
 * @returns One entry per plugin with a native scope this launch.
 */
export function capabilityUse(): CapabilityUse[] {
	return [...records].map(([plugin, { declared, used, uiScope }]) => ({
		plugin,
		declared: [...declared],
		used: [...used],
		unused: [...declared].filter((capability) => !used.has(capability)),
		uiScope,
	}));
}
