import { createLogger } from '@unbound-app/logger';

import { updateInBackground } from '~/updates/update-in-background';
import { setBackgroundRefresh } from '~/native/unbound-native';
import { isEnabled, now } from '~/sync/api';
import { persist } from '~/storage/api';

const Logger = createLogger('BackgroundRefresh');

type BackgroundJob = [name: string, run: () => Promise<void>];

async function saveSettings() {
	await persist();
}

async function syncIfEnabled() {
	if (isEnabled()) {
		await now();
	}
}

async function retryCrashIssues() {
	const { retryPendingIssues } = await import('~/diagnostics/crash-reports');

	await retryPendingIssues();
}

async function refreshCatalog() {
	const { default: MarketplaceStore } = await import('~/marketplace/state');

	await MarketplaceStore.getState().load();
}

const JOBS: BackgroundJob[] = [
	['addon updates', updateInBackground],
	['sync', syncIfEnabled],
	['crash issues', retryCrashIssues],
	['marketplace catalog', refreshCatalog],
];

async function runJob([name, run]: BackgroundJob) {
	try {
		await run();
	} catch (error) {
		Logger.error(`Failed to run background job ${name}:`, error);
	}
}

// Settings save first: iOS may end the process before the slower network jobs finish.
async function refresh() {
	await runJob(['settings', saveSettings]);
	await Promise.all(JOBS.map(runJob));
}

/**
 * @description Hands the loader the work to run while Discord is in the background: saving settings, addon updates,
 * sync, unfiled crash issues and the marketplace catalog.
 */
export function afterAddons() {
	setBackgroundRefresh(refresh);
}

/**
 * @description Takes the background work back from the loader.
 */
export function stop() {
	setBackgroundRefresh();
}

export default { afterAddons, stop };
