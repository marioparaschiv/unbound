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
	discord: DiscordBuilds | null;
};

/** @description Unbound itself: the client and the native loader, each its own row. */
function UnboundGroup({ checked, loader, discord }: UnboundGroupProps) {
	const settings = useUnboundSettings();
	// With automatic updates off, the loader keeps the cached client until the user refetches it.
	const clientManual = !settings.get('updater.auto.client');
	const installed = getLoader()?.version;

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
				trailing={<StatusIcon variant={clientManual ? 'paused' : 'current'} />}
			/>
			{loader ? (
				<LoaderUpdateRow update={loader} discord={discord} />
			) : installed ? (
				<Discord.TableRow
					label={messages.UNBOUND_UPDATES_LOADER}
					subLabel={`v${installed}`}
					icon={<Discord.TableRowIcon source={icons.WrenchIcon} />}
					trailing={checked ? <StatusIcon variant='current' /> : undefined}
				/>
			) : null}
		</Discord.TableRowGroup>
	);
}

export default UnboundGroup;
