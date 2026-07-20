import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { Screens, SOCIAL_LINKS, DISCORD_INVITE, VERSION } from '~/lib/constants';
import { BundleInfo, reload, getRuntimeProperties } from '~/api/native';
import { Linking, Invites } from '~/api/metro/api';
import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import Unbound from '~/ui/icons/unbound';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';
import { Icons } from '~/api/assets';

type InfoRowProps = {
	label: string;
	value: string;
	icon: ReactNode;
	onPress?: () => void;
};

/** A version-info row: label on the left, an icon, and a muted value trailing on the right. */
function InfoRow({ label, value, icon, onPress }: InfoRowProps) {
	return (
		<Discord.TableRow
			label={label}
			icon={icon}
			onPress={onPress}
			trailing={<Discord.TableRow.TrailingText text={value} />}
		/>
	);
}

/**
 * @description The main Unbound settings page: recovery, restart, staff mode, links, and version info.
 */
function GeneralPage() {
	const navigation = Discord.useNavigation();
	const settings = useSettingsStore('unbound');
	const bytecode = useMemo(() => getRuntimeProperties()['Bytecode Version'], []);

	return (
		<Page>
			<Discord.TableRowGroup title={Messages.UNBOUND_GENERAL}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_RECOVERY_MODE}
					subLabel={Messages.UNBOUND_RECOVERY_MODE_DESC}
					icon={<Discord.TableRowIcon source={Icons.WrenchIcon} />}
					value={settings.get('recovery', false)}
					onValueChange={() => settings.toggle('recovery', false)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_RESTART}
					icon={<Discord.TableRowIcon source={Icons.RetryIcon} />}
					onPress={() => reload()}
				/>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_DEVELOPER_MODE}
					subLabel={Messages.UNBOUND_DEVELOPER_MODE_DESC}
					icon={<Discord.TableRowIcon source={Icons.WrenchIcon} />}
					value={settings.get('developer-mode', false)}
					onValueChange={() => settings.toggle('developer-mode', false)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_TOASTS}>
				<Discord.TableRow
					label={Messages.UNBOUND_TOASTS}
					icon={<Discord.TableRowIcon source={Icons.BellIcon} />}
					arrow
					onPress={() => navigation.push(Screens.Toasts)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_STAFF_MODE}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_STAFF_MODE}
					subLabel={Messages.UNBOUND_STAFF_MODE_DESC}
					icon={<Discord.TableRowIcon source={Icons.EyeIcon} />}
					value={settings.get('staff-mode', false)}
					onValueChange={() => settings.toggle('staff-mode', false)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_LINKS}>
				<Discord.TableRow
					label={Messages.UNBOUND_GITHUB}
					icon={<Discord.TableRowIcon source={Icons['img_account_sync_github_white']} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.GitHub)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_DOCS}
					icon={<Discord.TableRowIcon source={Icons.BookCheckIcon} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.Docs)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_SUPPORT_SERVER}
					icon={<Discord.TableRowIcon source={Icons.ClydeIcon} />}
					onPress={() =>
						Invites.acceptInviteAndTransitionToInviteChannel({
							inviteKey: DISCORD_INVITE,
							context: { location: 'Join Guild' },
						})
					}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_VERSION_INFO}>
				<InfoRow
					label={Messages.UNBOUND_UNBOUND_VERSION}
					value={VERSION}
					icon={<Discord.TableRowIcon IconComponent={Unbound} />}
					onPress={() =>
						Linking.openURL(`https://github.com/unbound-mod/client/commit/${VERSION}`)
					}
				/>
				<InfoRow
					label={Messages.UNBOUND_DISCORD_VERSION}
					value={`${BundleInfo.Version} (${BundleInfo.Build})`}
					icon={<Discord.TableRowIcon source={Icons.ClydeIcon} />}
				/>
				<InfoRow
					label={Messages.UNBOUND_BYTECODE_VERSION}
					value={String(bytecode)}
					icon={<Discord.TableRowIcon source={Icons['ic_information_24px']} />}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default GeneralPage;
