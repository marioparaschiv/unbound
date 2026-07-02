import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { getIDByName } from '~/api/assets';
import { Screens } from '~/lib/constants';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';

/**
 * @description Developer settings: debugger connection, error boundary, and links to developer subpages.
 */
function DeveloperPage() {
	const navigation = Discord.useNavigation();
	const settings = useSettingsStore(
		'unbound',
		({ key }) => key?.startsWith('debugger') || key === 'error-boundary.enabled',
	);

	return (
		<Page>
			<Discord.TableRowGroup title={Messages.UNBOUND_DEBUGGER}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_DEBUGGER_ENABLED}
					icon={<Discord.TableRowIcon source={getIDByName('BugIcon')} />}
					value={settings.get('debugger.enabled', false)}
					onValueChange={() => settings.toggle('debugger.enabled', false)}
				/>
				<Discord.TableRow
					label={Messages.UNBOUND_DEBUGGER_ADDRESS}
					icon={<Discord.TableRowIcon source={getIDByName('LinkIcon')} />}
				>
					<Discord.TextInput
						value={settings.get('debugger.address', '')}
						placeholder={Messages.UNBOUND_DEBUGGER_ADDRESS_PLACEHOLDER}
						onChange={(value: string) => settings.set('debugger.address', value)}
					/>
				</Discord.TableRow>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_ERROR_BOUNDARY}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_ERROR_BOUNDARY}
					icon={<Discord.TableRowIcon source={getIDByName('WarningIcon')} />}
					value={settings.get('error-boundary.enabled', true)}
					onValueChange={() => settings.toggle('error-boundary.enabled', true)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_ASSET_BROWSER}>
				<Discord.TableRow
					label={Messages.UNBOUND_ASSET_BROWSER}
					icon={<Discord.TableRowIcon source={getIDByName('ImageIcon')} />}
					arrow
					onPress={() => navigation.push(Screens.Assets)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default DeveloperPage;
