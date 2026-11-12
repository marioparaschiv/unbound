import { settings } from '@unbound-app/settings';
import { flux, metro } from '@unbound-app/api';

import {
	onMessageRow,
	type MessageRow,
	type RowAuthor,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';

import { cleanProfilePronouns, pickPronouns } from '~/lib/format';
import { createLookup, type PronounLookup } from '~/lib/lookup';
import { addPronouns, type MessageRow as HeaderRow } from '~/lib/header';

const UserProfileStore = flux.getStore('UserProfile');
const ChannelStore = flux.getStore('Channel');
const MessageStore = flux.getStore('Message');
const UserStore = flux.getStore('User');

let pronounLookup: PronounLookup | undefined;

// Default (0) and reply (19) messages; other types, such as poll results, have no author header.
function isChatMessage(message: RowMessage) {
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

function hasTimestamp(row: MessageRow | undefined): row is HeaderRow {
	return typeof row?.timestamp === 'string';
}

function isShownFor(author: RowAuthor | undefined): author is RowAuthor & { id: string } {
	if (!author?.id || author.bot || author.system) return false;

	return settings.showSelf || author.id !== UserStore.getCurrentUser()?.id;
}

/**
 * @description Shows each message author's pronouns after the message timestamp, from PronounDB and the author's Discord profile.
 * Patches `generateMessageRowData` on the message row data module, and reads `UserProfileStore`, `ChannelStore` and `UserStore`.
 * `MessageStore.emitChange` redraws rows once a batch of PronounDB lookups lands.
 */
export function patchMessageRows(): void {
	// Without the message store, fetched pronouns show on the next re-render instead of at once.
	const lookup = createLookup(() => MessageStore.emitChange?.());

	pronounLookup = lookup;

	onMessageRow({
		feature: 'Pronouns',
		after({ message, row }) {
			if (!message || !isChatMessage(message) || !isShownFor(message.author)) return;

			const { id, username } = message.author;
			const pronouns = pickPronouns(
				discordPronouns(id, message.channel_id),
				lookup.get(id),
				settings.priority === 'discord',
			);

			if (!pronouns || !hasTimestamp(row)) return;

			addPronouns(
				row,
				pronouns,
				username,
				metro.common.ReactNative.Dimensions.get('window').width,
			);
		},
	});
}

/**
 * @description Drops the PronounDB lookup, so a request still in flight changes nothing once it returns.
 */
export function stopLookup(): void {
	pronounLookup?.dispose();
	pronounLookup = undefined;
}
