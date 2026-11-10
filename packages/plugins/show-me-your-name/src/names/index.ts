import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { MessageRowData, RelationshipStore, UserStore } from '~/names/modules';
import { AUTOMOD_MESSAGE_TYPE } from '~/constants';
import { formatName } from '~/names/format-name';

type Author = {
	id?: string;
	username?: string;
	globalName?: string | null;
};

type Message = {
	type?: number | string;
	isAutomod?: boolean;
	isAutoModAction?: boolean;
	author?: Author;
	referencedMessage?: { message?: Message };
	referenced_message?: Message;
};

type Row = {
	authorId?: string;
	username?: string;
	referencedMessage?: { message?: Row };
};

function isAutomod(message: Message | undefined): boolean {
	const type = message?.type;

	return (
		Number(type) === AUTOMOD_MESSAGE_TYPE ||
		type === 'AUTOMOD_ACTION' ||
		type === 'AUTO_MODERATION_ACTION' ||
		message?.isAutomod === true ||
		message?.isAutoModAction === true
	);
}

function relabel(row: Row | undefined, messageAuthor: Author | undefined) {
	if (typeof row?.username !== 'string') return;

	const author: Author | undefined =
		messageAuthor ?? (row.authorId ? UserStore.getUser(row.authorId) : undefined);

	if (!author) return;

	const username =
		settings.displayNames && author.globalName ? author.globalName : author.username;

	if (!username) return;

	const nickname =
		settings.friendNicknames && author.id ? RelationshipStore.getNickname?.(author.id) : null;

	row.username = formatName({
		displayed: row.username,
		username,
		nickname,
		mode: settings.mode,
	});
}

/**
 * @description Shows usernames in the author label of each message, and of reply previews while `inReplies` is on.
 * Patches `generateMessageRowData` on Discord's message row data module and reads authors from `UserStore` and
 * friend nicknames from `RelationshipStore`. The Addon scope removes the patch when the plugin stops.
 */
export function startNames(): void {
	if (!ensureModules({ MessageRowData, UserStore })) return;

	patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;

		if (!isAutomod(message)) relabel(result?.message, message?.author);

		if (!settings.inReplies) return;

		const reply = message?.referencedMessage?.message ?? message?.referenced_message;

		if (isAutomod(message) || isAutomod(reply)) return;

		relabel(result?.message?.referencedMessage?.message, reply?.author);
	});
}
