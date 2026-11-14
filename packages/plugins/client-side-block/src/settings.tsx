import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { Discord } from '@unbound-app/api/metro/components';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

type SwitchKey = 'ignored' | 'replies';

type SwitchProps = { setting: SwitchKey; label: string; subLabel: string };

function SwitchRow({ setting, label, subLabel }: SwitchProps) {
	const value = useSetting(setting);

	return (
		<ui.SwitchRow
			label={label}
			subLabel={subLabel}
			value={value}
			onValueChange={(next: boolean) => {
				settings[setting] = next;
			}}
		/>
	);
}

function KeywordsField() {
	const keywords = useSetting('keywords');

	return (
		<Discord.TextInput
			label={messages.HIDDEN_KEYWORDS}
			description={messages.HIDDEN_KEYWORDS_SUBTITLE}
			placeholder={messages.HIDDEN_KEYWORDS_PLACEHOLDER}
			autoCapitalize='none'
			autoCorrect={false}
			multiline
			value={keywords}
			onChange={(next: string) => {
				settings.keywords = next;
			}}
		/>
	);
}

function SettingsPanel() {
	const users = useSetting('users');

	return (
		<ui.Page>
			<EntityList
				kind='user'
				title={messages.HIDDEN_USERS}
				description={messages.HIDDEN_USERS_SUBTITLE}
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
			<ui.Section>
				<KeywordsField />
			</ui.Section>
			<ui.Section>
				<SwitchRow
					setting='ignored'
					label={messages.HIDE_IGNORED}
					subLabel={messages.HIDE_IGNORED_SUBTITLE}
				/>
				<SwitchRow
					setting='replies'
					label={messages.HIDE_REPLIES}
					subLabel={messages.HIDE_REPLIES_SUBTITLE}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
