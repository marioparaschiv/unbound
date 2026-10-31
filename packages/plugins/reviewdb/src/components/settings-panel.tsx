import { storage, ui } from '@unbound-app/api';
import { Users } from '@unbound-app/api/metro/stores';
import { Linking } from 'react-native';

import { openBlockedUsersSheet } from '~/components/blocked-users-sheet';
import { openReviewsSheet } from '~/components/reviews-sheet';
import { signIn } from '~/login';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const authorized = Boolean(store.get('token', ''));
	const myId = Users.getCurrentUser()?.id;

	return (
		<ui.Page>
			<ui.Section title='Account'>
				<ui.Row
					label={authorized ? 'Reauthorize with ReviewDB' : 'Authorize with ReviewDB'}
					subLabel={
						authorized
							? 'You are connected to ReviewDB'
							: 'Sign in to review users and see your reviews'
					}
					onPress={() => void signIn()}
				/>
				<ui.Row
					label='View My Reviews'
					arrow
					disabled={!myId}
					onPress={myId ? () => openReviewsSheet(myId, 'You') : undefined}
				/>
				<ui.Row
					label='Manage Blocked Users'
					subLabel='Users you have blocked from leaving reviews'
					arrow
					disabled={!authorized}
					onPress={authorized ? openBlockedUsersSheet : undefined}
				/>
			</ui.Section>

			<ui.Section title='Preferences'>
				<ui.SwitchRow
					label='Notify About New Reviews'
					subLabel='Show a toast on startup when you have new reviews'
					value={store.get('notifyReviews', true)}
					onValueChange={(value) => store.set('notifyReviews', value)}
				/>
				<ui.SwitchRow
					label='Hide Timestamps'
					value={store.get('hideTimestamps', false)}
					onValueChange={(value) => store.set('hideTimestamps', value)}
				/>
				<ui.SwitchRow
					label='Hide Reviews From Blocked Users'
					subLabel='Hide reviews from users you have blocked on Discord'
					value={store.get('hideBlockedUsers', true)}
					onValueChange={(value) => store.set('hideBlockedUsers', value)}
				/>
			</ui.Section>

			<ui.Section title='Links'>
				<ui.Row
					label='ReviewDB Website'
					arrow
					onPress={() => void Linking.openURL('https://reviewdb.mantikafasi.dev')}
				/>
				<ui.Row
					label='ReviewDB Support Server'
					arrow
					onPress={() => void Linking.openURL('https://discord.gg/eWPBSbvznt')}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
