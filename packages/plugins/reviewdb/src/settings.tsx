import { metro, storage } from '@unbound-app/api';

import { authorize } from '@reviewdb/auth';
import { openBlockedUsersSheet } from '@reviewdb/sheets/BlockedUsersSheet';
import { openReviewsSheet } from '@reviewdb/sheets/ReviewsSheet';
import { getCurrentUserId } from '@reviewdb/utils';
import {
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
} from '@shared/settings-ui';

const STORE = storage.getStore('unbound.reviewdb');

function openExternalLink(url: string): void {
	const ReactNative = metro.common.ReactNative;
	ReactNative.Linking?.openURL(url)?.catch?.(() => undefined);
}

export function ReviewDBSettingsScreen() {
	const state = STORE.useSettingsStore();
	const authorized = !!state.get('token', '');
	const myId = getCurrentUserId();

	return (
		<SettingsScrollView>
			<SettingsSection title='Account'>
				<SettingsRow
					label={authorized ? 'Reauthorize with ReviewDB' : 'Authorize with ReviewDB'}
					description={
						authorized
							? 'You are connected to ReviewDB'
							: 'Sign in to review users and see your reviews'
					}
					onPress={() => authorize()}
				/>
				<SettingsRow
					label='View My Reviews'
					arrow
					disabled={!myId}
					onPress={() => myId && openReviewsSheet(myId, 'You')}
				/>
				<SettingsRow
					label='Manage Blocked Users'
					description='Users you have blocked from leaving reviews'
					arrow
					disabled={!authorized}
					onPress={() => authorized && openBlockedUsersSheet()}
				/>
			</SettingsSection>

			<SettingsSection title='Preferences'>
				<SettingsSwitchRow
					label='Notify About New Reviews'
					description='Show a toast on startup when you have new reviews'
					value={state.get('notifyReviews', true)}
					onValueChange={(value: boolean) => state.set('notifyReviews', value)}
				/>
				<SettingsSwitchRow
					label='Hide Timestamps'
					value={state.get('hideTimestamps', false)}
					onValueChange={(value: boolean) => state.set('hideTimestamps', value)}
				/>
				<SettingsSwitchRow
					label='Hide Reviews From Blocked Users'
					description='Hide reviews from users you have blocked on Discord'
					value={state.get('hideBlockedUsers', true)}
					onValueChange={(value: boolean) => state.set('hideBlockedUsers', value)}
				/>
			</SettingsSection>

			<SettingsSection title='Links'>
				<SettingsRow
					label='ReviewDB Website'
					arrow
					onPress={() => openExternalLink('https://reviewdb.mantikafasi.dev')}
				/>
				<SettingsRow
					label='ReviewDB Support Server'
					arrow
					onPress={() => openExternalLink('https://discord.gg/eWPBSbvznt')}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}
