import { assets, metro, patcher, plugins, storage } from '@unbound-app/api';

import { extractUrls, fetchLinkEmbed, type LinkEmbed } from '@preview-message/embeds';
import { subscribeToStore } from '@preview-message/store-listener';
import { applyRules, normalizeRules } from '@text-replace/rules';

const RIGHT_ACTIONS_PATH = 'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx';
const CHAT_ITEM_PATH = 'components_native/chat/ChatItem.tsx';
const HAPTICS_PATH = 'modules/haptics/HapticUtils.native.tsx';
const CHANNEL_MESSAGE_DRAFT_TYPE = 0;
const MESSAGE_ROW_TYPE = 1;
const BUTTON_SIZE = 32;
const BUTTON_GAP = 8;
const ICON_SIZE = 22;
const ICON_TINT = '#b5bac1';
const ICON_MIN_SCALE = 0.6;
const PRESS_OPACITY = 0.5;
const PRESS_SCALE = 0.86;
const SHOW_DELAY_MS = 60;
const MAX_PREVIEW_URLS = 4;
const SHOW_MS = 70;
const HIDE_MS = 25;
const FADE_IN_MS = 160;
const FADE_OUT_MS = 120;
const KEYBOARD_DISMISS_DELAY_MS = 350;
const EMPTY_STICKERS: any[] = [];

let unpatch: (() => void) | null = null;
let drafts: any = null;
let selectedChannel: any = null;
let users: any = null;
let chatItem: any = null;
let messageRecord: any = null;
let rowManager: any = null;
let haptics: any = null;
let restApi: {
	post?: (options: {
		url: string;
		body: { urls: string[] };
	}) => Promise<{ body?: { embeds?: unknown[] } }>;
} | null = null;
let chatInputs: {
	getBestActiveInputForChannelId?: (
		channelId: string,
	) => { closeCustomKeyboard?: () => void } | null;
	dismissKeyboard?: () => void;
} | null = null;
let eyeIcon: number | null = null;
let stickerPreviews: any = null;
let removeModuleListener: (() => boolean) | null = null;
const textReplaceStore = storage.getStore('unbound.text-replace');

function applyTextReplace(content: string): string {
	const textReplace = (plugins as any).getEntity?.('unbound.text-replace');
	if (!textReplace?.started) return content;

	return applyRules(
		content,
		normalizeRules(textReplaceStore.get('stringRules', [])),
		normalizeRules(textReplaceStore.get('regexRules', [])),
	);
}

function unwrapComponent(mod: any): { holder: any; prop: string } | null {
	let holder = mod;
	let prop = 'default';
	let current = mod?.default;
	let depth = 0;

	while (current && typeof current === 'object' && depth < 5) {
		const next =
			current.type !== undefined ? 'type' : current.render !== undefined ? 'render' : null;
		if (!next) break;

		holder = current;
		prop = next;
		current = current[next];
		depth++;
	}

	return typeof current === 'function' ? { holder, prop } : null;
}

function modulePath(id: string): string | undefined {
	return (globalThis as any).window?.modules?.get(id)?.__filePath;
}

function patchRightActions(mod: any): boolean {
	if (unpatch) return true;

	const target = unwrapComponent(mod);
	if (!target) return false;

	unpatch = patcher.after(target.holder, target.prop, (ctx) => {
		try {
			const result = ctx.result as any;
			if (!result?.props) return;

			const channelId = (ctx.args[0] as any)?.channel?.id ?? selectedChannel.getChannelId();
			if (!channelId) return;

			const { React } = metro.common;
			const children = React.Children.toArray(result.props.children);
			children.unshift(<PreviewButton key='unbound-preview-message' channelId={channelId} />);

			return React.cloneElement(result, null, ...children);
		} catch {}
	});

	return true;
}

