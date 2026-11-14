/** What the chat input holds right now: nothing, or a draft long enough to wrap beside its buttons. */
export type ComposerState = 'empty' | 'short' | 'crowded';

/**
 * @description Classifies a draft: `empty` without text or attachments, `crowded` once it spans lines, else `short`.
 * @param draft The draft text.
 * @param uploads How many attachments wait to be sent.
 * @param lineLength How many characters fit on one line beside the input's buttons.
 * @returns The composer state.
 */
export function composerState(draft: string, uploads: number, lineLength: number): ComposerState {
	if (!draft.trim() && uploads === 0) return 'empty';
	if (draft.includes('\n') || draft.length > lineLength) return 'crowded';

	return 'short';
}

export default composerState;
