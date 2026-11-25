import type { SyncKind } from '@unbound-app/contracts/sync';

import type { MessageKey } from '~/i18n/message';
import type { SyncStrategy } from '~/sync/merge';
import type { SyncMode } from '~/sync/api';

/** A choice row; `label` and `description` are message keys, resolved at render for the current locale. */
export type SyncOption<T> = {
	value: T;
	label: MessageKey;
	description: MessageKey;
	icon: string;
};

/** The directions automatic syncs can move changes in. */
export const SYNC_MODES: SyncOption<SyncMode>[] = [
	{
		value: 'two-way',
		label: 'UNBOUND_CLOUD_SYNC_MODE_TWO_WAY',
		icon: 'ArrowsUpDownIcon',
		description: 'UNBOUND_CLOUD_SYNC_MODE_TWO_WAY_DESC',
	},
	{
		value: 'download',
		label: 'UNBOUND_CLOUD_SYNC_MODE_DOWNLOAD',
		icon: 'DownloadIcon',
		description: 'UNBOUND_CLOUD_SYNC_MODE_DOWNLOAD_DESC',
	},
	{
		value: 'upload',
		label: 'UNBOUND_CLOUD_SYNC_MODE_UPLOAD',
		icon: 'UploadIcon',
		description: 'UNBOUND_CLOUD_SYNC_MODE_UPLOAD_DESC',
	},
];

/** A kind's row under what the cloud holds. */
export type SyncKindRow = {
	kind: SyncKind;
	label: MessageKey;
	icon: string;
};

/** The kinds of install Sync carries, in the order the addon pages list them. */
export const SYNC_KIND_ROWS: SyncKindRow[] = [
	{ kind: 'plugins', label: 'UNBOUND_PLUGINS', icon: 'PuzzlePieceIcon' },
	{ kind: 'themes', label: 'UNBOUND_THEMES', icon: 'PaintPaletteIcon' },
	{ kind: 'icons', label: 'UNBOUND_ICONS', icon: 'ImageIcon' },
	{ kind: 'fonts', label: 'UNBOUND_FONTS', icon: 'TextIcon' },
];

/** The ways to combine this device with a cloud setup on the first sync, the cloud's first. */
export const FIRST_SYNC_CHOICES: SyncOption<SyncStrategy>[] = [
	{
		value: 'pull',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_PULL',
		icon: 'CloudDownloadIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_PULL_DESC',
	},
	{
		value: 'merge',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_MERGE',
		icon: 'ArrowsUpDownIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_MERGE_DESC',
	},
	{
		value: 'push',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_PUSH',
		icon: 'UploadIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_PUSH_DESC',
	},
];