function waitForRightActions(): void {
	const existing = metro.findByFilePath(RIGHT_ACTIONS_PATH, { interop: false });
	if (patchRightActions(existing)) return;

	removeModuleListener = metro.addListener((module, id) => {
		if (modulePath(id) !== RIGHT_ACTIONS_PATH || !patchRightActions(module)) return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

function buildRecord(channelId: string, content: string, stickers: any[], embeds: LinkEmbed[]) {
	return new messageRecord({
		id: '0',
		type: 0,
		channel_id: channelId,
		content,
		author: users.getCurrentUser(),
		attachments: [],
		embeds,
		mentions: [],
		mention_roles: [],
		timestamp: new Date(),
		edited_timestamp: null,
		pinned: false,
		mention_everyone: false,
		tts: false,
		flags: 0,
		components: [],
		reactions: [],
		sticker_items: stickers,
		stickers,
		state: 'SENT',
		nonce: null,
	});
}

function PreviewOverlay({
	channelId,
	content,
	stickers,
	onClose,
}: {
	channelId: string;
	content: string;
	stickers: any[];
	onClose: () => void;
}) {
	const { React, ReactNative } = metro.common;
	const ChatItem = chatItem;
	const renderedContent = applyTextReplace(content);
	const opacity = React.useRef(new ReactNative.Animated.Value(0)).current;
	const [embeds, setEmbeds] = React.useState<LinkEmbed[]>([]);

	React.useEffect(() => {
		let active = true;
		setEmbeds([]);
		const urls = extractUrls(renderedContent).slice(0, MAX_PREVIEW_URLS);
		if (!urls.length)
			return () => {
				active = false;
			};

		void Promise.all(urls.map((url) => fetchLinkEmbed(url, restApi))).then((resolved) => {
			if (active) setEmbeds(resolved.filter((embed): embed is LinkEmbed => embed !== null));
		});

		return () => {
			active = false;
		};
	}, [renderedContent]);

	React.useEffect(() => {
		haptics?.triggerHapticFeedback?.(haptics.HapticFeedbackTypes.IMPACT_MEDIUM);

		ReactNative.Animated.timing(opacity, {
			toValue: 1,
			duration: FADE_IN_MS,
			useNativeDriver: true,
		}).start();
	}, [opacity]);

	const dismiss = () => {
		ReactNative.Animated.timing(opacity, {
			toValue: 0,
			duration: FADE_OUT_MS,
			useNativeDriver: true,
		}).start(onClose);
	};

	let body: any;
	try {
		const record = buildRecord(channelId, renderedContent, stickers, embeds);
		const generator = new rowManager();
		generator.generate({ rowType: MESSAGE_ROW_TYPE, message: record });
		body = <ChatItem rowGenerator={generator} message={record} />;
	} catch (error) {
		body = (
			<ReactNative.Text style={{ color: '#ff7b72', paddingHorizontal: 14 }}>
				{`Preview failed: ${(error as Error)?.message}`}
			</ReactNative.Text>
		);
	}

	return (
		<ReactNative.Animated.View
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.65)',
				justifyContent: 'center',
				padding: 18,
				opacity,
			}}
		>
			<ReactNative.Pressable
				onPress={dismiss}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
			/>
			<ReactNative.KeyboardAvoidingView
				behavior='padding'
				keyboardVerticalOffset={0}
				style={{ flex: 1, justifyContent: 'center' }}
			>
				<ReactNative.View
					style={{
						backgroundColor: '#2b2d31',
						borderRadius: 14,
						paddingVertical: 12,
						maxHeight: '70%',
					}}
				>
					<ReactNative.Text
						style={{
							color: '#f2f3f5',
							fontWeight: '600',
							paddingHorizontal: 14,
							paddingBottom: 10,
						}}
					>
						Message Preview
					</ReactNative.Text>
					{body}
				</ReactNative.View>
			</ReactNative.KeyboardAvoidingView>
		</ReactNative.Animated.View>
	);
}

