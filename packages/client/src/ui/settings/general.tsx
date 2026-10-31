import { useMemo } from 'react';

import { Screens, SOCIAL_LINKS, DISCORD_INVITE, VERSION, REPOSITORY } from '~/core/constants';
import { readDebugInfo, readEntitlements } from '~/diagnostics/debug-report';
import { BundleInfo, reload, getRuntimeProperties } from '~/native/native';
import { useUnboundSettings } from '~/settings/unbound';
import { issueURL } from '~/diagnostics/issue-report';
import { Linking, Invites } from '~/metro/api';
import { Discord } from '~/metro/components';
import Unbound from '~/ui/icons/unbound';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import InfoRow from './info-row';

/**
 * @description The main Unbound settings page: recovery, restart, staff mode, links, and version info.
 */
function GeneralPage() {
	const navigation = Discord.useNavigation();
	const settings = useUnboundSettings();
	const bytecode = useMemo(() => getRuntimeProperties()['Bytecode Version'], []);

	function confirmRestart() {
		Discord.showConfirmModal({
			title: messages.UNBOUND_RESTART,
			content: messages.UNBOUND_RESTART_CONFIRM,
			confirmText: messages.UNBOUND_RESTART,
			cancelText: messages.UNBOUND_CANCEL,
			onConfirm: reload,
		});
	}

	function setRecoveryMode(value: boolean) {
		settings.set('recovery', value);
		confirmRestart();
	}

	return (
		<Page>
			<Discord.TableRowGroup>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_RECOVERY_MODE}
					subLabel={messages.UNBOUND_RECOVERY_MODE_DESC}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					value={settings.get('recovery')}
					onValueChange={setRecoveryMode}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_RESTART}
					icon={<Discord.TableRowIcon source={icons.RetryIcon} />}
					onPress={confirmRestart}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup>
				<Discord.TableRow
					label={messages.UNBOUND_TOASTS}
					icon={<Discord.TableRowIcon source={icons.BellIcon} />}
					arrow
					onPress={() => navigation.push(Screens.Toasts)}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_CLOUD_SYNC}
					icon={<Discord.TableRowIcon source={icons.CloudIcon} />}
					arrow
					onPress={() => navigation.push(Screens.CloudSync)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_ADVANCED}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_CRASH_REPORTS}
					subLabel={messages.UNBOUND_CRASH_REPORTS_DESCRIPTION}
					icon={<Discord.TableRowIcon source={icons.BugIcon ?? icons.WarningIcon} />}
					value={settings.get('crash-reports')}
					onValueChange={() => settings.toggle('crash-reports')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_STAFF_MODE}
					icon={<Discord.TableRowIcon source={icons.EyeIcon} />}
					value={settings.get('staff-mode')}
					onValueChange={() => settings.toggle('staff-mode')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_DEVELOPER_MODE}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					value={settings.get('developer-mode')}
					onValueChange={() => settings.toggle('developer-mode')}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_LINKS}>
				<Discord.TableRow
					label={messages.UNBOUND_GITHUB}
					icon={<Discord.TableRowIcon source={icons['img_account_sync_github_white']} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.GitHub)}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_DOCS}
					icon={<Discord.TableRowIcon source={icons.BookCheckIcon} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.Docs)}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_REPORT_ISSUE}
					icon={<Discord.TableRowIcon source={icons.BugIcon ?? icons.WarningIcon} />}
					onPress={() => Linking.openURL(issueURL(readDebugInfo(), readEntitlements()))}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_SUPPORT_SERVER}
					icon={<Discord.TableRowIcon source={icons.ClydeIcon} />}
					onPress={() =>
						Invites.acceptInviteAndTransitionToInviteChannel({
							inviteKey: DISCORD_INVITE,
							context: { location: 'Join Guild' },
						})
					}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_VERSION_INFO}>
				<InfoRow
					label={messages.UNBOUND_UNBOUND_VERSION}
					value={VERSION}
					icon={<Discord.TableRowIcon IconComponent={Unbound} />}
					onPress={() =>
						Linking.openURL(`https://github.com/${REPOSITORY}/commit/${VERSION}`)
					}
				/>
				<InfoRow
					label={messages.UNBOUND_DISCORD_VERSION}
					value={`${BundleInfo.Version} (${BundleInfo.Build})`}
					icon={<Discord.TableRowIcon source={icons.ClydeIcon} />}
				/>
				<InfoRow
					label={messages.UNBOUND_BYTECODE_VERSION}
					value={String(bytecode)}
					icon={<Discord.TableRowIcon source={icons['ic_information_24px']} />}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default GeneralPage;
