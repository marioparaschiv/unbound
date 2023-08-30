import { Theme, i18n, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Invite, Keys, Links } from '@constants';
import { useSettingsStore } from '@api/storage';
import { BundleManager } from '@api/native';
import { Invites } from '@metro/actions';
import { Dialog } from '@metro/ui';
import Assets from '@api/assets';

import Plugins from '@managers/plugins';
import Themes from '@managers/themes';

import { Navigation } from '@metro/components';
import { 
    Section,
    SwitchRow,
    Row,
    RowIcon
} from '@ui/components/FormHandler';

import Developer from './developer';
import Toasts from './toasts';
import IconsPage from './icons';

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
				<SwitchRow
					label={i18n.Messages.UNBOUND_RECOVERY_MODE}
					subLabel={i18n.Messages.UNBOUND_RECOVERY_MODE_DESC}
					icon={<RowIcon source={Icons.Retry} />}
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
			</Section>
			<Section>
				<Row
					label={i18n.Messages.UNBOUND_TOAST_SETTINGS}
					icon={<RowIcon source={Icons.Toasts} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_TOAST_SETTINGS,
						render: Toasts
					})}
					arrow
				/>
                <Row
					label={i18n.Messages.UNBOUND_MANAGE_ICONS}
					icon={<RowIcon source={Icons.Grid} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_MANAGE_ICONS,
						render: IconsPage
					})}
					arrow
				/>
				<Row
					label={i18n.Messages.UNBOUND_DEVELOPMENT_SETTINGS}
					icon={<RowIcon source={Icons.Development} />}
					onPress={() => navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_DEVELOPMENT_SETTINGS,
						render: Developer
					})}
					arrow
				/>
			</Section>
			<Section title={i18n.Messages.UNBOUND_INFO}>
				<Row
					label='Installed Plugins'
					icon={<RowIcon source={Icons.Plugins} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Plugins.addons.length}
					</RN.Text>}
				/>
				<Row
					label='Installed Themes'
					icon={<RowIcon source={Icons.Themes} />}
					trailing={<RN.Text style={styles.trailingText}>
						{Themes.addons.length}
					</RN.Text>}
				/>
			</Section>
			<Section title='Links'>
				<Row
					label='Discord Server'
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
					label='Twitter'
					icon={<RowIcon source={Icons.Twitter} />}
					onPress={() => RN.Linking.openURL(Links.Twitter)}
					arrow
				/>
			</Section>
		</RN.KeyboardAvoidingView>
	</RN.ScrollView>;
}

export default General;