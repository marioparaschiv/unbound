import type { BackgroundJob } from '@unbound-app/types/background';
import { createLogger } from '@unbound-app/logger';

import {
	addBackgroundJob,
	DEFAULT_PHASE,
	foundSomethingNew,
	runBackgroundJobs,
} from '~/background/jobs';
import {
	removeOrphanedAddons,
	setBackgroundRefresh,
	warmAddonDigests,
} from '~/native/unbound-native';
import { updateInBackground } from '~/updates/update-in-background';
import { refresh as refreshAccount } from '~/account/api';
import { isEnabled, now } from '~/sync/api';
import { persist } from '~/storage/api';

const Logger = createLogger('BackgroundRefresh');

const SETTINGS_PHASE = 0;
const UPKEEP_PHASE = 2;

let removeJobs: (() => void)[] = [];

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

async function warmDigests() {
	await warmAddonDigests();
}

async function removeOrphans() {
	await removeOrphanedAddons();
}

const BUILT_IN_JOBS: [name: string, run: BackgroundJob, phase: number][] = [
	['settings', saveSettings, SETTINGS_PHASE],
	['session', refreshAccount, SETTINGS_PHASE],
	['addon updates', updateInBackground, DEFAULT_PHASE],
	['sync', syncIfEnabled, DEFAULT_PHASE],
	['crash issues', retryCrashIssues, DEFAULT_PHASE],
	['marketplace catalog', refreshCatalog, DEFAULT_PHASE],
	['addon digests', warmDigests, UPKEEP_PHASE],
	['orphaned addons', removeOrphans, UPKEEP_PHASE],
];

async function refresh(): Promise<boolean> {
	const run = await runBackgroundJobs('loader');

	for (const job of run.jobs) {
		if (!job.ok) {
			Logger.error(`Failed to run background job ${job.name} (${job.owner}):`, job.error);
		}
	}

	return foundSomethingNew(run);
}

/**
 * @description Registers the built-in background jobs and hands the loader the run: saving settings, addon updates,
 * sync, unfiled crash issues, the marketplace catalog and plugin digests, with the jobs plugins add.
 */
export function afterAddons() {
	removeJobs = BUILT_IN_JOBS.map(([name, run, phase]) =>
		addBackgroundJob({ name, owner: 'unbound', run, phase }),
	);
	setBackgroundRefresh(refresh);
}

/**
 * @description Takes the background run back from the loader and removes the built-in jobs.
 */
export function stop() {
	setBackgroundRefresh();

	for (const remove of removeJobs) remove();

	removeJobs = [];
}

export default { afterAddons, stop };
