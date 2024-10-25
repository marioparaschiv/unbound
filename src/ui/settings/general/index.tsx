import { DISCORD_INVITE, SettingsKeys, SocialLinks } from '@constants';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { BundleInfo, reload } from '@api/native';
import { useSettingsStore } from '@api/storage';
import { Discord } from '@api/metro/components';
import { Theme } from '@api/metro/common';
import { showDialog } from '@api/dialogs';
import { Section } from '@ui/misc/forms';
import { Linking } from '@api/metro/api';
import Unbound from '@ui/icons/unbound';
import { Strings } from '@api/i18n';
import Assets from '@api/assets';
import { useMemo } from 'react';

import Developer from '../developer';
import Toasts from './toasts';


const { TableRow, TableSwitchRow, TableRowIcon } = Discord;

const useStyles = Discord.createStyles({
	trailingText: {
		color: Theme.colors.TEXT_MUTED
	},
	container: {
		marginBottom: 50
	}
});

function General() {
	const properties = useMemo(() => (HermesInternal as any).getRuntimeProperties(), []);
	const navigation = Discord.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	const Icons = {
		X: Assets.getIDByName('img_account_sync_x_white'),
		GitHub: Assets.getIDByName('img_account_sync_github_white'),
		Development: Assets.getIDByName('ic_progress_wrench_24px'),
		Plugins: Assets.getIDByName('ic_wand'),
		Toasts: Assets.getIDByName('ic_notification_settings'),
		Grid: Assets.getIDByName('GridSquareIcon'),
		Shield: Assets.getIDByName('ShieldIcon'),
		Refresh: Assets.getIDByName('RefreshIcon'),
		Discord: Assets.getIDByName('logo'),
		HammerAndChisel: Assets.getIDByName('ic_hammer_and_chisel_24px'),
		Debug: Assets.getIDByName('debug'),
		Information: Assets.getIDByName('ic_information_24px')
	};

	return <ScrollView>
		<KeyboardAvoidingView
			enabled={true}
			behavior='position'
			style={styles.container}
			keyboardVerticalOffset={100}
			contentContainerStyle={{ backfaceVisibility: 'hidden' }}
		>
			<Section>
				<TableSwitchRow
					label={Strings.UNBOUND_RECOVERY_MODE}
					subLabel={Strings.UNBOUND_RECOVERY_MODE_DESC}
					icon={<TableRowIcon source={Icons.Shield} />}
					value={settings.get('recovery', false)}
					onValueChange={() => {
						settings.toggle('recovery', false);
						showDialog({
							title: Strings.UNBOUND_CHANGE_RESTART,
							content: Strings.UNBOUND_CHANGE_RESTART_DESC,
							onCancel: () => settings.toggle('recovery', false),
							buttons: [
								{
									text: Strings.UNBOUND_RESTART,
									onPress: reload
								}
							]
						});
					}}
				/>
				<TableRow
					label={Strings.UNBOUND_RESTART}
					icon={<TableRowIcon source={Icons.Refresh} />}
					arrow
					onPress={reload}
				/>
			</Section>
			<Section>
				<TableRow
					label={Strings.UNBOUND_TOAST_SETTINGS}
					icon={<TableRowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(SettingsKeys.Custom, {
						title: Strings.UNBOUND_TOAST_SETTINGS,
						render: Toasts
					})}
					arrow
				/>
				<TableRow
					label={Strings.UNBOUND_DEVELOPER_SETTINGS}
					icon={<TableRowIcon source={Icons.Development} />}
					onPress={() => navigation.push(SettingsKeys.Custom, {
						title: Strings.UNBOUND_DEVELOPER_SETTINGS,
						render: Developer
					})}
					arrow
				/>
			</Section>
			<Section>
				<TableSwitchRow
					label={Strings.UNBOUND_EXPERIMENTS_TITLE}
					subLabel={Strings.UNBOUND_EXPERIMENTS_DESC}
					icon={<TableRowIcon source={Icons.HammerAndChisel} />}
					value={settings.get('experiments', false)}
					onValueChange={() => settings.toggle('experiments', false)}
				/>
			</Section>
			<Section title='Links'>
				<TableRow
					label={Strings.UNBOUND_DISCORD_SERVER}
					icon={<TableRowIcon source={Icons.Discord} />}
					onPress={() => Linking.openDeeplink(`https://discord.gg/${DISCORD_INVITE}`)}
					arrow
				/>
				<TableRow
					label={Strings.UNBOUND_GITHUB}
					icon={<TableRowIcon source={Icons.GitHub} />}
					onPress={() => Linking.openURL(SocialLinks.GitHub)}
					arrow
				/>
			</Section>
			<Section title={Strings.UNBOUND_INFO}>
				<TableRow
					label={Strings.UNBOUND_UNBOUND_VERSION}
					onPress={() => Linking.openURL(`https://github.com/unbound-mod/client/commit/${window.unbound.version}`)}
					icon={<TableRowIcon IconComponent={Unbound} />}
					trailing={<Text style={styles.trailingText}>
						{window.unbound.version}
					</Text>}
				/>
				<TableRow
					label={Strings.UNBOUND_DISCORD_VERSION}
					icon={<TableRowIcon source={Icons.Discord} />}
					trailing={<Text style={styles.trailingText}>
						{BundleInfo.Version}
					</Text>}
				/>
				<TableRow
					label={Strings.UNBOUND_BYTECODE_VERSION}
					icon={<TableRowIcon source={Icons.Information} />}
					trailing={<Text style={styles.trailingText}>
						{properties['Bytecode Version']}
					</Text>}
				/>
			</Section>
		</KeyboardAvoidingView>
	</ScrollView>;
}

export default General;