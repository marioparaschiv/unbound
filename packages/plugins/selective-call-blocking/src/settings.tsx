import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

function SettingsPanel() {
	const users = useSetting('users');
	const groups = useSetting('groups');

	return (
		<ui.Page>
			<EntityList
				kind='user'
				title={messages.SILENCED_USERS}
				description={messages.SILENCED_USERS_SUBTITLE}
				value={parseIdList(users)}
				labels={{
					add: messages.ADD_USER,
					title: messages.ADD_USER,
					search: messages.SEARCH_USERS,
					noResults: messages.NO_USERS_FOUND,
					unknown: messages.UNKNOWN_USER,
					remove: messages.REMOVE_USER,
				}}
				onChange={(ids) => {
					settings.users = formatIdList(ids);
				}}
			/>
			<EntityList
				kind='group'
				title={messages.SILENCED_GROUPS}
				description={messages.SILENCED_GROUPS_SUBTITLE}
				value={parseIdList(groups)}
				labels={{
					add: messages.ADD_GROUP,
					title: messages.ADD_GROUP,
					search: messages.SEARCH_GROUPS,
					noResults: messages.NO_GROUPS_FOUND,
					unknown: messages.UNKNOWN_GROUP,
					remove: messages.REMOVE_GROUP,
				}}
				onChange={(ids) => {
					settings.groups = formatIdList(ids);
				}}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
