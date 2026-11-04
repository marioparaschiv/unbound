import { useState } from 'react';

/** What an input sheet edits: the typed text, why it cannot be saved, and the save itself. */
export type InputDraft = {
	draft: string;
	error: string | undefined;
	/** Takes the typed text. Discord's `TextArea` calls it twice per keystroke with the same text, which is harmless. */
	setDraft: (text: string) => void;
	/** Validates the draft and hands it to `onSave`; returns whether it saved. */
	save: () => boolean;
};

/**
 * @description Holds an input sheet's draft apart from the saved value, so typing never writes: only `save` does,
 * once, after `validate` accepts the text.
 * @param value The saved text the draft starts from.
 * @param onSave Receives the accepted draft, only when it differs from `value`.
 * @param validate Returns why the text cannot be saved, or `undefined` when it can.
 * @returns The draft, its error, and `setDraft` and `save`.
 */
function useInputDraft(
	value: string,
	onSave: (text: string) => void,
	validate?: (text: string) => string | undefined,
): InputDraft {
	const [draft, setDraft] = useState(value);
	const [error, setError] = useState<string | undefined>(undefined);

	function save() {
		const problem = validate?.(draft);

		setError(problem);

		if (problem) {
			return false;
		}

		if (draft !== value) {
			onSave(draft);
		}

		return true;
	}

	return { draft, error, setDraft, save };
}

export default useInputDraft;
