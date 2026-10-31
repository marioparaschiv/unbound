import { trackChangedRows } from '@unbound-plugins/shared/messages/changed-rows';
import { metro, patcher } from '@unbound-app/api';

import {
	ChannelStore,
	MessageRowData,
	MessageStore,
	settings,
	UserProfileStore,
	UserStore,
} from '~/modules';
import { cleanProfilePronouns, pickPronouns } from '~/pronouns';
import type { PronounLookup } from '~/lookup';
import { addPronouns } from '~/header';

type Author = { id?: string; bot?: boolean; system?: boolean; username?: string };
type Message = { id?: string; author?: Author; channel_id?: string; type?: number };

// Default (0) and reply (19) messages; other types, such as poll results, have no author header.
function isChatMessage(message: Message) {
	return message.type === 0 || message.type === 19;
}

function discordPronouns(userId: string, channelId: string | undefined) {
	const guildId = channelId ? ChannelStore.getChannel?.(channelId)?.guild_id : undefined;
	const memberProfile = guildId
		? UserProfileStore.getGuildMemberProfile(userId, guildId)
		: undefined;

	return (
		cleanProfilePronouns(memberProfile?.pronouns) ??
		cleanProfilePronouns(UserProfileStore.getUserProfile(userId)?.pronouns)
	);
}

function isShownFor(author: Author | undefined): author is Author & { id: string } {
	if (!author?.id || author.bot || author.system) return false;

	return settings.get('showSelf', true) || author.id !== UserStore.getCurrentUser()?.id;
}

/**
 * @description Shows each message author's pronouns after the message timestamp.
 * @param lookup The PronounDB lookup that caches pronouns for the session.
 * @returns A function that removes the patch and has Discord rebuild the headers it labelled.
 */
export function patchMessageRowData(lookup: PronounLookup): () => void {
	const labelled = trackChangedRows('PronounDB', (channelId, id) =>
		Boolean(MessageStore.getMessage(channelId, id)),
	);

	const unpatch = patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;

		if (!message || !isChatMessage(message) || !isShownFor(message.author)) return;

		const { id, username } = message.author;
		const pronouns = pickPronouns(
			discordPronouns(id, message.channel_id),
			lookup.get(id),
			settings.get('priority', 'pronoundb') === 'discord',
		);
		const row = result?.message;

		if (!pronouns || typeof row?.timestamp !== 'string') return;

		addPronouns(
			row,
			pronouns,
			username,
			metro.common.ReactNative.Dimensions.get('window').width,
		);
		labelled.add(message);
	});

	return () => {
		unpatch();
		labelled.rebuild();
	};
}
