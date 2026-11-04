import type { FluxActionOf } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import { GROUP_DM_CHANNEL_TYPE } from '~/constants';
import { messages } from '~/messages';
import { readSettings } from '~/modules';
import { notify } from '~/notify';
import { refresh, type Session } from '~/session';

/**
 * @description Reports being removed from a group chat, unless the user left it.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeChannelDelete(session: Session): () => void {
	function onChannelDelete({ channel }: FluxActionOf<'CHANNEL_DELETE'>) {
		const id = channel?.id;

		if (!id || channel.type !== GROUP_DM_CHANNEL_TYPE) return;

		const known = session.snapshot.groups.find((entry) => entry.id === id);
		const manual = session.manual.groups.consume(id);

		refresh(session, 'groups');

		if (known && !manual && readSettings().groups) {
			notify(messages.removedFromGroup(known.name), known.iconURL);
		}
	}

	return flux.onAction('CHANNEL_DELETE', onChannelDelete);
}
