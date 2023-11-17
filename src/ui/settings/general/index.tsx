import { Section, SwitchRow, Row, Form, RowIcon } from '@ui/components/form';
import { Theme, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Invite, Keys, Links } from '@constants';
import { useSettingsStore } from '@api/storage';
import { Navigation } from '@metro/components';
import { Invites } from '@metro/actions';
import Plugins from '@managers/plugins';
import Themes from '@managers/themes';
import { reload } from '@api/native';
import { Strings } from '@api/i18n';
import { Dialog } from '@metro/ui';
import Assets from '@api/assets';

import Developer from '../developer';
import Toasts from './toasts';

const useStyles = StyleSheet.createStyles({
	trailingText: {
		color: Theme.colors.TEXT_MUTED
	},
	container: {
		marginBottom: 50
	}
});

function General() {
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	const Icons = {
		X: Assets.getIDByName('img_account_sync_x_white'),
		GitHub: Assets.getIDByName('img_account_sync_github_white'),
		Development: Assets.getIDByName('ic_progress_wrench_24px'),
		Plugins: Assets.getIDByName('ic_activity_24px'),
		Themes: Assets.getIDByName('ic_paint_brush'),
		Toasts: Assets.getIDByName('ic_notification_settings'),
		Grid: Assets.getIDByName('GridSquareIcon'),
		Retry: Assets.getIDByName('ic_message_retry'),
		Discord: Assets.getIDByName('logo'),
		Debug: Assets.getIDByName('debug')
	};

	return <Form>
		<RN.KeyboardAvoidingView
			enabled={true}
			behavior='position'
			style={styles.container}
			keyboardVerticalOffset={100}
			contentContainerStyle={{ backfaceVisibility: 'hidden' }}
		>
			<Section>
				<SwitchRow
					label={Strings.UNBOUND_RECOVERY_MODE}
					subLabel={Strings.UNBOUND_RECOVERY_MODE_DESC}
					icon={<RowIcon source={Icons.Retry} />}
					value={settings.get('recovery', false)}
					onValueChange={() => {
						settings.toggle('recovery', false);
						Dialog.confirm({
							title: Strings.UNBOUND_CHANGE_RESTART,
							body: Strings.UNBOUND_CHANGE_RESTART_DESC,
							confirmText: Strings.UNBOUND_RESTART,
							onConfirm: reload,
							onCancel: () => settings.toggle('recovery', false)
						});
					}}
				/>
			</Section>
			<Section>
				<Row
					label={Strings.UNBOUND_TOAST_SETTINGS}
					icon={<RowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings.UNBOUND_TOAST_SETTINGS,
						render: Toasts
					})}
					arrow
				/>
				<Row
					label={Strings.UNBOUND_DEVELOPMENT_SETTINGS}
					icon={<RowIcon source={Icons.Development} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: Strings.UNBOUND_DEVELOPMENT_SETTINGS,
						render: Developer
					})}
					arrow
				/>
			</Section>
			<Section title={Strings.UNBOUND_INFO}>
				<Row
					label={Strings.UNBOUND_INSTALLED_PLUGINS}
					icon={<RowIcon source={Icons.Plugins} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Plugins.addons.length}
					</RN.Text>}
				/>
				<Row
					label={Strings.UNBOUND_INSTALLED_THEMES}
					icon={<RowIcon source={Icons.Themes} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Themes.addons.length}
					</RN.Text>}
				/>
			</Section>
			<Section title='Links'>
				<Row
					label={Strings.UNBOUND_DISCORD_SERVER}
					icon={<RowIcon source={Icons.Discord} />}
					onPress={() => Invites.acceptInviteAndTransitionToInviteChannel({ inviteKey: Invite })}
					arrow
				/>
				<Row
					label='GitHub'
					icon={<RowIcon source={Icons.GitHub} />}
					onPress={() => RN.Linking.openURL(Links.GitHub)}
					arrow
				/>
				<Row
					label='X'
					icon={<RowIcon source={Icons.X} />}
					onPress={() => RN.Linking.openURL(Links.X)}
					arrow
				/>
			</Section>
		</RN.KeyboardAvoidingView>
	</Form>;
}

export default General;