import { findElement } from '@unbound-plugins/shared/react/find-element';
import { flux, metro, patcher } from '@unbound-app/api';

import { maskedPaste, type InputState } from '~/lib/masked-paste';

type SelectionEvent = { nativeEvent: { text: string; start: number; end: number } };
type NativeInputProps = { onSelectionOrTextChange?: (event: SelectionEvent) => void };
type ChatInput = {
	setText(text: string): void;
	setSelectedRange(start: number, length: number): void;
};

const ChatInputs = metro.findByProps('getBestActiveInputForChannelId', { lazy: true });
const wrapped = new WeakMap<
	NonNullable<NativeInputProps['onSelectionOrTextChange']>,
	NativeInputProps['onSelectionOrTextChange']
>();

let previous: InputState | undefined;

function activeInput(): ChatInput | undefined {
	const channelId = flux.getStore('SelectedChannel')?.getChannelId?.();

	return channelId ? ChatInputs?.getBestActiveInputForChannelId?.(channelId) : undefined;
}

function applyMaskedPaste(next: InputState): boolean {
	const edit = previous && maskedPaste(previous, next);

	previous = next;

	if (!edit) return false;

	const input = activeInput();

	if (!input) return false;

	previous = { text: edit.text, start: edit.caret, end: edit.caret };
	input.setText(edit.text);
	input.setSelectedRange(edit.caret, 0);

	return true;
}

function hasSelectionHandler(props: object | undefined): boolean {
	return typeof (props as NativeInputProps | undefined)?.onSelectionOrTextChange === 'function';
}

function withMaskedPaste(handler: NonNullable<NativeInputProps['onSelectionOrTextChange']>) {
	const existing = wrapped.get(handler);

	if (existing) return existing;

	const wrapper = (event: SelectionEvent) => {
		const { text, start, end } = event.nativeEvent;

		if (!applyMaskedPaste({ text, start, end })) handler(event);
	};

	wrapped.set(handler, wrapper);

	return wrapper;
}

export function start() {
	const ChatInput = metro.findByFilePath('modules/chat_input/native/ChatInput.tsx', {
		interop: false,
	});

	if (!ChatInput?.default) {
		logger.warn('Masked link paste skipped: Discord moved its message box.');

		return;
	}

	patcher.react.after(ChatInput, 'default', ({ result }) => {
		const input = findElement(result, (element) => hasSelectionHandler(element.props));
		const props = input?.props as NativeInputProps | undefined;

		if (props?.onSelectionOrTextChange)
			props.onSelectionOrTextChange = withMaskedPaste(props.onSelectionOrTextChange);
	});
}

export function stop() {
	previous = undefined;
	patcher.unpatchAll();
}
