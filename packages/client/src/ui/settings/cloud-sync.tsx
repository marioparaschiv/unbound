import { Image } from 'react-native';
import { useState } from 'react';

import {
	SYNC_STORE,
	deleteCloudData,
	getMode,
	resolveFirstSync,
	setEnabled,
	setMode,
	signIn,
	signOut,
	sync,
} from '~/managers/cloud-sync';
import type { SyncMode, SyncSession } from '~/managers/cloud-sync';
import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import type { SyncStrategy } from '~/lib/sync';
import { Messages, format } from '~/api/i18n';
import { Page } from '~/ui/components';
import { Icons } from '~/api/assets';

import useStyles from './cloud-sync.style';

type SyncSettings = ReturnType<typeof useSettingsStore>;

/** A choice row; `label` and `description` are message keys, resolved at render for the current locale. */
type Option<T> = {
	value: T;
	label: string;
	description: string;
	icon: string;
};

const MODES: Option<SyncMode>[] = [
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

const FIRST_SYNC_CHOICES: Option<SyncStrategy>[] = [
	{
		value: 'merge',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_MERGE',
		icon: 'ArrowsUpDownIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_MERGE_DESC',
	},
	{
		value: 'pull',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_PULL',
		icon: 'DownloadIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_PULL_DESC',
	},
	{
		value: 'push',
		label: 'UNBOUND_CLOUD_SYNC_CHOICE_PUSH',
		icon: 'UploadIcon',
		description: 'UNBOUND_CLOUD_SYNC_CHOICE_PUSH_DESC',
	},
];

function describeStatus(settings: SyncSettings): string {
	const error = settings.get<string | null>('lastError', null);
	const syncedAt = settings.get<string | null>('lastSyncedAt', null);

	if (error) {
		return format('UNBOUND_CLOUD_SYNC_FAILED', { error });
	}

	if (!syncedAt) {
		return Messages.UNBOUND_CLOUD_SYNC_NEVER_SYNCED;
	}

	return format('UNBOUND_CLOUD_SYNC_LAST_SYNCED', { date: new Date(syncedAt).toLocaleString() });
}

/** @description Cloud Sync settings, laid out like Discord's own settings pages. */
function CloudSyncPage() {
	const styles = useStyles();
	const settings = useSettingsStore(SYNC_STORE);
	const [busy, setBusy] = useState(false);
	const session = settings.get<SyncSession | null>('session', null);

	function track(task: Promise<boolean>) {
		setBusy(true);
		void task.finally(() => setBusy(false));
	}

	function confirmDelete() {
		Discord.showConfirmModal({
			title: Messages.UNBOUND_CLOUD_SYNC_DELETE,
			content: Messages.UNBOUND_CLOUD_SYNC_DELETE_CONFIRM,
			confirmText: Messages.UNBOUND_DELETE,
			cancelText: Messages.UNBOUND_CANCEL,
			onConfirm: () => void deleteCloudData(),
		});
	}

	if (!session) {
		return (
			<Page>
				<Discord.TableRowGroup
					helperText={
						settings.get<string | null>('lastError', null) ??
						Messages.UNBOUND_CLOUD_SYNC_SIGN_IN_DESC
					}
				>
					<Discord.TableRow
						label={Messages.UNBOUND_CLOUD_SYNC_SIGN_IN}
						icon={<Discord.TableRowIcon source={Icons.CloudIcon} />}
						arrow
						disabled={busy}
						onPress={() => track(signIn())}
					/>
				</Discord.TableRowGroup>
			</Page>
		);
	}

	const signOutGroup = (
		<Discord.TableRowGroup>
			<Discord.TableRow
				label={Messages.UNBOUND_CLOUD_SYNC_SIGN_OUT}
				icon={<Discord.TableRowIcon source={Icons.DoorExitIcon} />}
				onPress={signOut}
			/>
		</Discord.TableRowGroup>
	);

	if (settings.get('pendingChoice', false)) {
		return (
			<Page>
				<Discord.TableRowGroup
					title={Messages.UNBOUND_CLOUD_SYNC_CHOICE}
					helperText={Messages.UNBOUND_CLOUD_SYNC_CHOICE_DESC}
				>
					{FIRST_SYNC_CHOICES.map((choice) => (
						<Discord.TableRow
							key={choice.value}
							label={Messages[choice.label]}
							subLabel={Messages[choice.description]}
							icon={<Discord.TableRowIcon source={Icons[choice.icon]} />}
							arrow
							disabled={busy}
							onPress={() => track(resolveFirstSync(choice.value))}
						/>
					))}
				</Discord.TableRowGroup>
				{signOutGroup}
			</Page>
		);
	}

	return (
		<Page>
			<Discord.TableRowGroup helperText={describeStatus(settings)}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_CLOUD_SYNC_ENABLED}
					icon={<Discord.TableRowIcon source={Icons.CloudIcon} />}
					value={settings.get('enabled', false)}
					onValueChange={setEnabled}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_CLOUD_SYNC_NOW}
					icon={<Discord.TableRowIcon source={Icons.RetryIcon} />}
					disabled={busy}
					onPress={() => track(sync())}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRadioGroup
				title={Messages.UNBOUND_CLOUD_SYNC_MODE}
				hasIcons
				value={getMode()}
				onChange={(mode: SyncMode) => setMode(mode)}
			>
				{MODES.map((mode) => (
					<Discord.TableRadioRow
						key={mode.value}
						value={mode.value}
						label={Messages[mode.label]}
						subLabel={Messages[mode.description]}
						icon={<Discord.TableRowIcon source={Icons[mode.icon]} />}
					/>
				))}
			</Discord.TableRadioGroup>

			{signOutGroup}

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={Messages.UNBOUND_CLOUD_SYNC_DELETE}
					variant='danger'
					icon={<Image source={Icons.TrashIcon} style={styles.dangerIcon} />}
					onPress={confirmDelete}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default CloudSyncPage;
