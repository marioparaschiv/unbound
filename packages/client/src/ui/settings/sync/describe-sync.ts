import type { Hero } from '~/ui/settings/updates/describe-hero';
import type { SyncKindSummary } from '~/sync/device';
import { messages, format } from '~/i18n/api';
import { Moment } from '~/metro/common';

/** Where Sync stands on this device, as the status hero reads it. */
export type SyncStatus = {
	signedIn: boolean;
	enabled: boolean;
	/** Whether the cloud holds a setup the user has not yet chosen how to combine with this device. */
	choosing: boolean;
	syncing: boolean;
	lastError: string | null;
	lastSyncedAt: string | null;
	/** How many cloud installs the last sync could not install here. */
	missing: number;
};

/** How many ids a row names before it counts the rest. */
const LISTED_IDS = 3;

function listIds(ids: string[]): string {
	const rest = ids.length - LISTED_IDS;
	const listed = ids.slice(0, LISTED_IDS).join(', ');

	return rest > 0 ? `${listed} +${rest}` : listed;
}

/**
 * @description Words how one kind differs between this device and the cloud, for its row on the Sync page.
 * @param summary The kind's summary from the last sync.
 * @returns The row's sub-label.
 */
export function describeKind(summary: SyncKindSummary): string {
	const parts = [
		summary.missing.length
			? format('UNBOUND_CLOUD_SYNC_MISSING', { names: listIds(summary.missing) })
			: null,
		summary.unsynced.length
			? format('UNBOUND_CLOUD_SYNC_UNSYNCED', { names: listIds(summary.unsynced) })
			: null,
	].filter(Boolean);

	return parts.length ? parts.join('\n') : messages.UNBOUND_CLOUD_SYNC_IN_SYNC;
}

/**
 * @description Words where Sync stands for the status hero, mirroring the updates page's.
 * @param status Where Sync stands.
 * @returns The hero's tone, icon, title and subtitle.
 */
export function describeSync(status: SyncStatus): Hero {
	const synced = status.lastSyncedAt
		? format('UNBOUND_CLOUD_SYNC_LAST_SYNCED', {
				date: Moment.utc(status.lastSyncedAt).fromNow(),
			})
		: messages.UNBOUND_CLOUD_SYNC_NEVER_SYNCED;

	if (!status.signedIn) {
		return {
			tone: 'neutral',
			icon: 'CloudIcon',
			title: messages.UNBOUND_CLOUD_SYNC_STATUS_SIGNED_OUT,
			subtitle: messages.UNBOUND_CLOUD_SYNC_SIGN_IN_DESC,
		};
	}

	if (status.syncing) {
		return {
			tone: 'neutral',
			icon: 'RetryIcon',
			title: messages.UNBOUND_CLOUD_SYNC_STATUS_SYNCING,
			subtitle: synced,
		};
	}

	if (status.choosing) {
		return {
			tone: 'brand',
			icon: 'CloudDownloadIcon',
			title: messages.UNBOUND_CLOUD_SYNC_CHOICE,
			subtitle: messages.UNBOUND_CLOUD_SYNC_CHOICE_DESC,
		};
	}

	if (!status.enabled) {
		return {
			tone: 'neutral',
			icon: 'CloudIcon',
			title: messages.UNBOUND_CLOUD_SYNC_STATUS_OFF,
			subtitle: messages.UNBOUND_CLOUD_SYNC_SIGN_IN_DESC,
		};
	}

	if (status.lastError) {
		return {
			tone: 'critical',
			icon: 'WarningIcon',
			title: messages.UNBOUND_CLOUD_SYNC_STATUS_FAILED,
			subtitle: status.lastError,
		};
	}

	if (status.missing > 0) {
		return {
			tone: 'warning',
			icon: 'WarningIcon',
			title: format('UNBOUND_CLOUD_SYNC_STATUS_MISSING', { count: status.missing }),
			subtitle: synced,
		};
	}

	return status.lastSyncedAt
		? {
				tone: 'positive',
				icon: 'CircleCheckIcon',
				title: messages.UNBOUND_CLOUD_SYNC_STATUS_SYNCED,
				subtitle: synced,
			}
		: {
				tone: 'brand',
				icon: 'CloudIcon',
				title: messages.UNBOUND_CLOUD_SYNC_STATUS_ON,
				subtitle: synced,
			};
}
