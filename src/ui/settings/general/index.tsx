import { Section } from '@ui/components/form';
import { Theme, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Invite, Keys, Links } from '@constants';
import { useSettingsStore } from '@api/storage';
import { Redesign } from '@metro/components';
import { Linking } from '@metro/api';
import Plugins from '@managers/plugins';
import Themes from '@managers/themes';
import { reload } from '@api/native';
import { Strings } from '@api/i18n';
import Assets from '@api/assets';

import Developer from '../developer';
import Toasts from './toasts';
import { showAlert } from '@api/dialogs';

const { TableRow, TableSwitchRow, TableRowIcon } = Redesign;

const useStyles = StyleSheet.createStyles({
	trailingText: {
		color: Theme.colors.TEXT_MUTED
	},
	container: {
		marginBottom: 50
	}
});

function General() {
	const navigation = Redesign.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	const Icons = {
		X: Assets.getIDByName('img_account_sync_x_white'),
		GitHub: Assets.getIDByName('img_account_sync_github_white'),
		Development: Assets.getIDByName('ic_progress_wrench_24px'),
		Plugins: Assets.getIDByName('ic_wand'),
		Themes: Assets.getIDByName('ic_paint_brush'),
		Toasts: Assets.getIDByName('ic_notification_settings'),
		Grid: Assets.getIDByName('GridSquareIcon'),
		Retry: Assets.getIDByName('ic_message_retry'),
		Discord: Assets.getIDByName('logo'),
		Debug: Assets.getIDByName('debug')
	};

	return <RN.ScrollView>
		<RN.KeyboardAvoidingView
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
					icon={<TableRowIcon source={Icons.Retry} />}
					value={settings.get('recovery', false)}
					onValueChange={() => {
						settings.toggle('recovery', false);
						showAlert({
							title: Strings.UNBOUND_CHANGE_RESTART,
							content: Strings.UNBOUND_CHANGE_RESTART_DESC,
							buttons: [
								{
									text: Strings.UNBOUND_RESTART,
									onPress: reload
								},
								{
									text: Strings.CANCEL,
									onPress: () => settings.toggle('recovery', false)
								}
							]
						});
					}}
				/>
			</Section>
			<Section>
				<TableRow
					label={Strings.UNBOUND_TOAST_SETTINGS}
					icon={<TableRowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings.UNBOUND_TOAST_SETTINGS,
						render: Toasts
					})}
					arrow
				/>
				<TableRow
					label={Strings.UNBOUND_DEVELOPMENT_SETTINGS}
					icon={<TableRowIcon source={Icons.Development} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings.UNBOUND_DEVELOPMENT_SETTINGS,
						render: Developer
					})}
					arrow
				/>
			</Section>
			<Section title={Strings.UNBOUND_INFO}>
				<TableRow
					label={Strings.UNBOUND_INSTALLED_PLUGINS}
					icon={<TableRowIcon source={Icons.Plugins} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Plugins.addons.length}
					</RN.Text>}
				/>
				<TableRow
					label={Strings.UNBOUND_INSTALLED_THEMES}
					icon={<TableRowIcon source={Icons.Themes} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Themes.addons.length}
					</RN.Text>}
				/>
			</Section>
			<Section title='Links'>
				<TableRow
					label={Strings.UNBOUND_DISCORD_SERVER}
					icon={<TableRowIcon source={Icons.Discord} />}
					onPress={() => Linking.openDeeplink(`https://discord.gg/${Invite}`)}
					arrow
				/>
				<TableRow
					label={Strings.UNBOUND_GITHUB}
					icon={<TableRowIcon source={Icons.GitHub} />}
					onPress={() => RN.Linking.openURL(Links.GitHub)}
					arrow
				/>
				<TableRow
					label={`X / ${Strings.UNBOUND_TWITTER}`}
					icon={<TableRowIcon source={Icons.X} />}
					onPress={() => RN.Linking.openURL(Links.X)}
					arrow
				/>
			</Section>
		</RN.KeyboardAvoidingView>
	</RN.ScrollView>;
}

export default General;