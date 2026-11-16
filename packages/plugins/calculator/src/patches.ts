import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';
import { dialogs, flux, metro } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { calculation, isCalculation } from '~/lib/expression';

type ChatInput = { setText?: (text: string) => void };

type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};

type DraftStore = { getDraft(channelId: string, draftType: number): string | undefined };

const CHANNEL_MESSAGE_DRAFT = 0;

function replaceDraft(channelId: string, text: string) {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputRegistry
		| undefined;

	registry?.getBestActiveInputForChannelId?.(channelId)?.setText?.(text);
}

function offerResult(channelId: string) {
	const Drafts = flux.getStore('Draft') as unknown as DraftStore;
	const worked = calculation(Drafts.getDraft(channelId, CHANNEL_MESSAGE_DRAFT) ?? '');

	if (!worked) return;

	dialogs.showDialog({
		title: messages.TITLE,
		body: worked.full,
		buttons: [
			{
				label: format('INSERT_RESULT', { result: worked.result }),
				variant: 'primary',
				onPress: () => replaceDraft(channelId, worked.result),
			},
			{
				label: messages.INSERT_FULL,
				variant: 'secondary',
				onPress: () => replaceDraft(channelId, worked.full),
			},
		],
		cancel: true,
	});
}

/**
 * @description Adds a calculator button to the chat input that shows while the draft is a calculation, and replaces
 * the draft with the result or the full calculation.
 */
export function patchCalculatorButton(): void {
	patchChatInputButton({
		key: 'calculator',
		name: 'Calculator',
		icon: 'PlusLargeIcon',
		label: () => messages.BUTTON,
		onPress: offerResult,
		showForDraft: isCalculation,
	});
}

export default { patchCalculatorButton };
