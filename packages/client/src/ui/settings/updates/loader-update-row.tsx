import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import { messages, format } from '~/i18n/api';
import { icons } from '~/assets/api';

import UpdateRowShell from './update-row-shell';
import DownloadButton from './download-button';

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
			installed={globalThis.UNBOUND_LOADER.version}
			update={update}
			action={<DownloadButton url={url} text={messages.UNBOUND_UPDATES_DOWNLOAD} />}
			actionLarge={
				<DownloadButton
					url={url}
					size='lg'
					grow
					text={format('UNBOUND_UPDATES_DOWNLOAD_VERSION', { version: update.version })}
				/>
			}
		/>
	);
}

export default LoaderUpdateRow;
