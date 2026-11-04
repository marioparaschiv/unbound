import { useSetting, settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { Linking } from 'react-native';
import { ui } from '@unbound-app/api';

import { openBlockedUsersSheet } from '~/reviews/components/blocked-users-sheet';
import { openReviewsSheet } from '~/reviews/components/reviews-sheet';
import { UserStore } from '~/reviews/modules';
import { signIn } from '~/reviews/login';

const WEBSITE_URL = 'https://reviewdb.mantikafasi.dev';
const SUPPORT_SERVER_URL = 'https://discord.gg/eWPBSbvznt';

/**
 * @description The settings screen: sign-in, the viewer's reviews and blocked users, the preferences and links.
 * Custom because the sign-in row's text and the blocked-users row's state follow whether the viewer signed in.
 */
export function SettingsPanel() {
	const authorized = Boolean(useSetting('token'));
	const notifyReviews = useSetting('notifyReviews');
	const hideTimestamps = useSetting('hideTimestamps');
	const hideBlockedUsers = useSetting('hideBlockedUsers');
	const myId = UserStore.getCurrentUser()?.id;

	return (
		<ui.Page>
			<ui.Section title={messages.ACCOUNT}>
				<ui.Row
					label={authorized ? messages.REAUTHORIZE : messages.AUTHORIZE}
					subLabel={
						authorized ? messages.REAUTHORIZE_SUBTITLE : messages.AUTHORIZE_SUBTITLE
					}
					onPress={() => void signIn()}
				/>
				<ui.Row
					label={messages.VIEW_MY_REVIEWS}
					arrow
					disabled={!myId}
					onPress={myId ? () => openReviewsSheet(myId, messages.YOU) : undefined}
				/>
				<ui.Row
					label={messages.MANAGE_BLOCKED_USERS}
					subLabel={messages.MANAGE_BLOCKED_USERS_SUBTITLE}
					arrow
					disabled={!authorized}
					onPress={authorized ? openBlockedUsersSheet : undefined}
				/>
			</ui.Section>

			<ui.Section title={messages.PREFERENCES}>
				<ui.SwitchRow
					label={messages.NOTIFY_REVIEWS}
					subLabel={messages.NOTIFY_REVIEWS_SUBTITLE}
					value={notifyReviews}
					onValueChange={(value) => (settings.notifyReviews = value)}
				/>
				<ui.SwitchRow
					label={messages.HIDE_TIMESTAMPS}
					value={hideTimestamps}
					onValueChange={(value) => (settings.hideTimestamps = value)}
				/>
				<ui.SwitchRow
					label={messages.HIDE_BLOCKED_USERS}
					subLabel={messages.HIDE_BLOCKED_USERS_SUBTITLE}
					value={hideBlockedUsers}
					onValueChange={(value) => (settings.hideBlockedUsers = value)}
				/>
			</ui.Section>

			<ui.Section title={messages.LINKS}>
				<ui.Row
					label={messages.WEBSITE}
					arrow
					onPress={() => void Linking.openURL(WEBSITE_URL)}
				/>
				<ui.Row
					label={messages.SUPPORT_SERVER}
					arrow
					onPress={() => void Linking.openURL(SUPPORT_SERVER_URL)}
				/>
			</ui.Section>
		</ui.Page>
	);
}
