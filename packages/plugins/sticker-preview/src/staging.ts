import { clearComposer, composerText, type ChatInput } from '~/composer';
import {
	sharedStagedStickers,
	type Sticker,
} from '@unbound-plugins/shared/stickers/staged-stickers';
import { ChatInputs, MessageActions } from '~/modules';

type SendHandler = (...args: unknown[]) => unknown;
type SendableInput = ChatInput & { handleSend: SendHandler };
type SendHook = { input: SendableInput; original: SendHandler; hooked: SendHandler };

type SendButton = { setHasText?: (hasText: boolean) => void };

export type SendButtonRef = { current?: SendButton | null };
export type Staging = ReturnType<typeof createStaging>;

function canSend(input: ChatInput | undefined): input is SendableInput {
	return typeof input?.handleSend === 'function';
}

/**
 * @description Holds the stickers picked in each channel until the user sends them from the composer.
 * @returns The staged stickers, the actions to `stage`, `clear` and `send` them, and `dispose` to undo everything.
 */
export function createStaging() {
	const stickers = sharedStagedStickers();
	const sendHooks = new Map<string, SendHook>();
	const sendButtons = new Map<string, SendButtonRef>();
	const keptOn = new Map<SendButton, (hasText: boolean) => void>();
	const pending = new Set<string>();
	let disposed = false;

	function getInput(channelId: string): ChatInput | undefined {
		return (
			ChatInputs.getBestActiveInputForChannelId(channelId) ??
			sendHooks.get(channelId)?.input ??
			ChatInputs.getBestActiveInput?.()
		);
	}

	function keepOnWhileStaged(channelId: string) {
		const button = sendButtons.get(channelId)?.current;
		const original = button?.setHasText;

		if (!button || typeof original !== 'function' || keptOn.has(button)) return;

		keptOn.set(button, original);
		button.setHasText = (hasText: boolean) =>
			original.call(button, hasText || (!disposed && stickers.get(channelId).length > 0));
	}

	function setHasText(channelId: string, hasText: boolean) {
		keepOnWhileStaged(channelId);
		sendButtons.get(channelId)?.current?.setHasText?.(hasText);
	}

	// Assigned by hand rather than patched, so a handler Discord installs meanwhile is not overwritten on restore.
	function unhookSend(channelId: string) {
		const hook = sendHooks.get(channelId);

		if (!hook) return;

		if (hook.input.handleSend === hook.hooked) {
			hook.input.handleSend = hook.original;
		}

		sendHooks.delete(channelId);
	}

	function hookSend(channelId: string, input: ChatInput | undefined) {
		if (!canSend(input)) return;

		const hook = sendHooks.get(channelId);

		if (hook?.input === input && input.handleSend === hook.hooked) return;

		unhookSend(channelId);

		const original = input.handleSend;

		function hooked(...args: unknown[]): unknown {
			return pending.has(channelId) || stickers.get(channelId).length
				? send(channelId, ...args)
				: original.apply(input, args);
		}

		sendHooks.set(channelId, { input, original, hooked });
		input.handleSend = hooked;
	}

	function clear(channelId: string) {
		stickers.set(channelId, []);
		unhookSend(channelId);
		setHasText(channelId, Boolean(composerText(channelId, getInput(channelId)).trim()));
	}

	function stage(channelId: string, sticker: Sticker | undefined) {
		if (!sticker?.id) return;

		stickers.add(channelId, sticker);

		const input = getInput(channelId);

		hookSend(channelId, input);
		input?.showSideActions?.();

		if (typeof input?.openSystemKeyboard === 'function') {
			input.openSystemKeyboard();
		} else {
			input?.closeCustomKeyboard?.();
		}

		setHasText(channelId, true);
	}

	function send(channelId: string, ...args: unknown[]): unknown {
		if (pending.has(channelId)) return;

		const staged = stickers.get(channelId);
		const input = getInput(channelId);

		if (!staged.length) return input?.handleSend?.(...args);

		const content = composerText(channelId, input);
		const stickerIds = staged.map((sticker) => String(sticker.id));
		let result;

		pending.add(channelId);

		try {
			result = content
				? MessageActions._sendMessage(
						channelId,
						{ content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
						{ stickerIds },
					)
				: MessageActions.sendStickers(channelId, stickerIds);
		} catch (error) {
			pending.delete(channelId);

			throw error;
		}

		stickers.set(channelId, []);

		function finish() {
			pending.delete(channelId);
			clearComposer(input);
			clear(channelId);
		}

		if (typeof result?.then !== 'function') {
			finish();

			return result;
		}

		return result.then(
			(value: unknown) => {
				finish();

				return value;
			},
			(error: unknown) => {
				pending.delete(channelId);

				// A failed send puts the stickers back, unless the plugin stopped meanwhile.
				if (!disposed) {
					stickers.set(channelId, staged);
					setHasText(channelId, true);
				}

				throw error;
			},
		);
	}

	function trackSendButton(channelId: string, ref: SendButtonRef) {
		sendButtons.set(channelId, ref);
		setTimeout(() => {
			if (!disposed) keepOnWhileStaged(channelId);
		}, 0);
	}

	function dispose() {
		disposed = true;

		for (const channelId of new Set([...stickers.channels(), ...pending])) clear(channelId);

		for (const channelId of [...sendHooks.keys()]) unhookSend(channelId);

		pending.clear();
		sendButtons.clear();

		for (const [button, original] of keptOn) button.setHasText = original;

		keptOn.clear();
	}

	return {
		get: stickers.get,
		subscribe: stickers.subscribe,
		stage,
		clear,
		send,
		trackSendButton,
		dispose,
	};
}
