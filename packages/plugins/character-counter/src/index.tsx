import { SettingsScrollView, SettingsSection, SettingsSwitchRow } from '@shared/settings-ui';
import { metro, patcher, storage } from '@unbound-app/api';

const ADDON_ID = 'unbound.character-counter';
const COMPOSER_CONTAINER_PATH = 'modules/chat_input/native/FloatingChatInputContainer.tsx';
const COUNTER_HEIGHT = 20;
const COUNTER_GAP = 6;
const INPUT_REFRESH_INTERVAL_MS = 200;
const STORE = storage.getStore(ADDON_ID);

type ComponentTarget = { holder: any; prop: string };
type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => { getText?: () => unknown } | null;
};
type CounterSnapshot = { colorEffects: boolean; limit: number; text: string };
type CounterTone = 'primary' | 'muted' | 'yellow' | 'orange' | 'red';

let started = false;
let unpatch: (() => void) | null = null;
let removeModuleListener: (() => boolean) | null = null;
let chatInputs: ChatInputRegistry | null = null;
let users: { getCurrentUser?: () => { premiumType?: unknown } | null } | null = null;
let selectedChannel: { getChannelId?: () => string | undefined } | null = null;

export function characterLimit(premiumType: unknown): number {
	return premiumType === 2 ? 4000 : 2000;
}

export function counterTone(count: number, limit: number, enabled: boolean): CounterTone {
	if (!enabled) return 'primary';
	const percentage = (count / limit) * 100;
	if (percentage < 50) return 'muted';
	if (percentage < 75) return 'yellow';
	if (percentage < 90) return 'orange';
	return 'red';
}

export function counterOverlayStyle(): Record<string, number | string> {
	return {
		position: 'absolute',
		top: -(COUNTER_HEIGHT + COUNTER_GAP),
		right: 28,
		zIndex: 10,
	};
}

