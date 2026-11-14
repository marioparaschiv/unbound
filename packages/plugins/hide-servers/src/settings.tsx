import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { setHiddenGuilds } from '~/patches';

function SettingsPanel() {
	const hidden = useSetting('hidden');

	return (
		<ui.Page>
			<EntityList
				kind='guild'
				title={messages.HIDDEN}
				description={messages.HIDDEN_SUBTITLE}
				value={parseIdList(hidden)}
				labels={{
					add: messages.ADD_SERVER,
					title: messages.ADD_SERVER,
					search: messages.SEARCH_SERVERS,
					noResults: messages.NO_SERVERS,
					unknown: messages.UNKNOWN_SERVER,
					remove: messages.REMOVE_SERVER,
				}}
				onChange={setHiddenGuilds}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