function PreviewButton({ channelId }: { channelId: string }) {
	const { React, ReactNative } = metro.common;
	const Portal = (metro.components as any).Portal.Portal;
	const [open, setOpen] = React.useState(false);
	const [slotVisible, setSlotVisible] = React.useState(false);
	const keyboardTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const visibilityTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const slotVisibleRef = React.useRef(false);
	const updateSlotVisible = (next: boolean) => {
		slotVisibleRef.current = next;
		setSlotVisible(next);
	};

	React.useEffect(
		() => () => {
			if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
			if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
		},
		[],
	);

	const draft = React.useSyncExternalStore(
		(onChange: () => void) => subscribeToStore(drafts, onChange),
		() => drafts?.getDraft?.(channelId, CHANNEL_MESSAGE_DRAFT_TYPE) ?? '',
	);
	const stickers = React.useSyncExternalStore(
		(onChange: () => void) => subscribeToStore(stickerPreviews, onChange),
		() => stickerPreviews?.getStickerPreview?.(channelId, false) ?? EMPTY_STICKERS,
	);

	const visible = Boolean(draft.trim() || stickers.length);
	const progress = React.useRef(new ReactNative.Animated.Value(visible ? 1 : 0)).current;
	const openPreview = () => {
		const keyboard = ReactNative.Keyboard;
		chatInputs?.dismissKeyboard?.();
		chatInputs?.getBestActiveInputForChannelId?.(channelId)?.closeCustomKeyboard?.();
		if (!keyboard || typeof keyboard.dismiss !== 'function') {
			setOpen(true);
			return;
		}
		const textInputState = ReactNative.TextInput?.State;
		const focusedInput = textInputState?.currentlyFocusedInput?.();
		if (focusedInput) textInputState?.blurTextInput?.(focusedInput);

		let opened = false;
		let subscription: { remove: () => void } | null = null;
		const open = () => {
			if (opened) return;
			opened = true;
			subscription?.remove();
			if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
			keyboardTimer.current = null;
			setOpen(true);
		};

		if (typeof keyboard.addListener === 'function')
			subscription = keyboard.addListener('keyboardDidHide', open);
		keyboard.dismiss();
		keyboardTimer.current = setTimeout(open, KEYBOARD_DISMISS_DELAY_MS);
	};

	React.useEffect(() => {
		if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
		progress.stopAnimation();
		progress.setValue(0);

		if (visible) {
			const show = () => {
				visibilityTimer.current = null;
				updateSlotVisible(true);
				ReactNative.Animated.timing(progress, {
					toValue: 1,
					duration: SHOW_MS,
					useNativeDriver: false,
				}).start();
			};

			if (slotVisibleRef.current) show();
			else visibilityTimer.current = setTimeout(show, SHOW_DELAY_MS);
			return;
		}

		if (!slotVisibleRef.current) return;
		visibilityTimer.current = setTimeout(() => {
			visibilityTimer.current = null;
			updateSlotVisible(false);
		}, HIDE_MS);
	}, [visible, progress]);

	return (
		<>
			<ReactNative.Animated.View
				style={{
					width: slotVisible ? BUTTON_SIZE : 0,
					marginRight: slotVisible ? 0 : -BUTTON_GAP,
					height: BUTTON_SIZE,
					opacity: visible ? progress : 0,
					overflow: 'hidden',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<ReactNative.Pressable
					onPress={openPreview}
					onPressIn={() =>
						haptics?.triggerHapticFeedback?.(haptics.HapticFeedbackTypes.IMPACT_LIGHT)
					}
					hitSlop={8}
					style={({ pressed }: { pressed: boolean }) => ({
						width: BUTTON_SIZE,
						height: BUTTON_SIZE,
						alignItems: 'center',
						justifyContent: 'center',
						opacity: pressed ? PRESS_OPACITY : 1,
						transform: [{ scale: pressed ? PRESS_SCALE : 1 }],
					})}
				>
					<ReactNative.Animated.Image
						source={eyeIcon}
						style={{
							width: ICON_SIZE,
							height: ICON_SIZE,
							tintColor: ICON_TINT,
							transform: [
								{
									scale: progress.interpolate({
										inputRange: [0, 1],
										outputRange: [ICON_MIN_SCALE, 1],
									}),
								},
							],
						}}
					/>
				</ReactNative.Pressable>
			</ReactNative.Animated.View>
			{open ? (
				<Portal>
					<PreviewOverlay
						channelId={channelId}
						content={draft}
						stickers={stickers}
						onClose={() => setOpen(false)}
					/>
				</Portal>
			) : null}
		</>
	);
}

export default {
	start() {
		drafts = metro.findByProps('getDraft');
		stickerPreviews = metro.findByProps('getStickerPreview');
		chatInputs = metro.findByProps('getBestActiveInputForChannelId');
		selectedChannel = metro.findByProps('getLastSelectedChannelId', 'getChannelId');
		users = metro.findByProps('getCurrentUser', 'getUser');
		chatItem = metro.findByFilePath(CHAT_ITEM_PATH)?.default;
		messageRecord = metro.findByName('MessageRecord');
		rowManager = metro.findByName('RowManager');
		haptics = metro.findByFilePath(HAPTICS_PATH);
		restApi =
			metro.findByProps('get', 'post', 'put', 'patch', 'del') ??
			metro.findByProps('get', 'post');
		eyeIcon = assets.getIDByName('EyeIcon');

		if (
			!drafts?.getDraft ||
			!stickerPreviews?.getStickerPreview ||
			!users?.getCurrentUser ||
			!chatItem ||
			!messageRecord
		)
			return;
		if (!rowManager || !selectedChannel || eyeIcon == null) return;

		waitForRightActions();
	},

	stop() {
		unpatch?.();
		unpatch = null;
		removeModuleListener?.();
		removeModuleListener = null;
		drafts = null;
		selectedChannel = null;
		users = null;
		chatItem = null;
		messageRecord = null;
		rowManager = null;
		haptics = null;
		restApi = null;
		chatInputs = null;
		eyeIcon = null;
		stickerPreviews = null;
	},
};
