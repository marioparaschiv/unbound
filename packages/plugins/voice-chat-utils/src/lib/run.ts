import { dialogs, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { runSequentially, targetsOf } from '~/lib/actions';
import { editMember, voiceStatesOf } from '~/lib/members';

type Channel = { id: string; guild_id?: string; name?: string };

/**
 * @description Asks for confirmation, then applies one member edit to everyone in a voice channel but you, and says how it went.
 * @param channel The voice channel.
 * @param label The action's message key, which titles the confirmation.
 * @param body The member edit.
 * @param me Your user id.
 */
export async function runOnEveryone(
	channel: Channel,
	label: string,
	body: Record<string, boolean | string | null>,
	me: string,
): Promise<void> {
	const guildId = channel.guild_id;
	const ids = targetsOf(voiceStatesOf(channel.id), me);

	if (!guildId || !ids.length) return;

	const confirmed = await dialogs.confirm('CONFIRM_TITLE', {
		titleVars: { action: (messages as Record<string, string>)[label] ?? label },
		body: 'CONFIRM_BODY',
		bodyVars: { count: ids.length, channel: channel.name ?? '' },
		confirm: 'CONFIRM',
		destructive: true,
	});

	if (!confirmed) return;

	const done = await runSequentially(ids, (id) => editMember(guildId, id, body));

	toasts.show({
		title: addon.name,
		content:
			done === ids.length
				? format('DONE', { count: done })
				: format('PARTLY_DONE', { done, count: ids.length }),
	});
}
