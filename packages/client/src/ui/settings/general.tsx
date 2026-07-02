import { Screens, SOCIAL_LINKS, DISCORD_INVITE } from '~/lib/constants';
import { BundleInfo, reload } from '~/api/native';
import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { getIDByName } from '~/api/assets';
import { Linking } from '~/api/metro/api';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';

/**
 * @description The main Unbound settings page: recovery, restart, staff mode, links, and version info.
 */
function GeneralPage() {
	const navigation = Discord.useNavigation();
	const settings = useSettingsStore('unbound');

	return (
		<Page>
			<Discord.TableRowGroup title={Messages.UNBOUND_GENERAL}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_RECOVERY_MODE}
					subLabel={Messages.UNBOUND_RECOVERY_MODE_DESC}
					icon={<Discord.TableRowIcon source={getIDByName('WrenchIcon')} />}
					value={settings.get('recovery', false)}
					onValueChange={() => settings.toggle('recovery', false)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_RESTART}
					icon={<Discord.TableRowIcon source={getIDByName('RetryIcon')} />}
					onPress={() => reload()}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_TOASTS}>
				<Discord.TableRow
					label={Messages.UNBOUND_TOASTS}
					icon={<Discord.TableRowIcon source={getIDByName('BellIcon')} />}
					arrow
					onPress={() => navigation.push(Screens.Toasts)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_STAFF_MODE}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_STAFF_MODE}
					subLabel={Messages.UNBOUND_STAFF_MODE_DESC}
					icon={<Discord.TableRowIcon source={getIDByName('EyeIcon')} />}
					value={settings.get('staff-mode.enabled', false)}
					onValueChange={() => settings.toggle('staff-mode.enabled', false)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_LINKS}>
				<Discord.TableRow
					label={Messages.UNBOUND_GITHUB}
					icon={<Discord.TableRowIcon source={getIDByName('LinkIcon')} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.GitHub)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_DOCS}
					icon={<Discord.TableRowIcon source={getIDByName('BookCheckIcon')} />}
					onPress={() => Linking.openURL(SOCIAL_LINKS.Docs)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_SUPPORT_SERVER}
					icon={<Discord.TableRowIcon source={getIDByName('GlobeEarthIcon')} />}
					onPress={() => Linking.openURL(`https://discord.gg/${DISCORD_INVITE}`)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_VERSION}>
				<Discord.TableRow
					label='Discord'
					subLabel={BundleInfo.Version}
					icon={<Discord.TableRowIcon source={getIDByName('ic_information_24px')} />}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default GeneralPage;