function unwrapComponent(module: any): ComponentTarget | null {
	let holder = module;
	let prop = 'default';
	let current = module?.default;
	let depth = 0;

	while (current && typeof current === 'object' && depth < 8) {
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

function counterColor(tone: CounterTone): string {
	const colors = (metro.common.Theme as any)?.colors ?? {};
	if (tone === 'primary') return colors.BRAND_330 ?? colors.BRAND_500 ?? '#5865f2';
	if (tone === 'yellow') return colors.YELLOW_330 ?? colors.YELLOW_300 ?? '#fee75c';
	if (tone === 'orange') return colors.ORANGE_330 ?? colors.ORANGE_300 ?? '#f0b232';
	if (tone === 'red') return colors.RED_360 ?? colors.RED_400 ?? '#ed4245';
	return colors.TEXT_NORMAL ?? '#f2f3f5';
}

export function counterSurface(textColor: unknown): string {
	if (typeof textColor !== 'string') return 'rgba(255, 255, 255, 0.12)';
	const hex = textColor.match(/^#?([\da-f]{6})$/i)?.[1];
	const rgb = textColor.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	const channels = hex
		? [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
		: rgb?.slice(1, 4).map(Number);
	if (!channels) return 'rgba(255, 255, 255, 0.12)';
	const brightness = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
	return brightness > 160 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
}

function counterBackground(): string {
	const colors = (metro.common.Theme as any)?.colors ?? {};
	return counterSurface(colors.TEXT_DEFAULT ?? colors.TEXT_NORMAL);
}

function readSnapshot(channelId: string): CounterSnapshot {
	const input = chatInputs?.getBestActiveInputForChannelId?.(channelId);
	const textValue = input?.getText?.();
	const text = typeof textValue === 'string' ? textValue : '';
	const limit = characterLimit(users?.getCurrentUser?.()?.premiumType);
	const colorEffects = STORE.get('colorEffects', true);
	return { colorEffects, limit, text };
}

function CharacterCounter({ channelId }: { channelId: string }) {
	const { React, ReactNative } = metro.common;
	const [snapshot, setSnapshot] = React.useState({
		colorEffects: true,
		limit: 2000,
		text: '',
	});

	React.useEffect(() => {
		function refresh(): void {
			const next = readSnapshot(channelId);
			setSnapshot((current: CounterSnapshot) =>
				current.text === next.text &&
				current.limit === next.limit &&
				current.colorEffects === next.colorEffects
					? current
					: next,
			);
		}

		refresh();
		const timer = setInterval(refresh, INPUT_REFRESH_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [channelId]);

	if (!snapshot.text.length) return null;

	const tone = counterTone(snapshot.text.length, snapshot.limit, snapshot.colorEffects);
	return (
		<ReactNative.View
			style={{
				alignItems: 'center',
				backgroundColor: counterBackground(),
				borderRadius: 999,
				height: 20,
				justifyContent: 'center',
				paddingHorizontal: 7,
			}}
		>
			<ReactNative.Text
				accessibilityLabel={`${snapshot.text.length} of ${snapshot.limit} characters`}
				style={{
					color: counterColor(tone),
					fontSize: 11,
					fontVariant: ['tabular-nums'],
					fontWeight: '600',
					lineHeight: 14,
					textAlign: 'center',
				}}
			>
				{snapshot.text.length}/{snapshot.limit}
			</ReactNative.Text>
		</ReactNative.View>
	);
}

function CounterOverlay({ channelId }: { channelId: string }) {
	const { ReactNative } = metro.common;

	return (
		<ReactNative.View pointerEvents='none' style={counterOverlayStyle()}>
			<CharacterCounter channelId={channelId} />
		</ReactNative.View>
	);
}

function stripCounterOverlays(children: any, React: any): any {
	if (Array.isArray(children)) {
		const stripped = children.map((child) => stripCounterOverlays(child, React));
		if (stripped.every((child, index) => child === children[index])) return children;
		return stripped.filter((child) => child !== null);
	}
	if (!children || typeof children !== 'object') return children;
	if (children.type === CounterOverlay) return null;
	if (children.type !== React.Fragment) return children;

	const originalChildren = children.props?.children;
	const strippedChildren = stripCounterOverlays(originalChildren, React);
	if (strippedChildren === originalChildren) return children;
	return React.cloneElement(children, {}, strippedChildren);
}

function patchComposer(module: any): boolean {
	if (unpatch) return true;
	const target = unwrapComponent(module);
	if (!target) return false;

	unpatch = patcher.after(target.holder, target.prop, (ctx) => {
		try {
			const result = ctx.result as any;
			if (!result?.props) return;

			const props = ctx.args[0] as any;
			const channelId =
				props?.channel?.id ?? props?.channelId ?? selectedChannel?.getChannelId?.();
			if (!channelId) return;

			const { React } = metro.common;
			const overlay = React.createElement(CounterOverlay, {
				key: 'character-counter',
				channelId: String(channelId),
			});
			const children = stripCounterOverlays(result.props.children, React);
			return React.cloneElement(
				result,
				{},
				React.createElement(React.Fragment, null, children, overlay),
			);
		} catch {}
	});

	return true;
}

function initialize(): boolean {
	if (!started) return false;
	if (unpatch) return true;
	chatInputs = metro.findByProps('getBestActiveInputForChannelId');
	users = metro.findByProps('getCurrentUser');
	selectedChannel = metro.findByProps('getChannelId');
	const module = metro.findByFilePath(COMPOSER_CONTAINER_PATH, { interop: false });
	if (
		typeof chatInputs?.getBestActiveInputForChannelId !== 'function' ||
		typeof users?.getCurrentUser !== 'function'
	) {
		return false;
	}
	return patchComposer(module);
}

function waitForComposer(): void {
	if (initialize()) return;
	removeModuleListener = metro.addListener(() => {
		if (!initialize()) return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

function CharacterCounterSettings() {
	const state = STORE.useSettingsStore();
	return (
		<SettingsScrollView>
			<SettingsSection title='Appearance'>
				<SettingsSwitchRow
					label='Color thresholds'
					description='Warn as the message approaches Discord’s character limit.'
					value={state.get('colorEffects', true)}
					onValueChange={(value: boolean) => state.set('colorEffects', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start() {
		if (started) return;
		started = true;
		waitForComposer();
	},
	stop() {
		started = false;
		unpatch?.();
		unpatch = null;
		removeModuleListener?.();
		removeModuleListener = null;
		chatInputs = null;
		users = null;
		selectedChannel = null;
	},
	getSettingsPanel: () => <CharacterCounterSettings />,
};
