import { View } from 'react-native';

import { Screens, SOCIAL_LINKS, DISCORD_INVITE } from '~/core/constants';
import { useUnboundSettings } from '~/settings/unbound';
import AccountGroup from '~/ui/account/account-group';
import useSignIn from '~/ui/account/use-sign-in';
import { Linking, Invites } from '~/metro/api';
import { Discord } from '~/metro/components';
import { useAccount } from '~/account/api';
import { showDialog } from '~/dialogs/api';
import { useBucket } from '~/storage/api';
import { SYNC_STORE } from '~/sync/api';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import confirmRestart from './confirm-restart';
import GeneralHeader from './general-header';
import QuickActions from './quick-actions';
import SponsorCard from './sponsor-card';
import useStyles from './general.style';

function openSupportServer() {
	Invites.acceptInviteAndTransitionToInviteChannel({
		inviteKey: DISCORD_INVITE,
		context: { location: 'Join Guild' },
	});
}

function onOff(on: boolean) {
	return <Discord.TableRow.TrailingText text={on ? messages.UNBOUND_ON : messages.UNBOUND_OFF} />;
}

/**
 * @description The main Unbound settings page: the banner and quick actions, recovery, the account,
 * preferences, advanced switches and help.
 */
function GeneralPage() {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const settings = useUnboundSettings();
	const account = useAccount();
	const signIn = useSignIn();
	const sync = useBucket(SYNC_STORE, ({ key }) => key === 'enabled');

	function openSync() {
		if (account) {
			navigation.push(Screens.Sync);

			return;
		}

		// Discord's confirm modal styles its button as destructive; signing in is the primary action.
		showDialog({
			title: messages.UNBOUND_SYNC_SIGN_IN_TITLE,
			body: messages.UNBOUND_SYNC_SIGN_IN_DESC,
			buttons: [
				{
					label: messages.UNBOUND_SIGN_IN,
					variant: 'primary',
					onPress: () => signIn.start(() => navigation.push(Screens.Sync)),
				},
			],
			cancel: messages.UNBOUND_CANCEL,
		});
	}

	function setRecoveryMode(value: boolean) {
		settings.set('recovery', value);
		confirmRestart();
	}

	function setCrashReports(value: boolean) {
		if (!value) {
			settings.set('crash-reports', false);

			return;
		}

		// Reports leave the device, so the full disclosure is shown before opting in.
		Discord.showConfirmModal({
			title: messages.UNBOUND_CRASH_REPORTS,
			content: messages.UNBOUND_CRASH_REPORTS_DESCRIPTION,
			confirmText: messages.UNBOUND_ENABLE,
			cancelText: messages.UNBOUND_CANCEL,
			onConfirm: () => settings.set('crash-reports', true),
		});
	}

	return (
		<Page>
			<View style={styles.top}>
				<GeneralHeader />
				<QuickActions />
				<Discord.TableRowGroup>
					<Discord.TableSwitchRow
						label={messages.UNBOUND_RECOVERY_MODE}
						subLabel={messages.UNBOUND_RECOVERY_MODE_DESC}
						icon={
							<Discord.TableRowIcon source={icons.ShieldIcon ?? icons.WrenchIcon} />
						}
						value={settings.get('recovery')}
						onValueChange={setRecoveryMode}
					/>
				</Discord.TableRowGroup>
			</View>

			<AccountGroup />

			<SponsorCard />

			<Discord.TableRowGroup title={messages.UNBOUND_PREFERENCES}>
				<Discord.TableRow
					label={messages.UNBOUND_TOASTS}
					icon={<Discord.TableRowIcon source={icons.BellIcon} />}
					trailing={onOff(settings.get('toasts.enabled'))}
					arrow
					onPress={() => navigation.push(Screens.Toasts)}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_CLOUD_SYNC}
					icon={<Discord.TableRowIcon source={icons.CloudIcon} />}
					trailing={onOff(sync.get('enabled', false))}
					arrow
					onPress={openSync}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_ADVANCED}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_DEVELOPER_MODE}
					subLabel={messages.UNBOUND_DEVELOPER_MODE_DESC}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					value={settings.get('developer-mode')}
					onValueChange={() => settings.toggle('developer-mode')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_STAFF_MODE}
					subLabel={messages.UNBOUND_STAFF_MODE_DESC}
					icon={<Discord.TableRowIcon source={icons.EyeIcon} />}
					value={settings.get('staff-mode')}
					onValueChange={() => settings.toggle('staff-mode')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_CRASH_REPORTS}
					icon={<Discord.TableRowIcon source={icons.BugIcon ?? icons.WarningIcon} />}
					value={settings.get('crash-reports')}
					onValueChange={setCrashReports}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_HELP}>
				<Discord.TableRow
					label={messages.UNBOUND_SUPPORT_SERVER}
					icon={<Discord.TableRowIcon source={icons.ClydeIcon} />}
					arrow
					onPress={openSupportServer}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_DOCS}
					icon={<Discord.TableRowIcon source={icons.BookCheckIcon} />}
					arrow
					onPress={() => Linking.openURL(SOCIAL_LINKS.Docs)}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_GITHUB}
					icon={<Discord.TableRowIcon source={icons['img_account_sync_github_white']} />}
					arrow
					onPress={() => Linking.openURL(SOCIAL_LINKS.GitHub)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default GeneralPage;
