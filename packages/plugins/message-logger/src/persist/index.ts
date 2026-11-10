import { settings } from '@unbound-app/settings';
import { flux, fs } from '@unbound-app/api';

import { LOG_FILE, PLUGIN_NAME, SAVED_MESSAGE_LIMIT } from '~/constants';
import type { EditEntry, LogEntries, MessageLog } from '~/log';
import { MessageStore } from '~/log/modules';

const SAVE_DELAY_MS = 1000;

/** A message as Discord's API sends it, which `LOAD_MESSAGES_SUCCESS` takes. */
export type RawMessage = {
	id: string;
	channel_id: string;
	[key: string]: unknown;
};

type RawAttachment = { id: string; [key: string]: unknown };

type SavedLog = {
	version: 1;
	deleted: { channelId: string; message: RawMessage }[];
	edits: { messageId: string; versions: EditEntry[] }[];
	deletedAttachments: { messageId: string; channelId: string; attachments: RawAttachment[] }[];
};

type LoadAction = {
	channelId?: string;
	messages?: RawMessage[];
	isBefore?: boolean;
	hasMoreBefore?: boolean;
	hasMoreAfter?: boolean;
};

type StoredRecord = Record<string, unknown> & { id: string; channel_id: string };

function plain(value: unknown): unknown {
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return undefined;
	}
}

function isoTime(value: unknown): string | null {
	if (!value) return null;

	const json = plain(value);

	return typeof json === 'string' ? json : null;
}

/**
 * @description Turns a message from Discord's `MessageStore` into the shape its API sends, keeping what a logged message needs to draw again: text, author, time, attachments and reply.
 * @param record The stored message.
 * @returns The message, or `undefined` when it cannot be read.
 */
export function toRawMessage(record: StoredRecord | undefined): RawMessage | undefined {
	if (!record?.id || !record.channel_id) return undefined;

	const author = plain(record.author) as Record<string, unknown> | undefined;

	if (!author?.id) return undefined;

	const reference = plain(record.messageReference ?? record.message_reference) as
		| Record<string, unknown>
		| undefined;

	return {
		id: record.id,
		channel_id: record.channel_id,
		type: typeof record.type === 'number' ? record.type : 0,
		content: typeof record.content === 'string' ? record.content : '',
		author: {
			id: author.id,
			username: author.username,
			global_name: author.globalName ?? author.global_name ?? null,
			avatar: author.avatar ?? null,
			discriminator: author.discriminator ?? '0',
			bot: author.bot ?? false,
		},
		timestamp: isoTime(record.timestamp),
		edited_timestamp: isoTime(record.editedTimestamp ?? record.edited_timestamp),
		attachments: (plain(record.attachments) as RawAttachment[] | undefined) ?? [],
		embeds: [],
		mentions: [],
		mention_roles: [],
		mention_everyone: false,
		pinned: false,
		tts: false,
		flags: typeof record.flags === 'number' ? record.flags : 0,
		...(reference?.message_id || reference?.messageId
			? {
					message_reference: {
						message_id: reference.message_id ?? reference.messageId,
						channel_id:
							reference.channel_id ?? reference.channelId ?? record.channel_id,
						guild_id: reference.guild_id ?? reference.guildId,
					},
				}
			: {}),
	};
}

/** Compares two snowflakes by age without `BigInt`: a longer id is newer, and ids of one length compare as text. */
function compareIds(a: string, b: string): number {
	if (a.length !== b.length) return a.length - b.length;

	return a < b ? -1 : a > b ? 1 : 0;
}

function newestFirst(a: { id: string }, b: { id: string }): number {
	return compareIds(b.id, a.id);
}

function parseSaved(text: string): SavedLog | undefined {
	const saved = JSON.parse(text) as Partial<SavedLog>;

	if (saved?.version !== 1) return undefined;

	return {
		version: 1,
		deleted: Array.isArray(saved.deleted) ? saved.deleted : [],
		edits: Array.isArray(saved.edits) ? saved.edits : [],
		deletedAttachments: Array.isArray(saved.deletedAttachments) ? saved.deletedAttachments : [],
	};
}

/**
 * @description Puts saved deleted messages back into a page of messages Discord loaded, where they fall by id, and their deleted attachments back into the messages that lost them.
 * @param action The `LOAD_MESSAGES_SUCCESS` action, changed in place.
 * @param deleted The saved deleted messages of every channel.
 * @param attachments The saved deleted attachments, by message id.
 * @returns How many messages were changed or added.
 */
export function restoreIntoPage(
	action: LoadAction,
	deleted: ReadonlyMap<string, RawMessage>,
	attachments: ReadonlyMap<string, RawAttachment[]>,
): number {
	const { channelId, messages } = action;

	if (!channelId || !Array.isArray(messages)) return 0;

	let changed = 0;

	for (const message of messages) {
		const saved = attachments.get(message.id);

		if (!saved?.length) continue;

		const current = Array.isArray(message.attachments)
			? (message.attachments as RawAttachment[])
			: [];
		const ids = new Set(current.map((attachment) => attachment.id));
		const missing = saved.filter((attachment) => !ids.has(attachment.id));

		if (!missing.length) continue;

		message.attachments = [...current, ...missing];
		changed++;
	}

	const sorted = [...messages].sort(newestFirst);
	const newest = sorted[0]?.id;
	const oldest = sorted.at(-1)?.id;
	const loaded = new Set(messages.map((message) => message.id));
	const added = [...deleted.values()].filter((message) => {
		if (message.channel_id !== channelId || loaded.has(message.id)) return false;

		if (oldest === undefined || newest === undefined) {
			return !action.hasMoreBefore && !action.hasMoreAfter;
		}

		if (compareIds(message.id, oldest) < 0 && action.hasMoreBefore !== false) return false;
		if (compareIds(message.id, newest) > 0 && (action.isBefore || action.hasMoreAfter)) {
			return false;
		}

		return true;
	});

	if (!added.length) return changed;

	action.messages = [...messages, ...added.map((message) => structuredCopy(message))].sort(
		newestFirst,
	);

	return changed + added.length;
}

function structuredCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * @description Saves the log to a file while **Keep the log after restarts** is on, and loads it when the plugin starts: edits show again when their messages are drawn, and deleted messages and attachments go back into the chat when Discord loads their channel.
 * Intercepts `LOAD_MESSAGES_SUCCESS`; the Addon scope removes the interceptor when the plugin stops.
 * @param log The message log, whose `onChange` should call the returned `save`.
 * @returns `save`, which schedules a write, and `stop`, which writes any pending change and stops saving, so purging the log on stop leaves the file alone.
 */
export function startPersistence(log: MessageLog): { save: () => void; stop: () => void } {
	const deletedMessages = new Map<string, RawMessage>();
	const savedAttachments = new Map<string, RawAttachment[]>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let loaded = false;
	let changedWhileLoading = false;

	function snapshot(entries: LogEntries): SavedLog {
		const deleted = entries.deleted
			.flatMap(({ messageId, channelId }) => {
				const message =
					toRawMessage(
						MessageStore.getMessage(channelId, messageId) as StoredRecord | undefined,
					) ?? deletedMessages.get(messageId);

				if (!message) return [];

				deletedMessages.set(messageId, message);

				return [{ channelId, message }];
			})
			.sort((a, b) => newestFirst(a.message, b.message))
			.slice(0, SAVED_MESSAGE_LIMIT);

		const deletedAttachments = entries.deletedAttachments
			.flatMap(({ messageId, channelId, attachmentIds }) => {
				const ids = new Set(attachmentIds);
				const stored = (MessageStore.getMessage(channelId, messageId)?.attachments ??
					[]) as RawAttachment[];
				const fromStore = (plain(stored) as RawAttachment[] | undefined) ?? [];
				const known = new Map(
					[...(savedAttachments.get(messageId) ?? []), ...fromStore].map((attachment) => [
						attachment.id,
						attachment,
					]),
				);
				const attachments = [...ids].flatMap((id) => {
					const attachment = known.get(id);

					return attachment ? [attachment] : [];
				});

				if (!attachments.length) return [];

				savedAttachments.set(messageId, attachments);

				return [{ messageId, channelId, attachments }];
			})
			.sort((a, b) => newestFirst({ id: a.messageId }, { id: b.messageId }))
			.slice(0, SAVED_MESSAGE_LIMIT);

		const edits = entries.edits
			.filter(({ versions }) => versions.length > 0)
			.sort((a, b) => newestFirst({ id: a.messageId }, { id: b.messageId }))
			.slice(0, SAVED_MESSAGE_LIMIT);

		return { version: 1, deleted, edits, deletedAttachments };
	}

	async function write() {
		timer = undefined;

		try {
			if (!settings.persistLog) {
				await fs.removeFile(LOG_FILE);

				return;
			}

			await fs.writeFile(LOG_FILE, JSON.stringify(snapshot(log.entries())));
		} catch (error) {
			console.error(`[${PLUGIN_NAME}] Failed to save the message log:`, error);
		}
	}

	function save() {
		if (stopped) return;

		if (!loaded) {
			changedWhileLoading = true;

			return;
		}

		if (timer) clearTimeout(timer);

		timer = setTimeout(() => void write(), SAVE_DELAY_MS);
	}

	async function load() {
		try {
			if (!settings.persistLog) {
				await fs.removeFile(LOG_FILE);

				return;
			}

			if (!(await fs.exists(LOG_FILE))) return;

			const saved = parseSaved(await fs.readFile(LOG_FILE));

			if (!saved || stopped) return;

			for (const { message } of saved.deleted) deletedMessages.set(message.id, message);
			for (const { messageId, attachments } of saved.deletedAttachments) {
				savedAttachments.set(messageId, attachments);
			}

			log.restore({
				deleted: saved.deleted.map(({ channelId, message }) => ({
					channelId,
					messageId: message.id,
				})),
				edits: saved.edits,
				deletedAttachments: saved.deletedAttachments.map(
					({ messageId, channelId, attachments }) => ({
						messageId,
						channelId,
						attachmentIds: attachments.map((attachment) => attachment.id),
					}),
				),
			});
		} catch (error) {
			console.error(`[${PLUGIN_NAME}] Failed to load the saved message log:`, error);
		} finally {
			loaded = true;

			if (changedWhileLoading) save();
		}
	}

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		if (!settings.persistLog || stopped) return false;

		const restorable = new Map(
			[...deletedMessages].filter(([messageId]) => log.isDeleted(messageId)),
		);
		const attachments = new Map(
			[...savedAttachments].filter(
				([messageId]) => log.deletedAttachmentIds(messageId).length,
			),
		);

		restoreIntoPage(action as LoadAction, restorable, attachments);

		return false;
	});

	void load();

	return {
		save,
		stop() {
			if (timer) {
				clearTimeout(timer);
				void write();
			}

			stopped = true;
		},
	};
}
