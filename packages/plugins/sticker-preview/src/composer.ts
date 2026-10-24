import { DraftStore } from '~/modules';

export type ChatInput = {
	handleSend?: (...args: unknown[]) => unknown;
	getText?: () => string;
	setText?: (text: string) => void;
	clearText?: () => void;
	flushPendingDraftSave?: () => void;
	closeCustomKeyboard?: () => void;
	showSideActions?: () => void;
};

/**
 * @description Reads the text typed in a channel's composer, from the input or else its saved draft.
 * @param channelId The composer's channel.
 * @param input The composer's chat input, when one is mounted.
 * @returns The text, or an empty string.
 */
export function composerText(channelId: string, input: ChatInput | undefined): string {
	input?.flushPendingDraftSave?.();

	return input?.getText?.() || DraftStore.getDraft(channelId, 0) || '';
}

/**
 * @description Empties a composer and saves the empty draft.
 * @param input The composer's chat input.
 */
export function clearComposer(input: ChatInput | undefined) {
	input?.setText?.('');
	input?.clearText?.();
	input?.flushPendingDraftSave?.();
}
