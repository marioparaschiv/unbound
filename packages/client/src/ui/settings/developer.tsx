import type { BooleanSettingKey } from '~/settings/unbound';
import { useUnboundSettings } from '~/settings/unbound';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { reload } from '~/native/native';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import TextSettingRow from './text-setting-row';

/** The loader reads the same rule: an http or https URL with a host. */
function isBundleURL(value: string): boolean {
	return /^https?:\/\/\S+$/i.test(value);
}

function throwForBoundary(): never {
	throw new Error(messages.UNBOUND_ERROR_BOUNDARY_TEST_ERROR);
}

/**
 * @description Developer settings: the debugger, the loader's bundle and launch options, the error
 * boundary and developer tools.
 */
function DeveloperPage() {
	const navigation = Discord.useNavigation();
	const settings = useUnboundSettings(
		({ key }) =>
			key?.startsWith('debugger') ||
			key?.startsWith('loader') ||
			key === 'error-boundary.enabled',
	);

	function switchProps(key: BooleanSettingKey) {
		return { value: settings.get(key), onValueChange: () => settings.toggle(key) };
	}

	function setBundleURL(url: string) {
		// The loader's toolbox pairs a custom bundle with a forced fetch, so it is not served stale.
		settings.set('loader.update.url', url);
		settings.set('loader.update.force', Boolean(url));
	}

	return (
		<Page>
			<Discord.TableRowGroup title={messages.UNBOUND_DEBUGGER}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_DEBUGGER_ENABLED}
					subLabel={messages.UNBOUND_DEBUGGER_ENABLED_DESC}
					icon={<Discord.TableRowIcon source={icons.BugIcon} />}
					{...switchProps('debugger.enabled')}
				/>
				<TextSettingRow
					label={messages.UNBOUND_DEBUGGER_ADDRESS}
					icon={<Discord.TableRowIcon source={icons.LinkIcon} />}
					value={settings.get('debugger.address')}
					placeholder={messages.UNBOUND_DEBUGGER_ADDRESS_PLACEHOLDER}
					onSave={(address) => settings.set('debugger.address', address)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup
				title={messages.UNBOUND_LOADER}
				helperText={messages.UNBOUND_LOADER_RESTART_HINT}
			>
				<TextSettingRow
					label={messages.UNBOUND_LOADER_CUSTOM_BUNDLE}
					description={messages.UNBOUND_LOADER_CUSTOM_BUNDLE_DESC}
					icon={<Discord.TableRowIcon source={icons.DownloadIcon} />}
					value={settings.get('loader.update.url')}
					placeholder={messages.UNBOUND_DEFAULT}
					invalidMessage={messages.UNBOUND_LOADER_CUSTOM_BUNDLE_INVALID}
					validate={isBundleURL}
					onSave={setBundleURL}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_LOADER_HOT_RELOAD}
					subLabel={messages.UNBOUND_LOADER_HOT_RELOAD_DESC}
					icon={<Discord.TableRowIcon source={icons.RefreshIcon ?? icons.RetryIcon} />}
					{...switchProps('loader.update.hmr')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_LOADER_UNSIGNED}
					subLabel={messages.UNBOUND_LOADER_UNSIGNED_DESC}
					icon={<Discord.TableRowIcon source={icons.ShieldIcon ?? icons.WarningIcon} />}
					{...switchProps('loader.update.unsigned')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_LOADER_DEVTOOLS}
					subLabel={messages.UNBOUND_LOADER_DEVTOOLS_DESC}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					{...switchProps('loader.devtools')}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_RESTART}
					icon={<Discord.TableRowIcon source={icons.RetryIcon} />}
					onPress={reload}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_ERROR_BOUNDARY}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_ERROR_BOUNDARY}
					subLabel={messages.UNBOUND_ERROR_BOUNDARY_DESC}
					icon={<Discord.TableRowIcon source={icons.WarningIcon} />}
					{...switchProps('error-boundary.enabled')}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_ERROR_BOUNDARY_TEST}
					icon={<Discord.TableRowIcon source={icons.CircleXIcon ?? icons.WarningIcon} />}
					arrow
					onPress={() =>
						navigation.push(Screens.PanelHost, {
							title: messages.UNBOUND_ERROR_BOUNDARY_TEST,
							render: throwForBoundary,
						})
					}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_TOOLS}>
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
