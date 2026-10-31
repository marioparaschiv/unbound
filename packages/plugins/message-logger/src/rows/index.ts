import { patcher } from '@unbound-app/api';

import { DELETED_TEXT_COLOR, EPHEMERAL_FLAG, PLUGIN_NAME } from '~/constants';
import { decorateRow, type ChatRow, type ContentNode } from '~/rows/decorate';
import { MessageStore, ReactNative, RowManager } from '~/discord/modules';
import type { MessageLog } from '~/log';
import { readSettings } from '~/log/read-settings';

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

function dismissTarget(value: unknown): object | null {
	try {
		const message = JSON.parse(JSON.stringify(value)) as { flags?: number };

		return { ...message, flags: (message.flags ?? 0) | EPHEMERAL_FLAG };
	} catch {
		return null;
	}
}

/**
 * @description Shows each row's log: deleted messages in red with a deleted marker, earlier versions above edited text, and deleted attachments marked.
 * @param log The message log.
 * @returns A function that removes the patch.
 */
export function patchRowManager(log: MessageLog): () => void {
	if (typeof RowManager.prototype?.generate !== 'function') {
		console.error(`[${PLUGIN_NAME}] Skipped, RowManager.generate not found.`);

		return () => {};
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

	return patcher.after(
		RowManager.prototype,
		'generate',
		({ args: [input], result, this: self }) => {
			const row = result as ChatRow | undefined;
			const messageId = row?.message?.id;

			if (renderingVersion || !row || !messageId || !log.hasHistory(messageId)) return;

			const settings = readSettings();
			const deleted = log.isDeleted(messageId);
			const channelId = row.message?.channelId;
			const previousVersions = settings.inlineEdits
				? log
						.editsOf(messageId)
						.map((edit) =>
							versionContent(self as RowGenerator, input as RowInput, edit.content),
						)
						.filter((content): content is ContentNode[] => content !== null)
				: [];

			decorateRow(row, {
				deleted,
				redText: settings.redText,
				deletedMarker: settings.deletedMarker,
				deletedColor: deleted
					? (ReactNative.processColor?.(DELETED_TEXT_COLOR) ?? null)
					: null,
				dismissTarget:
					deleted && channelId
						? dismissTarget(MessageStore.getMessage(channelId, messageId))
						: null,
				previousVersions,
				deletedAttachmentIds: new Set(log.deletedAttachmentIds(messageId)),
			});
		},
	);
}

export default patchRowManager;
