import { metro, patcher } from '@unbound-app/api';

type ComponentTarget = { holder: any; prop: string };
type NativeSendHandler = {
	input: any;
	original: (...args: any[]) => any;
	patched: (...args: any[]) => any;
};
type SendButtonRef = { current?: { setHasText?: (hasText: boolean) => void } };
type StickerPreviewProps = {
	channelId: string;
	clearSticker: (channelId: string) => void;
	Sticker: any;
	selectedChannel: any;
};

const EMPTY_STICKERS: any[] = [];
const STICKER_PICKER_ROW_MODULE_ID = 9610;
const STICKER_PICKER_ROW_PATH = 'modules/stickers/native/StickerPickerListRow.tsx';
const FLOATING_INPUT_PATH = 'modules/chat_input/native/FloatingChatInputContainer.tsx';
const SEND_BUTTON_PATH = 'modules/chat_input/native/accessories/ChatInputSendButton.tsx';
const STICKER_PATH = 'modules/stickers/native/Sticker.tsx';
const STICKER_PREVIEW_CONTAINER_SIZE = 80;
const STICKER_PREVIEW_IMAGE_SIZE = 76;

let unpatches: Array<() => void> = [];
let initializationInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let composerPatched = false;
let lifecycle = 0;
let clearStagedPreviews = () => {};
const nativeSendHandlers = new Map<string, NativeSendHandler>();
const sendButtonRefs = new Map<string, SendButtonRef>();
const stagedChannelIds = new Set<string>();
const stagedStickers = new Map<string, any[]>();
const stickerPreviewListeners = new Map<string, Set<() => void>>();
const pendingSends = new Set<string>();

function getStagedStickers(channelId: string): any[] {
	return stagedStickers.get(channelId) ?? EMPTY_STICKERS;
}

function subscribeToStagedStickers(channelId: string, listener: () => void): () => void {
	const listeners = stickerPreviewListeners.get(channelId) ?? new Set<() => void>();
	listeners.add(listener);
	stickerPreviewListeners.set(channelId, listeners);
	return () => {
		listeners.delete(listener);
		if (!listeners.size) stickerPreviewListeners.delete(channelId);
	};
}

function setStagedStickers(channelId: string, stickers: any[]): void {
	if (stickers.length) stagedStickers.set(channelId, stickers);
	else stagedStickers.delete(channelId);
	for (const listener of stickerPreviewListeners.get(channelId) ?? []) listener();
}

function unwrap(module: any): ComponentTarget | null {
	let holder = module;
	let prop = 'default';
	let current = module?.default;
	while (current && typeof current === 'object') {
		const next = current.type ? 'type' : current.render ? 'render' : null;
		if (!next) break;
		holder = current;
		prop = next;
		current = current[next];
	}
	return typeof current === 'function' ? { holder, prop } : null;
}

function resolveComponent(value: any): any {
	let current = value;
	for (let depth = 0; current && depth < 8; depth++) {
		if (typeof current === 'function') return current;
		if (typeof current !== 'object') return null;
		const next = current.default ?? current.type ?? current.render ?? current.Sticker;
		if (!next || next === current) return null;
		current = next;
	}
	return typeof current === 'function' ? current : null;
}

function currentChannelId(selectedChannel: any): string | undefined {
	return selectedChannel.getCurrentlySelectedChannelId?.() ?? selectedChannel.getChannelId?.();
}

function PendingSticker({
	channelId,
	clearSticker,
	Sticker,
	selectedChannel,
}: StickerPreviewProps) {
	const React = metro.common.React;
	const ReactNative = metro.common.ReactNative;
	const stickerIds = React.useSyncExternalStore(
		(onChange: () => void) => subscribeToStagedStickers(channelId, onChange),
		() =>
			getStagedStickers(channelId)
				.map((sticker: any) => String(sticker.id))
				.join(','),
	);
	const stickerId = stickerIds.split(',')[0];
	const sticker = stickerId
		? getStagedStickers(channelId).find((sticker: any) => String(sticker.id) === stickerId)
		: null;
	const selectedId = currentChannelId(selectedChannel);
	if (!sticker || (selectedId && selectedId !== channelId)) return null;
	return (
		<ReactNative.View
			pointerEvents='box-none'
			style={{
				alignItems: 'flex-end',
				bottom: 64,
				height: STICKER_PREVIEW_CONTAINER_SIZE,
				paddingRight: 16,
				position: 'absolute',
				right: 0,
				justifyContent: 'center',
			}}
		>
			<ReactNative.Pressable
				accessibilityLabel='Remove sticker preview'
				accessibilityRole='button'
				hitSlop={8}
				onPress={() => clearSticker(channelId)}
				style={{
					alignItems: 'center',
					backgroundColor: 'rgba(46,40,59,0.96)',
					borderColor: 'rgba(255,255,255,0.48)',
					borderWidth: 1.5,
					justifyContent: 'center',
					height: STICKER_PREVIEW_CONTAINER_SIZE,
					width: STICKER_PREVIEW_CONTAINER_SIZE,
					borderRadius: 18,
					overflow: 'hidden',
				}}
			>
				<ReactNative.View
					style={{
						borderRadius: 16,
						height: STICKER_PREVIEW_IMAGE_SIZE,
						overflow: 'hidden',
						width: STICKER_PREVIEW_IMAGE_SIZE,
					}}
				>
					<Sticker
						animated
						opaque={sticker.opaque ?? true}
						size={STICKER_PREVIEW_IMAGE_SIZE}
						sticker={sticker}
					/>
				</ReactNative.View>
			</ReactNative.Pressable>
		</ReactNative.View>
	);
}

