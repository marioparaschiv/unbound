import { createLogger } from '@unbound-app/logger';

import { checkForBundleUpdate, hasStagedBundle, updateBundle } from '~/native/unbound-native';

const logger = createLogger('Updater', 'Client');

/** Where the client stands: running the newest bundle, a newer one published, or one downloaded for a restart. */
export type ClientUpdate = 'current' | 'available' | 'staged';

/** The `applying` key the client's update records its progress under. */
export const CLIENT_UPDATE_ID = 'unbound::client';

/**
 * @description Asks the loader whether a newer client is published, unless one already waits for a restart. The
 * loader answers `current` while client updates are paused.
 * @returns Where the client stands; `current` when the check failed.
 */
export async function findClientUpdate(): Promise<ClientUpdate> {
	if (hasStagedBundle()) return 'staged';

	try {
		const available = await checkForBundleUpdate();

		// The loader's own check, which the native one waits out, may have staged it meanwhile.
		if (hasStagedBundle()) return 'staged';

		return available ? 'available' : 'current';
	} catch (error) {
		logger.error('Failed to check for a client update:', error);

		return hasStagedBundle() ? 'staged' : 'current';
	}
}

/**
 * @description Has the loader download the newer client for the next restart.
 * @returns Whether it now waits for a restart; `false` when the download failed or client updates are paused.
 */
export async function stageClientUpdate(): Promise<boolean> {
	try {
		return await updateBundle();
	} catch (error) {
		logger.error('Failed to download the client update:', error);

		return false;
	}
}
