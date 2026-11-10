import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import type { DiscordBuilds } from '~/updates/discord-builds';
import { useUnboundSettings } from '~/settings/unbound';
import { getLoader } from '~/native/unbound-native';
import LogoRowIcon from '~/ui/icons/logo-row-icon';
import { CLIENT_VERSION } from '~/core/constants';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import LoaderUpdateRow from './loader-update-row';
import StatusIcon from './status-icon';

type UnboundGroupProps = {
	/** Whether the last check finished, so a loader without an update is known to be current. */
	checked: boolean;
	loader: LoaderUpdate | null;
	/** The loader version the newest client needs while the installed loader is older. */
	requiredLoader: string | null;
	discord: DiscordBuilds | null;
};

/** @description Unbound itself: the client and the native loader, each its own row. */
function UnboundGroup({ checked, loader, requiredLoader, discord }: UnboundGroupProps) {
	const settings = useUnboundSettings();
	// With automatic updates off, the loader keeps the cached client until the user refetches it.
	const clientManual = !settings.get('updater.auto.client');
	const installed = getLoader()?.version;

	function clientStatus() {
		if (clientManual) {
			return 'paused';
		}

		return requiredLoader ? 'blocked' : 'current';
	}

	return (
		<Discord.TableRowGroup>
			<Discord.TableRow
				label={messages.UNBOUND_UPDATES_CLIENT}
				subLabel={
					clientManual
						? format('UNBOUND_UPDATES_VERSION_PAUSED', { version: CLIENT_VERSION })
						: `v${CLIENT_VERSION}`
				}
				icon={<LogoRowIcon />}
				trailing={<StatusIcon variant={clientStatus()} />}
			/>
			{loader ? (
				<LoaderUpdateRow update={loader} discord={discord} />
			) : installed ? (
				<Discord.TableRow
					label={messages.UNBOUND_UPDATES_LOADER}
					subLabel={`v${installed}`}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					trailing={
						checked ? (
							<StatusIcon variant={requiredLoader ? 'update' : 'current'} />
						) : undefined
					}
				/>
			) : null}
		</Discord.TableRowGroup>
	);
}

export default UnboundGroup;
