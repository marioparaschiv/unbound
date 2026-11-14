/** What the chat input holds right now: nothing, or a draft long enough to wrap beside its buttons. */
export type ComposerState = 'empty' | 'short' | 'crowded';

const SETTLE_CHARACTERS = 8;
const MIN_LINE_CHARACTERS = 12;

/**
 * @description Classifies a draft: `empty` without text or attachments, `crowded` once it spans lines or the buttons leave too little room, else `short`.
 * A crowded draft stays crowded until it is a few characters (at most a quarter of a line) shorter than a line, so editing near the edge does not flip the layout.
 * @param draft The draft text.
 * @param uploads How many attachments wait to be sent.
 * @param lineLength How many characters fit on one line beside the input's buttons.
 * @param previous The state the input had before this change.
 * @returns The composer state.
 */
export function composerState(
	draft: string,
	uploads: number,
	lineLength: number,
	previous?: ComposerState,
): ComposerState {
	if (!draft.trim() && uploads === 0) return 'empty';
	if (lineLength < MIN_LINE_CHARACTERS || draft.includes('\n') || draft.length > lineLength) {
		return 'crowded';
	}
	const settle = Math.min(SETTLE_CHARACTERS, Math.floor(lineLength / 4));

	if (previous === 'crowded' && draft.length > lineLength - settle) return 'crowded';

	return 'short';
}

export default composerState;
