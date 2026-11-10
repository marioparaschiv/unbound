import type { Hero } from '~/ui/settings/updates/describe-hero';
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
};

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
