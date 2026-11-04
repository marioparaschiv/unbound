import { GUILD_ACTIONS_FILTER } from '~/modules';
import type { Session } from '~/session';
import { markOnCall } from '~/patches/mark-on-call';

/**
 * @description Remembers servers the user leaves or deletes, so their removal is not reported.
 * @param session The running session.
 * @returns A function that removes the patches.
 */
export function patchGuildActions(session: Session): () => void {
	return markOnCall(GUILD_ACTIONS_FILTER, ['leaveGuild', 'deleteGuild'], session.manual.guilds);
}
