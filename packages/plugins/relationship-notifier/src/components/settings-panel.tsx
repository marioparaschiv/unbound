import { storage, ui } from '@unbound-app/api';

import { SETTINGS, type SettingKey } from '~/constants';

type Toggle = {
	key: SettingKey;
	label: string;
	subLabel: string;
};

const SECTIONS: { title: string; toggles: Toggle[] }[] = [
	{
		title: 'Notify When',
		toggles: [
			{ key: 'friends', label: 'Friends', subLabel: 'A friend removes you' },
			{
				key: 'friendRequestCancels',
				label: 'Friend Requests',
				subLabel: 'A friend request to you is cancelled',
			},
			{ key: 'servers', label: 'Servers', subLabel: 'You are removed from a server' },
			{ key: 'groups', label: 'Group Chats', subLabel: 'You are removed from a group chat' },
		],
	},
	{
		title: 'Behaviour',
		toggles: [
			{
				key: 'offlineRemovals',
				label: 'Offline Removals',
				subLabel: 'When Discord opens, report removals that happened while it was closed',
			},
			{
				key: 'notices',
				label: 'Persistent Notices',
				subLabel: 'Keep each notification on screen until you dismiss it',
			},
		],
	},
];

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			{SECTIONS.map(({ title, toggles }) => (
				<ui.Section key={title} title={title}>
					{toggles.map(({ key, label, subLabel }) => (
						<ui.SwitchRow
							key={key}
							label={label}
							subLabel={subLabel}
							value={settings.get(key, SETTINGS[key])}
							onValueChange={(value) => settings.set(key, value)}
						/>
					))}
				</ui.Section>
			))}
		</ui.Page>
	);
}

export default SettingsPanel;
