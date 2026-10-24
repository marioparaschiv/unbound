import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { Users } from '@unbound-app/api/metro/stores';
import { Linking } from 'react-native';

import { openBlockedUsersSheet } from '~/components/blocked-users-sheet';
import { openReviewsSheet } from '~/components/reviews-sheet';
import { settings } from '~/modules';
import { signIn } from '~/login';

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const authorized = Boolean(store.get('token', ''));
	const myId = Users.getCurrentUser()?.id;

	return (
		<Page>
			<Discord.TableRowGroup title='Account'>
				<Discord.TableRow
					label={authorized ? 'Reauthorize with ReviewDB' : 'Authorize with ReviewDB'}
					subLabel={
						authorized
							? 'You are connected to ReviewDB'
							: 'Sign in to review users and see your reviews'
					}
					onPress={() => void signIn()}
				/>
				<Discord.TableRow
					label='View My Reviews'
					arrow
					disabled={!myId}
					onPress={myId ? () => openReviewsSheet(myId, 'You') : undefined}
				/>
				<Discord.TableRow
					label='Manage Blocked Users'
					subLabel='Users you have blocked from leaving reviews'
					arrow
					disabled={!authorized}
					onPress={authorized ? openBlockedUsersSheet : undefined}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title='Preferences'>
				<Discord.TableSwitchRow
					label='Notify About New Reviews'
					subLabel='Show a toast on startup when you have new reviews'
					value={store.get('notifyReviews', true)}
					onValueChange={(value) => store.set('notifyReviews', value)}
				/>
				<Discord.TableSwitchRow
					label='Hide Timestamps'
					value={store.get('hideTimestamps', false)}
					onValueChange={(value) => store.set('hideTimestamps', value)}
				/>
				<Discord.TableSwitchRow
					label='Hide Reviews From Blocked Users'
					subLabel='Hide reviews from users you have blocked on Discord'
					value={store.get('hideBlockedUsers', true)}
					onValueChange={(value) => store.set('hideBlockedUsers', value)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title='Links'>
				<Discord.TableRow
					label='ReviewDB Website'
					arrow
					onPress={() => void Linking.openURL('https://reviewdb.mantikafasi.dev')}
				/>
				<Discord.TableRow
					label='ReviewDB Support Server'
					arrow
					onPress={() => void Linking.openURL('https://discord.gg/eWPBSbvznt')}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
