import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';
import { processColor } from 'react-native';

import {
	CHANGE_TYPE_NONE,
	CHANGE_TYPE_UPDATE,
	DELETED_TEXT_COLOR,
	EPHEMERAL_FLAG,
} from '~/lib/constants';
import { asEditedSubtext, decorateRow, type ChatRow, type ContentNode } from '~/lib/decorate';
import { MessageStore, findChatModules } from '~/lib/modules';
import { messageLog as log } from '~/lib/log';

type MessageRecord = {
	id: string;
	channel_id: string;
	set(key: string, value: unknown): MessageRecord;
};

type RowInput = {
	message?: MessageRecord;
};

type RowGenerator = {
	generate(input: RowInput): ChatRow;
};

type ChangeInput = {
	message?: { id?: string };
};

function dismissTarget(value: unknown): object | null {
	try {
		const message = JSON.parse(JSON.stringify(value)) as { flags?: number };

		return { ...message, flags: (message.flags ?? 0) | EPHEMERAL_FLAG };
	} catch {
		return null;
	}
}

type ChatModules = NonNullable<ReturnType<typeof findChatModules>>;

function patchRowManager(RowManager: ChatModules['RowManager']): void {
	if (typeof RowManager.prototype?.generate !== 'function') {
		logger.error(`Skipped, RowManager.generate not found.`);

		return;
	}

	let renderingVersion = false;

	function versionContent(generator: RowGenerator, input: RowInput, content: string) {
		if (!input.message || typeof input.message.set !== 'function') return null;

		renderingVersion = true;

		try {
			const row = generator.generate({
				...input,
				message: input.message.set('content', content),
			});

			return Array.isArray(row?.message?.content)
				? (row.message.content as ContentNode[])
				: null;
		} catch {
			return null;
		} finally {
			renderingVersion = false;
		}
	}

	patcher.after(RowManager.prototype, 'generate', ({ args: [input], result, this: self }) => {
		const row = result as ChatRow | undefined;
		const messageId = row?.message?.id;

		if (renderingVersion || !row || !messageId || !log.hasHistory(messageId)) return;

		const deleted = log.isDeleted(messageId);
		const color = deleted ? processColor(DELETED_TEXT_COLOR) : null;
		const channelId = row.message?.channelId;
		const previousVersions = settings.inlineEdits
			? log
					.editsOf(messageId)
					.map((edit) =>
						versionContent(
							self as RowGenerator,
							input as RowInput,
							asEditedSubtext(edit.content),
						),
					)
					.filter((content): content is ContentNode[] => content !== null)
			: [];

		decorateRow(row, {
			deleted,
			redText: settings.redText,
			deletedMarker: settings.deletedMarker,
			deletedColor: typeof color === 'number' ? color : null,
			dismissTarget:
				deleted && channelId
					? dismissTarget(MessageStore.getMessage(channelId, messageId))
					: null,
			previousVersions,
			deletedAttachmentIds: new Set(log.deletedAttachmentIds(messageId)),
		});
	});
}

function patchChatManager(ChatManager: ChatModules['ChatManager']): void {
	if (typeof ChatManager.prototype?.determineChangeType !== 'function') {
		logger.error(`Skipped, ChatManager.determineChangeType not found.`);

		return;
	}

	// Makes the chat send a row to the native list when only its log changed, which Discord would otherwise see as unchanged.
	patcher.after(ChatManager.prototype, 'determineChangeType', ({ args: [input], result }) => {
		const messageId = (input as ChangeInput | undefined)?.message?.id;

		if (result !== CHANGE_TYPE_NONE || !messageId || !log.takeRender(messageId)) return;

		return CHANGE_TYPE_UPDATE;
	});
}

/**
 * @description Shows each row's log: deleted messages in red with a deleted marker, earlier versions above edited text, and deleted attachments marked.
 * Patches `generate` on Discord's `RowManager` and `determineChangeType` on its `ChatManager`, so a change to a log redraws the row,
 * and reads the message from `MessageStore`.
 */
export function patchMessageRows(): void {
	const modules = findChatModules();

	if (!modules) {
		logger.warn('Message log skipped: Discord moved RowManager or ChatManager.');

		return;
	}

	patchRowManager(modules.RowManager);
	patchChatManager(modules.ChatManager);
}
