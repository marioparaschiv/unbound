import { MessageRowData, Patcher, RelationshipStore, UserStore, settings } from '~/modules';
import { formatName, type NameMode } from '~/format-name';
import { AUTOMOD_MESSAGE_TYPE } from '~/constants';

type Author = {
	id?: string;
	username?: string;
	globalName?: string;
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
		settings.get('displayNames', false) && author.globalName
			? author.globalName
			: author.username;

	if (!username) return;

	const nickname =
		settings.get('friendNicknames', true) && author.id
			? RelationshipStore.getNickname?.(author.id)
			: null;

	row.username = formatName({
		displayed: row.username,
		username,
		nickname,
		mode: settings.get('mode', 'nick-user') as NameMode,
	});
}

/**
 * @description Shows usernames in the author label of each message.
 * @returns A function that removes the patch.
 */
export function patchAuthorNames(): () => void {
	return Patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;

		if (isAutomod(message)) return;

		relabel(result?.message, message?.author);
	});
}

/**
 * @description Shows usernames in the author label of reply previews.
 * @returns A function that removes the patch.
 */
export function patchReplyNames(): () => void {
	return Patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;
		const reply = message?.referencedMessage?.message ?? message?.referenced_message;

		if (isAutomod(message) || isAutomod(reply)) return;

		relabel(result?.message?.referencedMessage?.message, reply?.author);
	});
}
