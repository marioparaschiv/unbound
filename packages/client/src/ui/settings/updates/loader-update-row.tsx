import type { LoaderUpdate } from '@unbound-app/contracts/loader';

import type { DiscordBuilds } from '~/updates/discord-builds';
import { getLoader } from '~/native/unbound-native';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import LoaderUpdateButton from './loader-update-button';
import UpdateRowShell from './update-row-shell';

type LoaderUpdateRowProps = {
	update: LoaderUpdate;
	/** The patched Discord's builds, which the update button installs from when it can. */
	discord: DiscordBuilds | null;
};

/** A newer native loader release: the version jump and what changed; pressing it opens the changelog. */
function LoaderUpdateRow({ update, discord }: LoaderUpdateRowProps) {
	return (
		<UpdateRowShell
			name={messages.UNBOUND_UPDATES_LOADER}
			icon={icons.WrenchIcon}
			installed={getLoader()?.version ?? 'unknown'}
			update={update}
			action={<LoaderUpdateButton update={update} discord={discord} size='sm' />}
			actionLarge={<LoaderUpdateButton update={update} discord={discord} size='lg' />}
		/>
	);
}

export default LoaderUpdateRow;
