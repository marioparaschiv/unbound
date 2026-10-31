import { useUnboundSettings } from '~/settings/unbound';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

/**
 * @description Developer settings: debugger connection, error boundary, and links to developer subpages.
 */
function DeveloperPage() {
	const navigation = Discord.useNavigation();
	const settings = useUnboundSettings(
		({ key }) => key?.startsWith('debugger') || key === 'error-boundary.enabled',
	);

	return (
		<Page>
			<Discord.TableRowGroup title={messages.UNBOUND_DEBUGGER}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_DEBUGGER_ENABLED}
					icon={<Discord.TableRowIcon source={icons.BugIcon} />}
					value={settings.get('debugger.enabled')}
					onValueChange={() => settings.toggle('debugger.enabled')}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_DEBUGGER_ADDRESS}
					icon={<Discord.TableRowIcon source={icons.LinkIcon} />}
				>
					<Discord.TextInput
						value={settings.get('debugger.address')}
						placeholder={messages.UNBOUND_DEBUGGER_ADDRESS_PLACEHOLDER}
						onChange={(value: string) => settings.set('debugger.address', value)}
					/>
				</Discord.TableRow>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_ERROR_BOUNDARY}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_ERROR_BOUNDARY}
					icon={<Discord.TableRowIcon source={icons.WarningIcon} />}
					value={settings.get('error-boundary.enabled')}
					onValueChange={() => settings.toggle('error-boundary.enabled')}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_ASSET_BROWSER}>
				<Discord.TableRow
					label={messages.UNBOUND_ASSET_BROWSER}
					icon={<Discord.TableRowIcon source={icons.ImageIcon} />}
					arrow
					onPress={() => navigation.push(Screens.Assets)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default DeveloperPage;
