import type { UnboundSettingKey } from '~/settings/unbound';
import { useUnboundSettings } from '~/settings/unbound';
import LogoRowIcon from '~/ui/icons/logo-row-icon';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

type SwitchKey = Extract<UnboundSettingKey, `updater.auto.${string}` | `updater.notify.${string}`>;

/**
 * @description The updater's settings: which parts update by themselves, and which announce waiting
 * updates. The loader has no automatic updates.
 */
function UpdateSettingsPage() {
	const settings = useUnboundSettings();

	function toggle(key: SwitchKey) {
		return {
			value: settings.get(key),
			onValueChange: (value: boolean) => settings.set(key, value),
		};
	}

	return (
		<Page>
			<Discord.TableRowGroup
				title={messages.UNBOUND_UPDATES_AUTO}
				helperText={messages.UNBOUND_UPDATES_AUTO_DESC}
			>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_CLIENT}
					icon={<LogoRowIcon />}
					{...toggle('updater.auto.client')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_ADDONS}
					icon={<Discord.TableRowIcon source={icons.PuzzlePieceIcon} />}
					{...toggle('updater.auto.addons')}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup
				title={messages.UNBOUND_UPDATES_NOTIFY}
				helperText={messages.UNBOUND_UPDATES_NOTIFY_DESC}
			>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_CLIENT}
					icon={<LogoRowIcon />}
					{...toggle('updater.notify.client')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_LOADER}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					{...toggle('updater.notify.loader')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_ADDONS}
					icon={<Discord.TableRowIcon source={icons.PuzzlePieceIcon} />}
					{...toggle('updater.notify.addons')}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default UpdateSettingsPage;
