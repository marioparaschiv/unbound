import { DISCORD_INVITE, Screens, SocialLinks } from '@constants';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { BundleInfo, reload } from '@api/native';
import { useSettingsStore } from '@api/storage';
import { Discord } from '@api/metro/components';
import { showDialog } from '@api/dialogs';
import { Section } from '@ui/misc/forms';
import { Linking } from '@api/metro/api';
import Unbound from '@ui/icons/unbound';
import { showToast } from '@api/toasts';
import { Strings } from '@api/i18n';
import Assets from '@api/assets';
import { useMemo } from 'react';

import useStyles from './general.style';


const { TableRow, TableSwitchRow, TableRowIcon } = Discord;

function General() {
	const properties = useMemo(() => (HermesInternal as any).getRuntimeProperties(), []);
	const navigation = Discord.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	const Icons = {
		GitHub: Assets.getIDByName('img_account_sync_github_white'),
		Development: Assets.getIDByName('WrenchIcon'),
		Toasts: Assets.getIDByName('ic_notification_settings'),
		Trash: Assets.getIDByName('TrashIcon'),
		Shield: Assets.getIDByName('ShieldIcon'),
		Refresh: Assets.getIDByName('RefreshIcon'),
		Discord: Assets.getIDByName('logo'),
		Staff: Assets.getIDByName('ic_badge_staff'),
		Information: Assets.getIDByName('ic_information_24px')
	};

	return <ScrollView>
		<KeyboardAvoidingView
			behavior='position'
			style={styles.container}
			keyboardVerticalOffset={100}
			contentContainerStyle={styles.contentContainer}
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
				<TableRow
					label={Strings.UNBOUND_CLEAR_CACHES}
					icon={<TableRowIcon source={Icons.Trash} />}
					arrow
					onPress={() => {
						showToast({
							title: Strings.UNBOUND_CACHE_CLEARED_TITLE,
							content: Strings.UNBOUND_CACHE_CLEARED_DESCRIPTION,
							icon: 'trash'
						});
					}}
				/>
			</Section>
			<Section>
				<TableRow
					label={Strings.UNBOUND_TOAST_SETTINGS}
					icon={<TableRowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(Screens.Toasts)}
					arrow
				/>
				<TableRow
					label={Strings.UNBOUND_DEVELOPER_SETTINGS}
					icon={<TableRowIcon source={Icons.Development} />}
					onPress={() => navigation.push(Screens.Developer)}
					arrow
				/>
			</Section>
			<Section>
				<TableSwitchRow
					label={Strings.UNBOUND_STAFF_MODE_TITLE}
					subLabel={Strings.UNBOUND_STAFF_MODE_DESC}
					icon={<TableRowIcon source={Icons.Staff} />}
					value={settings.get('staff-mode', false)}
					onValueChange={() => settings.toggle('staff-mode', false)}
				/>
			</Section>
			<Section title={Strings.UNBOUND_LINKS}>
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
					trailing={<Discord.Text color='text-muted'>
						{window.unbound.version}
					</Discord.Text>}
				/>
				<TableRow
					label={Strings.UNBOUND_DISCORD_VERSION}
					icon={<TableRowIcon source={Icons.Discord} />}
					trailing={<Discord.Text color='text-muted'>
						{BundleInfo.Version}
					</Discord.Text>}
				/>
				<TableRow
					label={Strings.UNBOUND_BYTECODE_VERSION}
					icon={<TableRowIcon source={Icons.Information} />}
					trailing={<Discord.Text color='text-muted'>
						{properties['Bytecode Version']}
					</Discord.Text>}
				/>
			</Section>
		</KeyboardAvoidingView>
	</ScrollView>;
}

export default General;