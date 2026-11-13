import EntityListRow from '@unbound-plugins/shared/entities/entity-list-row';
import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import IgnoreList, { IGNORE_LISTS, type IgnoreListKey } from '~/components/ignore-list';

type SwitchKey = 'regex' | 'caseSensitive' | 'wholeWords' | 'ignoreBots';

type SwitchProps = { setting: SwitchKey; label: string; subLabel?: string };

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

function IgnoreListRow({ setting }: { setting: IgnoreListKey }) {
	const count = parseIdList(useSetting(setting)).length;

	return (
		<EntityListRow
			label={IGNORE_LISTS[setting].texts().title}
			count={count}
			renderList={() => <IgnoreList setting={setting} />}
		/>
	);
}

function SettingsPanel() {
	const keywords = useSetting('keywords');

	return (
		<ui.Page>
			<ui.ListRow
				title={messages.KEYWORDS}
				description={messages.KEYWORDS_SUBTITLE}
				value={[...keywords]}
				onChange={(value: string[]) => {
					settings.keywords = value;
				}}
			/>
			<ui.Section title={messages.MATCHING}>
				<SwitchRow
					setting='regex'
					label={messages.REGEX}
					subLabel={messages.REGEX_SUBTITLE}
				/>
				<SwitchRow setting='caseSensitive' label={messages.CASE_SENSITIVE} />
				<SwitchRow setting='wholeWords' label={messages.WHOLE_WORDS} />
			</ui.Section>
			<ui.Section title={messages.IGNORED}>
				<SwitchRow setting='ignoreBots' label={messages.IGNORE_BOTS} />
				<IgnoreListRow setting='ignoreUsers' />
				<IgnoreListRow setting='ignoreChannels' />
				<IgnoreListRow setting='ignoreGuilds' />
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
