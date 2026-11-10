import type { FluxActionOf } from '@unbound-app/api/flux';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { isGuildUnavailable } from '~/discord';
import { messages } from '~/messages';
import { notify } from '~/notify';
import { refresh, type Session } from '~/session';

/**
 * @description Reports being removed from a server, unless the user left it or it is in an outage.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */
export function subscribeGuildDelete(session: Session): () => void {
	function onGuildDelete({ guild }: FluxActionOf<'GUILD_DELETE'>) {
		const id = guild?.id;

		if (!id || guild.unavailable || isGuildUnavailable(id) === true) return;

		const known = session.snapshot.guilds.find((entry) => entry.id === id);
		const manual = session.manual.guilds.consume(id);

		refresh(session, 'guilds', id);

		if (known && !manual && settings.servers) {
			notify(messages.removedFromServer(known.name), known.iconURL);
		}
	}

	return flux.onAction('GUILD_DELETE', onGuildDelete);
}
