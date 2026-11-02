import type { PendingUpdate } from '~/updates/addon-updates';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';

import UpdateRowShell from './update-row-shell';
import UpdateButton from './update-button';
import { kindIcon } from './format';

type UpdateRowProps = {
	entry: PendingUpdate;
};

/** A pending addon update: the version jump and what changed most recently; pressing it opens the changelog. */
function UpdateRow({ entry }: UpdateRowProps) {
	const navigation = Discord.useNavigation();
	const { update } = entry;
	const held = Manager.for(entry.kind).getHeldVersion(entry.id);

	return (
		<UpdateRowShell
			name={entry.name}
			icon={kindIcon(entry.kind)}
			installed={entry.from}
			update={update}
			note={held ? format('UNBOUND_UPDATES_HELD', { version: held }) : undefined}
			action={<UpdateButton id={entry.id} text={messages.UNBOUND_UPDATE} />}
			actionLarge={
				<UpdateButton
					id={entry.id}
					size='lg'
					grow
					text={format('UNBOUND_UPDATES_UPDATE_TO', { version: update.version })}
					onUpdated={() => navigation.goBack()}
				/>
			}
		/>
	);
}

export default UpdateRow;
