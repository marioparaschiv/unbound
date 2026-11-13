import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { formatUserList, parseUserList } from '~/lib/user-list';

function SettingsPanel() {
	const userList = useSetting('userList');
	const pingListed = useSetting('shouldPingListed');

	return (
		<ui.Page>
			<EntityList
				kind='user'
				title={messages.EXCEPTIONS}
				description={messages.ADD_USER_ID_SUBTITLE}
				value={parseUserList(userList)}
				labels={{
					add: messages.ADD_USER,
					title: messages.ADD_USER,
					search: messages.SEARCH_USERS,
					noResults: messages.NO_USERS_FOUND,
					unknown: messages.UNKNOWN_USER,
					remove: messages.REMOVE_USER,
				}}
				onChange={(ids) => {
					settings.userList = formatUserList(ids);
				}}
			/>
			<ui.Section>
				<ui.SwitchRow
					label={messages.ONLY_PING_LISTED}
					subLabel={
						pingListed ? messages.ONLY_PING_LISTED_ON : messages.ONLY_PING_LISTED_OFF
					}
					value={pingListed}
					onValueChange={(value) => {
						settings.shouldPingListed = value;
					}}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
