import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { View } from 'react-native';

type SwitchProps = {
	setting: string;
	label: string;
	subLabel: string;
	fallback: boolean;
};

function SettingSwitch({ setting, label, subLabel, fallback }: SwitchProps) {
	const store = storage.useBucket(addon.id);

	return (
		<ui.SwitchRow
			label={label}
			subLabel={subLabel}
			value={store.get(setting, fallback)}
			onValueChange={(value) => store.set(setting, value)}
		/>
	);
}

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const saturation = store.get('messageSaturation', 30);

	return (
		<ui.Page>
			<ui.Section title='Chat'>
				<SettingSwitch
					setting='chatMentions'
					label='Color Mentions'
					subLabel='Show the mentioned member’s role colors in chat and the composer'
					fallback
				/>
				<SettingSwitch
					setting='colorChatMessages'
					label='Color Message Content'
					subLabel='Tint message text with the author’s role color'
					fallback={false}
				/>
				{Discord.Slider ? (
					<ui.Row
						label={
							<View
								style={{
									width: '100%',
									flexDirection: 'row',
									alignItems: 'center',
								}}
							>
								<Discord.Text
									variant='text-md/semibold'
									color='mobile-text-heading-primary'
								>
									Message color intensity
								</Discord.Text>
								<Discord.Text
									variant='text-sm/medium'
									color='text-muted'
									style={{ marginLeft: 'auto' }}
								>
									{new Intl.NumberFormat(undefined, { style: 'percent' }).format(
										saturation / 100,
									)}
								</Discord.Text>
							</View>
						}
						subLabel={
							<Discord.Slider
								minValue={0}
								maxValue={100}
								minimumValue={0}
								maximumValue={100}
								value={saturation}
								onChange={(value: number) =>
									store.set('messageSaturation', Math.round(value / 10) * 10)
								}
								onValueChange={(value: number) =>
									store.set('messageSaturation', Math.round(value / 10) * 10)
								}
							/>
						}
					/>
				) : null}
			</ui.Section>
			<ui.Section title='People and Roles'>
				<SettingSwitch
					setting='typingUsers'
					label='Typing Names'
					subLabel='Color names in the channel typing indicator'
					fallback
				/>
				<SettingSwitch
					setting='memberList'
					label='Member List Role Headers'
					subLabel='Color role section titles in the member list'
					fallback
				/>
				<SettingSwitch
					setting='reactorsList'
					label='Reaction Users'
					subLabel='Color names in the reaction details list'
					fallback
				/>
				<SettingSwitch
					setting='pollResults'
					label='Poll Voters'
					subLabel='Color names in poll result details'
					fallback
				/>
				<SettingSwitch
					setting='voiceUsers'
					label='Voice Users'
					subLabel='Color members’ names in voice user lists'
					fallback
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
