import { fs } from '@unbound-app/api';

import { SNAPSHOT_DIRECTORY } from '~/constants';
import { parseSnapshot, type Snapshot } from '~/snapshot';

/**
 * @description Builds the path of a signed-in user's saved snapshot, so each account keeps its own.
 * @param userId The signed-in user's id.
 * @returns The path, relative to the documents directory.
 */
export function snapshotPath(userId: string): string {
	return `${SNAPSHOT_DIRECTORY}/${userId}.json`;
}

/**
 * @description Loads the snapshot saved for a user.
 * @param userId The signed-in user's id.
 * @returns The snapshot, or `undefined` when none was saved or it cannot be read.
 */
export async function loadSnapshot(userId: string): Promise<Snapshot | undefined> {
	const path = snapshotPath(userId);

	try {
		return (await fs.exists(path)) ? parseSnapshot(await fs.readFile(path)) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @description Saves a user's snapshot, ignoring a failed write.
 * @param userId The signed-in user's id.
 * @param snapshot The snapshot to save.
 */
export async function saveSnapshot(userId: string, snapshot: Snapshot): Promise<void> {
	await fs.writeFile(snapshotPath(userId), JSON.stringify(snapshot)).catch((error: unknown) => {
		console.error('[Relationship Notifier] Failed to save the snapshot:', error);
	});
}
