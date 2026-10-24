import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';

import { settings } from '~/modules';

type SwitchProps = {
	setting: string;
	label: string;
	subLabel: string;
	fallback: boolean;
};

function SettingSwitch({ setting, label, subLabel, fallback }: SwitchProps) {
	const store = settings.useSettingsStore();

	return (
		<Discord.TableSwitchRow
			label={label}
			subLabel={subLabel}
			value={store.get(setting, fallback)}
			onValueChange={(value) => store.set(setting, value)}
		/>
	);
}

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const saturation = store.get('messageSaturation', 30);

	return (
		<Page>
			<Discord.TableRowGroup title='Chat'>
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
					<Discord.TableRow
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
								minimumValue={0}
								maximumValue={100}
								value={saturation}
								onValueChange={(value) =>
									store.set('messageSaturation', Math.round(value / 10) * 10)
								}
							/>
						}
					/>
				) : null}
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title='People and Roles'>
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
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
