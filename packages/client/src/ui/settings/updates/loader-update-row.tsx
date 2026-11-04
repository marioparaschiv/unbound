import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import { getLoader } from '~/native/unbound-native';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';
import { icons } from '~/assets/api';

import UpdateRowShell from './update-row-shell';

type LoaderUpdateRowProps = {
	update: LoaderUpdate;
};

/** A newer native loader release: the version jump and what changed; pressing it opens the changelog. */
function LoaderUpdateRow({ update }: LoaderUpdateRowProps) {
	const url = update.url;

	return (
		<UpdateRowShell
			name={messages.UNBOUND_UPDATES_LOADER}
			icon={icons.WrenchIcon}
			installed={getLoader()?.version ?? 'unknown'}
			update={update}
			action={
				<Discord.Button
					size='sm'
					variant='primary'
					text={messages.UNBOUND_UPDATES_DOWNLOAD}
					onPress={() => void Linking.openURL(url)}
				/>
			}
			actionLarge={
				<Discord.Button
					size='lg'
					grow
					variant='primary'
					text={format('UNBOUND_UPDATES_DOWNLOAD_VERSION', { version: update.version })}
					onPress={() => void Linking.openURL(url)}
				/>
			}
		/>
	);
}

export default LoaderUpdateRow;
