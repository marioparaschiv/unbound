import EntityListRow from '@unbound-plugins/shared/entities/entity-list-row';
import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { playJoinSound } from '~/lib/play';

function FriendList() {
	const value = useSetting('users');

	return (
		<EntityList
			kind='user'
			description={messages.FRIENDS_SUBTITLE}
			value={parseIdList(value)}
			labels={{
				add: messages.ADD_USER,
				title: messages.ADD_USER,
				search: messages.SEARCH_USERS,
				noResults: messages.NO_RESULTS,
				unknown: messages.UNKNOWN_USER,
				remove: messages.REMOVE,
			}}
			onChange={(ids) => {
				settings.users = formatIdList(ids);
			}}
		/>
	);
}

function SettingsPanel() {
	const count = parseIdList(useSetting('users')).length;

	return (
		<ui.Page>
			<ui.Section>
				<EntityListRow
					label={messages.FRIENDS}
					count={count}
					renderList={() => <FriendList />}
				/>
				<ui.Row label={messages.PREVIEW} onPress={() => playJoinSound()} />
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
