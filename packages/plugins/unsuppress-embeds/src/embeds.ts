import { SUPPRESS_EMBEDS } from '~/constants';

type Embeds = {
	embeds?: readonly object[];
};

/** The parts of a Discord message the row reads. */
export type Message = Embeds & {
	id?: string;
	channel_id?: string;
	flags?: number;
	author?: { id?: string };
	messageSnapshots?: readonly { message?: Embeds }[];
};

/** What the viewer may do in the message's channel. */
export type ChannelAccess = {
	currentUserId: string | undefined;
	isPrivate: boolean;
	canEmbedLinks: boolean;
	canManageMessages: boolean;
};

/** The change the row makes: suppress the embeds, or bring them back. */
export type EmbedAction = 'suppress' | 'unsuppress';

/**
 * @description Tells whether a message's embeds are suppressed.
 * @param flags The message's flags.
 * @returns `true` when the suppress-embeds flag is set.
 */
export function isSuppressed(flags: number | undefined): boolean {
	return ((flags ?? 0) & SUPPRESS_EMBEDS) !== 0;
}

/**
 * @description Tells whether a message, or a message it forwards, carries embeds.
 * @param message The message.
 * @returns `true` when there is an embed to suppress.
 */
export function hasEmbeds(message: Message): boolean {
	if (message.embeds?.length) return true;

	return message.messageSnapshots?.some((snapshot) => snapshot?.message?.embeds?.length) ?? false;
}

function mayChangeFlags(message: Message, access: ChannelAccess): boolean {
	const isOwn = !!access.currentUserId && message.author?.id === access.currentUserId;

	if (isOwn) return access.isPrivate || access.canEmbedLinks;

	return !access.isPrivate && access.canManageMessages;
}

/**
 * @description Picks the row to show for a message, following Vencord: unsuppress when the flag is set, suppress when the message has embeds.
 * @param message The long-pressed message.
 * @param access What the viewer may do in its channel.
 * @returns The action, or `null` when there is nothing to change or Discord would refuse the edit.
 */
export function getEmbedAction(message: Message, access: ChannelAccess): EmbedAction | null {
	if (typeof message.id !== 'string') return null;

	const suppressed = isSuppressed(message.flags);

	if (!suppressed && !hasEmbeds(message)) return null;

	if (!mayChangeFlags(message, access)) return null;

	return suppressed ? 'unsuppress' : 'suppress';
}

/**
 * @description Computes the flags to send for an action, keeping every other flag.
 * @param flags The message's current flags.
 * @param action The change to make.
 * @returns The new flags.
 */
export function applyAction(flags: number | undefined, action: EmbedAction): number {
	const current = flags ?? 0;

	return action === 'suppress' ? current | SUPPRESS_EMBEDS : current & ~SUPPRESS_EMBEDS;
}

/**
 * @description Names the row for an action.
 * @param action The change the row makes.
 * @returns The row label.
 */
export function actionLabel(action: EmbedAction): string {
	return action === 'suppress' ? 'Suppress Embeds' : 'Unsuppress Embeds';
}

/**
 * @description Recognizes Discord's delete row by its label.
 * @param label A row label.
 * @returns `true` for a label that starts with the word Delete.
 */
export function isDeleteLabel(label: string | undefined): boolean {
	return !!label && /^delete\b/i.test(label);
}

/**
 * @description Finds where the row goes: just above Discord's delete row, or at the end when there is none.
 * @param labels The labels of the sheet's rows, in order.
 * @returns The index to insert the row at.
 */
export function insertionIndex(labels: readonly (string | undefined)[]): number {
	const deleteIndex = labels.findIndex(isDeleteLabel);

	return deleteIndex === -1 ? labels.length : deleteIndex;
}

export default {
	isSuppressed,
	hasEmbeds,
	getEmbedAction,
	applyAction,
	actionLabel,
	isDeleteLabel,
	insertionIndex,
};
