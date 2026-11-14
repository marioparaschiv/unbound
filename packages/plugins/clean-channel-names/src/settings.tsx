import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

function SettingsPanel() {
	const spaces = useSetting('spaces');
	const kept = useSetting('kept');

	return (
		<ui.Page>
			<ui.Section>
				<ui.SwitchRow
					label={messages.SPACES}
					subLabel={messages.SPACES_SUBTITLE}
					value={spaces}
					onValueChange={(next: boolean) => {
						settings.spaces = next;
					}}
				/>
			</ui.Section>
			<EntityList
				kind='channel'
				title={messages.KEPT}
				description={messages.KEPT_SUBTITLE}
				value={parseIdList(kept)}
				labels={{
					add: messages.ADD_CHANNEL,
					title: messages.ADD_CHANNEL,
					search: messages.SEARCH_CHANNELS,
					noResults: messages.NO_CHANNELS,
					unknown: messages.UNKNOWN_CHANNEL,
					remove: messages.REMOVE_CHANNEL,
				}}
				onChange={(ids) => {
					settings.kept = formatIdList(ids);
				}}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
