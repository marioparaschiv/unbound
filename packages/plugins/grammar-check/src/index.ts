import { flux, metro, dialogs, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';

import { applyFixes, checkText, fixStepByStep, type Mistake } from '~/lib/languagetool';

type ChatInput = { setText?: (text: string) => void };
type InputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};
type DraftStore = { getDraft(channelId: string, draftType: number): string | undefined };

const CHANNEL_MESSAGE_DRAFT = 0;
const MAX_BUTTONS = 5;
const TOAST_ID = 'grammar-check';

function replaceDraft(channelId: string, text: string) {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| InputRegistry
		| undefined;

	registry?.getBestActiveInputForChannelId?.(channelId)?.setText?.(text);
}

function label(text: string, mistake: Mistake): string {
	const wrong = text.slice(mistake.offset, mistake.offset + mistake.length);

	return mistake.fix === undefined ? wrong : `${wrong} → ${mistake.fix || '∅'}`;
}

async function fixAll(channelId: string, text: string) {
	toasts.show({ id: TOAST_ID, title: messages.FIXING });

	try {
		replaceDraft(channelId, await fixStepByStep(text));
	} catch (error) {
		toasts.show({ id: TOAST_ID, title: messages.CHECK_FAILED, content: String(error) });
	}
}

async function check(channelId: string) {
	const drafts = flux.getStore('Draft') as unknown as DraftStore;
	const text = drafts.getDraft(channelId, CHANNEL_MESSAGE_DRAFT) ?? '';

	if (!text.trim()) {
		toasts.show({ id: TOAST_ID, title: messages.NOTHING_TO_CHECK });

		return;
	}

	toasts.show({ id: TOAST_ID, title: messages.CHECKING });

	try {
		const mistakes = await checkText(text);
		const fixable = mistakes.filter((mistake) => mistake.fix !== undefined);

		if (!mistakes.length) {
			toasts.show({ id: TOAST_ID, title: messages.NO_MISTAKES });

			return;
		}

		dialogs.showDialog({
			title: format('MISTAKES_TITLE', { count: mistakes.length }),
			body: mistakes
				.map((mistake) => `• ${label(text, mistake)}: ${mistake.message}`)
				.join('\n'),
			buttons: [
				...(fixable.length > 1
					? [{ label: messages.FIX_ALL, onPress: () => void fixAll(channelId, text) }]
					: []),
				...fixable.slice(0, MAX_BUTTONS).map((mistake) => ({
					label: label(text, mistake),
					variant: 'secondary' as const,
					onPress: () => replaceDraft(channelId, applyFixes(text, [mistake])),
				})),
			],
			cancel: messages.CLOSE,
		});
	} catch (error) {
		toasts.show({ id: TOAST_ID, title: messages.CHECK_FAILED, content: String(error) });
	}
}

export function start() {
	patchChatInputButton({
		key: 'unbound-grammar-check',
		name: 'Grammar Check',
		icon: 'PencilIcon',
		label: () => messages.CHECK_BUTTON,
		onPress: (channelId) => void check(channelId),
	});
}

export function stop() {}
