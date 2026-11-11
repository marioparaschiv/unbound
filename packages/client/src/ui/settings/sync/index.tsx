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
import { FIRST_SYNC_CHOICES, SYNC_MODES } from '~/ui/settings/sync/sync-options';
import type { SyncStatus } from '~/ui/settings/sync/describe-sync';
import type { SyncHeroAction } from '~/ui/settings/sync/sync-hero';
import SyncFocusPage from '~/ui/settings/sync/sync-focus-page';
import SyncHero from '~/ui/settings/sync/sync-hero';
import useSignIn from '~/ui/account/use-sign-in';
import { Discord } from '~/metro/components';
import { useAccount } from '~/account/api';
import type { SyncMode } from '~/sync/api';
import { useBucket } from '~/storage/api';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './sync.style';

/**
 * @description Sync, laid out like the updates page: a status hero with the next step, then how this device
 * combines with the cloud, which way it syncs, and deleting the cloud's copy.
 */
function SyncPage() {
	const styles = useStyles();
	const settings = useBucket(SYNC_STORE);
	const [busy, setBusy] = useState(false);
	const account = useAccount();
	const signIn = useSignIn();
	const enabled = settings.get('enabled', false);

	const status: SyncStatus = {
		signedIn: Boolean(account),
		enabled,
		choosing: Boolean(account) && settings.get('pendingChoice', false),
		syncing: busy,
		lastError: settings.get<string | null>('lastError', null),
		lastSyncedAt: settings.get<string | null>('lastSyncedAt', null),
	};

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

	function heroActions(): SyncHeroAction[] {
		if (!status.signedIn) {
			return [
				{
					text: messages.UNBOUND_SIGN_IN,
					variant: 'primary',
					loading: signIn.busy,
					onPress: () => signIn.start(),
				},
			];
		}

		// The choices themselves are the next step, listed under the hero.
		if (status.choosing) {
			return [];
		}

		return enabled
			? [
					{
						text: messages.UNBOUND_CLOUD_SYNC_NOW,
						variant: 'secondary',
						loading: busy,
						onPress: () => track(now()),
					},
				]
			: [
					{
						text: messages.UNBOUND_CLOUD_SYNC_TURN_ON,
						variant: 'primary',
						loading: busy,
						onPress: () => track(setEnabled(true)),
					},
				];
	}

	const hero = <SyncHero status={status} actions={heroActions()} />;

	if (!status.signedIn) {
		return <SyncFocusPage hero={hero} />;
	}

	if (status.choosing) {
		return (
			<SyncFocusPage
				hero={hero}
				footer={
					<>
						<Discord.TableRowGroup>
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
						<Discord.Button
							text={messages.UNBOUND_CLOUD_SYNC_NOT_NOW}
							variant='tertiary'
							size='md'
							disabled={busy}
							onPress={() => void setEnabled(false)}
						/>
					</>
				}
			/>
		);
	}

	return (
		<Page>
			{hero}

			{enabled ? (
				<Discord.TableRowGroup>
					<Discord.TableSwitchRow
						label={messages.UNBOUND_CLOUD_SYNC_ENABLED}
						icon={<Discord.TableRowIcon source={icons.CloudIcon} />}
						value={enabled}
						onValueChange={(value: boolean) => track(setEnabled(value))}
					/>
				</Discord.TableRowGroup>
			) : null}

			<Discord.TableRadioGroup
				title={messages.UNBOUND_CLOUD_SYNC_MODE}
				hasIcons
				value={getMode()}
				onChange={(mode: SyncMode) => setMode(mode)}
			>
				{SYNC_MODES.map((mode) => (
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

export default SyncPage;
