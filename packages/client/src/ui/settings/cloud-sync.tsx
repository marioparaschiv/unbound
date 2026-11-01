import { Image } from 'react-native';
import { useState } from 'react';

import {
	SYNC_STORE,
	deleteData,
	getMode,
	resolveFirstSync,
	setEnabled,
	setMode,
	now,
} from '~/sync/api';
import type { SyncStrategy } from '~/sync/merge';
import SignInRow from '~/ui/account/sign-in-row';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { useAccount } from '~/account/api';
import type { SyncMode } from '~/sync/api';
import { useBucket } from '~/storage/api';
import Page from '~/ui/components/page';
import { icons } from '~/assets/api';

import useStyles from './cloud-sync.style';

type SyncSettings = ReturnType<typeof useBucket>;

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
		return messages.UNBOUND_CLOUD_SYNC_NEVER_SYNCED;
	}

	return format('UNBOUND_CLOUD_SYNC_LAST_SYNCED', { date: new Date(syncedAt).toLocaleString() });
}

/** @description Cloud Sync settings, laid out like Discord's own settings pages. */
function CloudSyncPage() {
	const styles = useStyles();
	const settings = useBucket(SYNC_STORE);
	const [busy, setBusy] = useState(false);
	const account = useAccount();

	function track(task: Promise<boolean>) {
		setBusy(true);
		void task.finally(() => setBusy(false));
	}

	function confirmDelete() {
		Discord.showConfirmModal({
			title: messages.UNBOUND_CLOUD_SYNC_DELETE,
			content: messages.UNBOUND_CLOUD_SYNC_DELETE_CONFIRM,
			confirmText: messages.UNBOUND_DELETE,
			cancelText: messages.UNBOUND_CANCEL,
			onConfirm: () => void deleteData(),
		});
	}

	if (!account) {
		return (
			<Page>
				<Discord.TableRowGroup helperText={messages.UNBOUND_CLOUD_SYNC_SIGN_IN_DESC}>
					<SignInRow />
				</Discord.TableRowGroup>
			</Page>
		);
	}

	if (settings.get('pendingChoice', false)) {
		return (
			<Page>
				<Discord.TableRowGroup
					title={messages.UNBOUND_CLOUD_SYNC_CHOICE}
					helperText={messages.UNBOUND_CLOUD_SYNC_CHOICE_DESC}
				>
					{FIRST_SYNC_CHOICES.map((choice) => (
						<Discord.TableRow
							key={choice.value}
							label={messages[choice.label]}
							subLabel={messages[choice.description]}
							icon={<Discord.TableRowIcon source={icons[choice.icon]} />}
							arrow
							disabled={busy}
							onPress={() => track(resolveFirstSync(choice.value))}
						/>
					))}
				</Discord.TableRowGroup>
			</Page>
		);
	}

	return (
		<Page>
			<Discord.TableRowGroup helperText={describeStatus(settings)}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_CLOUD_SYNC_ENABLED}
					icon={<Discord.TableRowIcon source={icons.CloudIcon} />}
					value={settings.get('enabled', false)}
					onValueChange={setEnabled}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_CLOUD_SYNC_NOW}
					icon={<Discord.TableRowIcon source={icons.RetryIcon} />}
					disabled={busy}
					onPress={() => track(now())}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRadioGroup
				title={messages.UNBOUND_CLOUD_SYNC_MODE}
				hasIcons
				value={getMode()}
				onChange={(mode: SyncMode) => setMode(mode)}
			>
				{MODES.map((mode) => (
					<Discord.TableRadioRow
						key={mode.value}
						value={mode.value}
						label={messages[mode.label]}
						subLabel={messages[mode.description]}
						icon={<Discord.TableRowIcon source={icons[mode.icon]} />}
					/>
				))}
			</Discord.TableRadioGroup>

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={messages.UNBOUND_CLOUD_SYNC_DELETE}
					variant='danger'
					icon={<Image source={icons.TrashIcon} style={styles.dangerIcon} />}
					onPress={confirmDelete}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default CloudSyncPage;
