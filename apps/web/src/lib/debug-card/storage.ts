import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

import { joined } from './spans';

const LOW_STORAGE_MB = 500;
const LARGE_DISCORD_MB = 2048;

/**
 * @description Describes the device's free space and how much Discord and Unbound take.
 * @param storage The reported sizes.
 * @returns The summary, or `undefined` without sizes.
 */
export function storageSummary(storage: DebugInfo['storage']): string | undefined {
	if (!storage) {
		return undefined;
	}

	const discord =
		storage.discordMB === undefined
			? undefined
			: `Discord ${storage.discordMB} MB${storage.cacheMB === undefined ? '' : ` (cache ${storage.cacheMB} MB)`}`;

	return (
		joined([
			storage.freeMB === undefined ? undefined : `${storage.freeMB} MB free`,
			discord,
			storage.unboundMB === undefined ? undefined : `unbound ${storage.unboundMB} MB`,
		]) || undefined
	);
}

/**
 * @description Decides whether the card shows storage: when space runs low or Discord's data grew large.
 * @param storage The reported sizes.
 * @returns Whether storage is worth a row.
 */
export function storageMatters(storage: DebugInfo['storage']): boolean {
	return (
		(storage?.freeMB !== undefined && storage.freeMB < LOW_STORAGE_MB) ||
		(storage?.discordMB !== undefined && storage.discordMB >= LARGE_DISCORD_MB)
	);
}

export default storageSummary;
