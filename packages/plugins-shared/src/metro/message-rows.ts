import { metro, patcher } from '@unbound-app/api';

/** Discord's message row module, whose `generateMessageRowData(input, options, …)` builds each chat row. */
export const MessageRowData = metro.findByProps('generateMessageRowData');

/** The author of a message Discord builds a chat row for. */
export type RowAuthor = {
	id?: string;
	username?: string;
	globalName?: string | null;
	bot?: boolean;
	system?: boolean;
};

/** The message Discord builds a chat row from, as far as plugins read it. */
export type RowMessage = {
	id?: string;
	/** A number such as `0` (default) or `19` (reply); some builds name it instead. */
	type?: number | string;
	channel_id?: string;
	author?: RowAuthor;
};

/** The chat row Discord built for a message; plugins change it in place before it renders. */
export type MessageRow = {
	authorId?: string;
	guildId?: string;
	username?: string;
	timestamp?: string;
	timestampAccessibilityLabel?: string;
};

/** A row option's value, such as `true` for `animateEmoji` or a message id for `animatingStickerMessageId`. */
export type RowOption = string | number | boolean | null | undefined;

/** The row options, the builder's second argument, such as whether emoji animate. */
export type RowOptions = Record<string, RowOption>;

/** The builder's first argument, holding the message. */
export type RowInput<M extends RowMessage> = {
	message?: M | null;
};

/** A row Discord is about to build. */
export type MessageRowCall<M extends RowMessage> = {
	input: RowInput<M> | undefined;
	message: M | undefined;
	options: RowOptions | undefined;
};

/** A row Discord just built. */
export type BuiltMessageRow<M extends RowMessage, R extends MessageRow> = MessageRowCall<M> & {
	row: R | undefined;
};

/** What a `before` handler builds the row from instead; a missing field keeps Discord's. */
export type MessageRowReplacement<M extends RowMessage> = {
	input?: RowInput<M>;
	options?: RowOptions;
};

export type MessageRowHandlers<M extends RowMessage, R extends MessageRow> = {
	/** Runs before the row is built, and can replace its input or options. */
	before?: (call: MessageRowCall<M>) => MessageRowReplacement<M> | undefined;
	/** Runs once the row is built, to read it or change it in place. */
	after?: (built: BuiltMessageRow<M, R>) => void;
};

function rowCall<M extends RowMessage>(
	input: RowInput<M> | null | undefined,
	options: RowOptions | null | undefined,
): MessageRowCall<M> {
	return {
		input: input ?? undefined,
		message: input?.message ?? undefined,
		options: options && typeof options === 'object' ? options : undefined,
	};
}

/**
 * @description Hooks every chat row Discord builds, before it is built, after, or both.
 * The Addon scope removes the patches when the plugin stops; the returned function removes them sooner.
 * @template M The message fields the handlers read, past the shared ones.
 * @template R The row fields the handlers read or set, past the shared ones.
 * @param handlers What runs before and after a row is built.
 * @returns A function that removes the patches.
 */
export function onMessageRow<M extends RowMessage = RowMessage, R extends MessageRow = MessageRow>(
	handlers: MessageRowHandlers<M, R>,
): () => void {
	const { before, after } = handlers;
	const unpatches: (() => void)[] = [];

	if (before) {
		unpatches.push(
			patcher.before(MessageRowData, 'generateMessageRowData', ({ args }) => {
				const [input, options, ...rest] = args;
				const replacement = before(rowCall<M>(input, options));

				if (!replacement) return;

				return [replacement.input ?? input, replacement.options ?? options, ...rest];
			}),
		);
	}

	if (after) {
		unpatches.push(
			patcher.after(MessageRowData, 'generateMessageRowData', ({ args, result }) => {
				const [input, options] = args;

				after({ ...rowCall<M>(input, options), row: result?.message ?? undefined });
			}),
		);
	}

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}

export default { MessageRowData, onMessageRow };
