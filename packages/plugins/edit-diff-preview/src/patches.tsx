import { dialogs, flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';

import { collapseSame, diffWords, shouldPreview, type DiffPart } from '~/lib/diff';
import DiffView from '~/components/diff-view';

type MessageStore = {
	getMessage(channelId: string, messageId: string): { content?: string } | undefined;
};

type EditArgs = [channelId: string, messageId: string, edit: { content: string }];

type EditActions = {
	startEditMessage?: (channelId: string, messageId: string, content: string) => void;
};

function isEditArgs(args: unknown[]): args is EditArgs {
	return (
		typeof args[0] === 'string' &&
		typeof args[1] === 'string' &&
		typeof (args[2] as Partial<EditArgs[2]> | null)?.content === 'string'
	);
}

function confirmChanges(parts: DiffPart[]): Promise<boolean> {
	return new Promise((resolve) => {
		dialogs.showDialog({
			title: messages.TITLE,
			content: () => <DiffView parts={parts} />,
			buttons: [{ label: messages.SAVE, onPress: () => resolve(true) }],
			cancel: messages.KEEP_EDITING,
			onCancel: () => resolve(false),
			onDismiss: () => resolve(false),
		});
	});
}

/**
 * @description Shows what an edit adds and removes before Discord saves it, by patching `editMessage` on Discord's
 * message actions. **Keep editing** reopens the edit with the new text.
 */
export function patchEdits(): void {
	const MessageActions = metro.api.Messages;
	const Messages = flux.getStore('Message') as unknown as MessageStore;

	if (!MessageActions) {
		logger.warn('Edit Diff Preview skipped: Discord moved MessageActions.');

		return;
	}

	patcher.instead(MessageActions, 'editMessage', async ({ args, original, this: self }) => {
		if (!isEditArgs(args)) return original.apply(self, args);

		const [channelId, messageId, edit] = args;
		const before = Messages.getMessage(channelId, messageId)?.content ?? '';
		const options = { minLength: settings.minLength, code: settings.code };

		if (!shouldPreview(before, edit.content, options)) return original.apply(self, args);

		if (await confirmChanges(collapseSame(diffWords(before, edit.content)))) {
			return original.apply(self, args);
		}

		(MessageActions as EditActions).startEditMessage?.(channelId, messageId, edit.content);
	});
}

export default { patchEdits };
