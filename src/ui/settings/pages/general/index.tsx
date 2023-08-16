import { Theme, i18n, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Invite, Keys, Links } from '@constants';
import { useSettingsStore } from '@api/storage';
import { BundleManager } from '@api/native';
import { Invites } from '@metro/actions';
import { Dialog } from '@metro/ui';
import * as Icon from '@ui/icons';
import Assets from '@api/assets';

import Plugins from '@managers/plugins';
import Themes from '@managers/themes';

import { Redesign, Navigation } from '@metro/components';
import { TableRowGroupWrapper } from '@ui/components';
import Developer from './developer';
import Toasts from './toasts';

const { TableRow, TableSwitchRow, TableRowIcon } = Redesign;

const styles = StyleSheet.createThemedStyleSheet({
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

	const Icons = {
		Twitter: Assets.getIDByName('img_account_sync_twitter_white'),
		GitHub: Assets.getIDByName('img_account_sync_github_white'),
		Development: Assets.getIDByName('ic_progress_wrench_24px'),
        Plugins: Assets.getIDByName('ic_activity_24px'),
        Themes: Assets.getIDByName('ic_paint_brush'),
		Toasts: Assets.getIDByName('ic_notification_settings'),
		Retry: Assets.getIDByName('ic_message_retry'),
		Discord: Assets.getIDByName('Discord'),
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
			<TableRowGroupWrapper>
				<TableSwitchRow
					label={i18n.Messages.UNBOUND_RECOVERY_MODE}
					subLabel={i18n.Messages.UNBOUND_RECOVERY_MODE_DESC}
					icon={<TableRowIcon source={Icons.Retry} />}
					value={settings.get('recovery', false)}
                    onValueChange={() => {
                        settings.toggle('recovery', false);
                        Dialog.confirm({
                            title: i18n.Messages.UNBOUND_CHANGE_RESTART,
                            body: i18n.Messages.UNBOUND_CHANGE_RESTART_DESC,
                            confirmText: i18n.Messages.UNBOUND_RESTART,
                            onConfirm: BundleManager.reload,
                            onCancel: () => settings.toggle('recovery', false)
                        });
                    }}
				/>
			</TableRowGroupWrapper>
			<TableRowGroupWrapper>
				<TableRow
					label={i18n.Messages.UNBOUND_TOAST_SETTINGS}
					icon={<TableRowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_TOAST_SETTINGS,
						render: Toasts
					})}
                    arrow
				/>
				<TableRow
					label={i18n.Messages.UNBOUND_DEVELOPMENT_SETTINGS}
					icon={<TableRowIcon source={Icons.Development} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_DEVELOPMENT_SETTINGS,
						render: Developer
					})}
                    arrow
				/>
			</TableRowGroupWrapper>
			<TableRowGroupWrapper title={i18n.Messages.UNBOUND_INFO}>
				<TableRow
					label='Installed Plugins'
					icon={<TableRowIcon source={Icons.Plugins} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Plugins.addons.length}
					</RN.Text>}
				/>
				<TableRow
					label='Installed Themes'
					icon={<TableRowIcon source={Icons.Themes} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Themes.addons.length}
					</RN.Text>}
				/>
			</TableRowGroupWrapper>
			<TableRowGroupWrapper title='Links'>
				<TableRow
					label='Discord Server'
					icon={<TableRowIcon source={Icons.Discord} />}
					onPress={() => Invites.acceptInviteAndTransitionToInviteChannel({ inviteKey: Invite })}
                    arrow
				/>
				<TableRow
					label='GitHub'
					icon={<TableRowIcon source={Icons.GitHub} />}
					onPress={() => RN.Linking.openURL(Links.GitHub)}
                    arrow
				/>
				<TableRow
					label='Twitter'
					icon={<TableRowIcon source={Icons.Twitter} />}
					onPress={() => RN.Linking.openURL(Links.Twitter)}
                    arrow
				/>
			</TableRowGroupWrapper>
		</RN.KeyboardAvoidingView>
	</RN.ScrollView>;
}

export default General;