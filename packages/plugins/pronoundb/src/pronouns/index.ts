import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	ChannelStore,
	MessageRowData,
	MessageStore,
	UserProfileStore,
	UserStore,
} from '~/pronouns/modules';
import { cleanProfilePronouns, pickPronouns } from '~/pronouns/format';
import { createLookup } from '~/pronouns/lookup';
import { addPronouns } from '~/pronouns/header';

type Author = { id?: string; bot?: boolean; system?: boolean; username?: string };
type Message = { author?: Author; channel_id?: string; type?: number };

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

	return settings.showSelf || author.id !== UserStore.getCurrentUser()?.id;
}

/**
 * @description Shows each message author's pronouns after the message timestamp, from PronounDB and the author's Discord profile.
 * Patches `generateMessageRowData` on the message row data module, and reads `UserProfileStore`, `ChannelStore` and `UserStore`.
 * `MessageStore.emitChange` redraws rows once a batch of PronounDB lookups lands.
 * The Addon scope removes the patch and timers when the plugin stops.
 * @returns A function that drops the PronounDB lookup, so a request still in flight changes nothing once it returns.
 */
export function startPronouns(): (() => void) | undefined {
	if (!ensureModules({ MessageRowData, UserProfileStore, UserStore })) return;

	// Without the message store, fetched pronouns show on the next re-render instead of at once.
	const pronounLookup = createLookup(() => MessageStore.emitChange?.());

	patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;

		if (!message || !isChatMessage(message) || !isShownFor(message.author)) return;

		const { id, username } = message.author;
		const pronouns = pickPronouns(
			discordPronouns(id, message.channel_id),
			pronounLookup.get(id),
			settings.priority === 'discord',
		);
		const row = result?.message;

		if (!pronouns || typeof row?.timestamp !== 'string') return;

		addPronouns(
			row,
			pronouns,
			username,
			metro.common.ReactNative.Dimensions.get('window').width,
		);
	});

	return () => pronounLookup.dispose();
}