function updateSendButton(channelId: string, hasText: boolean): void {
	sendButtonRefs.get(channelId)?.current?.setHasText?.(hasText);
}

function getComposerText(channelId: string, input: any, drafts: any): string {
	input?.flushPendingDraftSave?.();
	return String(input?.getText?.() || drafts.getDraft(channelId, 0) || '');
}

function restoreNativeSend(channelId: string): void {
	const entry = nativeSendHandlers.get(channelId);
	if (!entry) return;
	if (entry.input.handleSend === entry.patched) entry.input.handleSend = entry.original;
	nativeSendHandlers.delete(channelId);
}

function start(): void {
	if (initialized) return;
	const activeLifecycle = ++lifecycle;
	const registry = metro.findByProps('getBestActiveInputForChannelId');
	const selectedChannel = metro.findByProps('getCurrentlySelectedChannelId');
	const drafts = metro.findByProps('getDraft');
	const messages = metro.findByProps('sendMessage', 'editMessage');
	const Sticker =
		resolveComponent(metro.findByFilePath(STICKER_PATH, { interop: false })) ??
		resolveComponent(metro.findByName('Sticker', { interop: false }));
	if (!registry || !selectedChannel || !drafts || !messages || !Sticker) {
		initializationInterval ??= setInterval(start, 250);
		return;
	}
	if (initializationInterval) {
		clearInterval(initializationInterval);
		initializationInterval = null;
	}
	initialized = true;
	const getInput = (channelId: string) =>
		registry.getBestActiveInputForChannelId?.(channelId) ??
		nativeSendHandlers.get(channelId)?.input ??
		registry.getBestActiveInput?.();
	const clearComposer = (input: any) => {
		if (!input) return;
		input.setText?.('');
		input.clearText?.();
		input.flushPendingDraftSave?.();
	};
	const clearSticker = (channelId: string) => {
		setStagedStickers(channelId, []);
		stagedChannelIds.delete(channelId);
		restoreNativeSend(channelId);
		const input = getInput(channelId);
		const text = getComposerText(channelId, input, drafts);
		updateSendButton(channelId, Boolean(text.trim()));
	};
	const sendStagedSticker = (channelId: string, ...args: any[]) => {
		if (pendingSends.has(channelId)) return;
		const stickers = getStagedStickers(channelId);
		if (!stickers.length) return getInput(channelId)?.handleSend?.(...args);
		const input = getInput(channelId);
		const content = getComposerText(channelId, input, drafts);
		const stickerIds = stickers.map((sticker: any) => String(sticker.id));
		pendingSends.add(channelId);
		let result;
		try {
			result = content
				? messages._sendMessage(
						channelId,
						{
							content,
							tts: false,
							invalidEmojis: [],
							validNonShortcutEmojis: [],
						},
						{ stickerIds },
					)
				: messages.sendStickers(channelId, stickerIds);
		} catch (error) {
			pendingSends.delete(channelId);
			throw error;
		}
		setStagedStickers(channelId, []);
		const clear = () => {
			pendingSends.delete(channelId);
			clearComposer(input);
			clearSticker(channelId);
		};
		if (result && typeof result.then === 'function')
			return result.then(
				(value: any) => (clear(), value),
				(error: any) => {
					pendingSends.delete(channelId);
					if (activeLifecycle === lifecycle && initialized) {
						setStagedStickers(channelId, stickers);
						stagedChannelIds.add(channelId);
						updateSendButton(channelId, true);
					}
					throw error;
				},
			);
		clear();
		return result;
	};
	const patchInput = (input: any, channelId: string) => {
		if (!input || typeof input.handleSend !== 'function') return;
		const existing = nativeSendHandlers.get(channelId);
		if (existing && existing.input === input && input.handleSend === existing.patched) return;
		if (existing) restoreNativeSend(channelId);
		const original = input.handleSend;
		const patched = (...args: any[]) =>
			pendingSends.has(channelId) || getStagedStickers(channelId).length
				? sendStagedSticker(channelId, ...args)
				: original.apply(input, args);
		nativeSendHandlers.set(channelId, { input, original, patched });
		input.handleSend = patched;
	};
	const stageSticker = (channelId: string, sticker: any, input?: any) => {
		if (!channelId || !sticker?.id) return;
		const existing = getStagedStickers(channelId);
		if (!existing.some((item: any) => String(item.id) === String(sticker.id))) {
			setStagedStickers(channelId, [...existing, sticker]);
		}
		stagedChannelIds.add(channelId);
		const activeInput = input ?? getInput(channelId);
		patchInput(activeInput, channelId);
		activeInput?.closeCustomKeyboard?.();
		activeInput?.showSideActions?.();
		updateSendButton(channelId, true);
	};
	clearStagedPreviews = () => {
		for (const channelId of stagedChannelIds) {
			setStagedStickers(channelId, []);
			restoreNativeSend(channelId);
			const input = getInput(channelId);
			const text = getComposerText(channelId, input, drafts);
			updateSendButton(channelId, Boolean(text.trim()));
		}
		stagedChannelIds.clear();
	};
	const pickerPatchTarget = (picker: any): boolean => {
		const target = unwrap(picker);
		if (!target) return false;
		unpatches.push(
			patcher.before(target.holder, target.prop, (ctx) => {
				const props = ctx.args[0];
				if (typeof props?.onPressSticker !== 'function') return;
				const original = props.onPressSticker;
				ctx.args[0] = {
					...props,
					onPressSticker: (sticker: any, ...args: any[]) => {
						const channelId = props.channel?.id ?? currentChannelId(selectedChannel);
						if (!channelId) return original.apply(props, [sticker, ...args]);
						return stageSticker(channelId, sticker, getInput(channelId));
					},
				};
			}),
		);
		return true;
	};
	let stickerPickerPatched = false;
	const patchStickerPicker = () => {
		if (stickerPickerPatched) return true;
		stickerPickerPatched = pickerPatchTarget(
			metro.findByFilePath(STICKER_PICKER_ROW_PATH, { interop: false }),
		);
		if (stickerPickerPatched) return true;
		metro.initializeModule(STICKER_PICKER_ROW_MODULE_ID);
		stickerPickerPatched = pickerPatchTarget(
			metro.findByName('StickerPickerListRow', { interop: false }),
		);
		return stickerPickerPatched;
	};
	const removePickerListener = metro.addListener((module) => {
		if (resolveComponent(module)?.name === 'StickerPickerListRow') patchStickerPicker();
	});
	unpatches.push(removePickerListener);
	if (!patchStickerPicker()) {
		const pickerPatchInterval = setInterval(() => {
			if (activeLifecycle !== lifecycle || !patchStickerPicker()) return;
			clearInterval(pickerPatchInterval);
		}, 250);
		unpatches.push(() => clearInterval(pickerPatchInterval));
	}
	const sendButton = unwrap(metro.findByFilePath(SEND_BUTTON_PATH, { interop: false }));
	if (sendButton) {
		unpatches.push(
			patcher.after(sendButton.holder, sendButton.prop, (ctx) => {
				const channelId = ctx.args[0]?.channel?.id;
				const ref = ctx.args[1];
				if (channelId && ref) sendButtonRefs.set(channelId, ref);
				return ctx.result;
			}),
		);
		unpatches.push(
			patcher.before(sendButton.holder, sendButton.prop, (ctx) => {
				const props = ctx.args[0];
				const channelId = props?.channel?.id;
				if (!channelId || !getStagedStickers(channelId).length) {
					return;
				}
				ctx.args[0] = {
					...props,
					hasPendingAttachments: true,
					requireTextContent: false,
					onSendMessage: (...args: any[]) => sendStagedSticker(channelId, ...args),
				};
			}),
		);
	}
	const patchComposer = () => {
		if (composerPatched) return true;
		const target = unwrap(metro.findByFilePath(FLOATING_INPUT_PATH, { interop: false }));
		if (!target) return false;
		composerPatched = true;
		unpatches.push(
			patcher.after(target.holder, target.prop, (ctx) => {
				const channelId = ctx.args[0]?.channel?.id ?? currentChannelId(selectedChannel);
				if (!channelId || !ctx.result?.props) return ctx.result;
				const React = metro.common.React;
				const preview = React.createElement(PendingSticker, {
					key: 'sticker-preview',
					channelId,
					clearSticker,
					Sticker,
					selectedChannel,
				});
				return React.cloneElement(
					ctx.result,
					{},
					React.createElement(React.Fragment, null, ctx.result.props.children, preview),
				);
			}),
		);
		return true;
	};
	if (!patchComposer()) {
		const composerPatchInterval = setInterval(() => {
			if (activeLifecycle !== lifecycle || !patchComposer()) return;
			clearInterval(composerPatchInterval);
		}, 250);
		unpatches.push(() => clearInterval(composerPatchInterval));
	}
}

function stop(): void {
	if (initializationInterval) {
		clearInterval(initializationInterval);
		initializationInterval = null;
	}
	lifecycle++;
	initialized = false;
	composerPatched = false;
	clearStagedPreviews();
	clearStagedPreviews = () => {};
	for (const unpatch of unpatches.splice(0)) unpatch();
	for (const channelId of nativeSendHandlers.keys()) restoreNativeSend(channelId);
	pendingSends.clear();
	sendButtonRefs.clear();
}

export default { start, stop };
