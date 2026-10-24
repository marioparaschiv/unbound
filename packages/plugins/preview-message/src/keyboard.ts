import { Keyboard, TextInput } from 'react-native';

import { Timing } from '~/constants';
import { ChatInputs } from '~/modules';

/**
 * @description Closes the chat's keyboard and custom keyboards, then calls back once it has hidden.
 * @param channelId The channel whose chat input to close.
 * @param onHidden Called once, when the keyboard hides or after a short fallback delay.
 * @returns A function that cancels the pending callback.
 */
export function dismissKeyboard(channelId: string, onHidden: () => void): () => void {
	// Optional: without the chat input module, only the system keyboard is closed.
	ChatInputs.dismissKeyboard?.();
	ChatInputs.getBestActiveInputForChannelId?.(channelId)?.closeCustomKeyboard?.();

	const state = TextInput.State;
	const focused = state?.currentlyFocusedInput?.();

	if (focused) {
		state.blurTextInput(focused);
	}

	const subscription = Keyboard.addListener('keyboardDidHide', hidden);
	const timer = setTimeout(hidden, Timing.keyboardDismissFallback);

	function cancel() {
		subscription.remove();
		clearTimeout(timer);
	}

	function hidden() {
		cancel();
		onHidden();
	}

	Keyboard.dismiss();

	return cancel;
}

export default dismissKeyboard;
