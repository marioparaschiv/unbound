import { settings, useSetting, type BooleanSettingKey } from '@unbound-app/settings';
import { messages, type MessageKey } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

type Toggle = {
	name: BooleanSettingKey;
	title: MessageKey;
	subtitle: MessageKey;
};

const SECTIONS: { title: () => string; toggles: Toggle[] }[] = [
	{
		title: () => messages.SHOW_INDICATORS,
		toggles: [
			{ name: 'memberList', title: 'MEMBER_LIST', subtitle: 'MEMBER_LIST_SUBTITLE' },
			{ name: 'profiles', title: 'PROFILES', subtitle: 'PROFILES_SUBTITLE' },
			{ name: 'messages', title: 'MESSAGES', subtitle: 'MESSAGES_SUBTITLE' },
		],
	},
	{
		title: () => messages.STATUS,
		toggles: [
			{
				name: 'colorMobileIndicator',
				title: 'COLOR_MOBILE_INDICATOR',
				subtitle: 'COLOR_MOBILE_INDICATOR_SUBTITLE',
			},
		],
	},
];

function SettingSwitch({ name, title, subtitle }: Toggle) {
	const value = useSetting(name);

	return (
		<ui.SwitchRow
			label={messages[title]}
			subLabel={messages[subtitle]}
			value={value}
			onValueChange={(value) => (settings[name] = value)}
		/>
	);
}

// A custom panel, since the generated one cannot group flat settings under two headings.
export function SettingsPanel() {
	return (
		<ui.Page>
			{SECTIONS.map(({ title, toggles }) => (
				<ui.Section key={title()} title={title()}>
					{toggles.map((toggle) => (
						<SettingSwitch key={toggle.name} {...toggle} />
					))}
				</ui.Section>
			))}
		</ui.Page>
	);
}
