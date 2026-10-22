import {
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
} from '@shared/settings-ui';
import { metro, patcher, storage } from '@unbound-app/api';

const ADDON_ID = 'unbound.channel-typing-indicators';
const USER_SUMMARY_ITEM_PATH = 'components_native/common/UserSummaryItem.tsx';
const TEXT_CHANNEL_PATH = 'modules/channel_list_v2/native/items/TextChannel.tsx';
const THREAD_CHANNEL_PATH = 'modules/channel_list_v2/native/items/ThreadChannel.tsx';
const STORE = storage.getStore(ADDON_ID);
const MAX_AVATARS = 3;
const DOTS = 1;
const AVATARS = 2;
const TYPING_MESSAGE_IDS = ['lJ9sZX', 'rB0CUa', 'StKThj', 'uVDhqZ'];

type Channel = { id: string; guild_id?: string; name?: string };
type User = { id: string; username?: string; globalName?: string };
type ChannelRowProps = { channel?: Channel; muted?: boolean };
type TypingStore = {
	getTypingUsers: (channelId: string) => Record<string, number> | null | undefined;
	addChangeListener: (listener: () => void) => void;
	removeChangeListener: (listener: () => void) => void;
};
type UserStore = {
	getCurrentUser: () => User | null | undefined;
	getUser: (id: string) => User | null | undefined;
};
type RelationshipStore = {
	isBlocked: (id: string) => boolean;
	isIgnored?: (id: string) => boolean;
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};
type SelectedChannelStore = {
	getChannelId: () => string | null | undefined;
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};
type GuildSettingsStore = {
	isChannelMuted: (guildId: string | undefined, channelId: string) => boolean;
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};
type MemberStore = { getNick?: (guildId: string, userId: string) => string | null | undefined };
type ThemeModule = {
	colors: Record<string, unknown>;
	internal: { resolveSemanticColor: (theme: string, color: unknown) => string };
	themes: Record<string, string>;
};
type ThemeStore = {
	theme?: string;
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};
type TooltipModule = {
	Tooltip: any;
	TooltipArrowDirections: { UP: string; DOWN: string };
	TooltipArrowPositions: { LEFT: string };
};
type TooltipAnchor = { x: number; y: number; width: number; height: number };
type TooltipPlacement = {
	arrowDirection: string;
	arrowOffset: number;
	left: number;
	top: number;
	width: number;
};
type ActiveIndicator = { pause: () => void; resume: () => void };
type IndicatorRegistry = { enabled: boolean; indicators: Set<ActiveIndicator> };

const INDICATOR_REGISTRY_KEY = Symbol.for('unbound.channel-typing-indicators.indicators');
const registryHost = globalThis as typeof globalThis & {
	[key: symbol]: IndicatorRegistry | undefined;
};
const indicatorRegistry = registryHost[INDICATOR_REGISTRY_KEY] ?? {
	enabled: false,
	indicators: new Set<ActiveIndicator>(),
};
registryHost[INDICATOR_REGISTRY_KEY] = indicatorRegistry;

let typingStore: TypingStore | null = null;
let userStore: UserStore | null = null;
let relationshipStore: RelationshipStore | null = null;
let selectedChannelStore: SelectedChannelStore | null = null;
let guildSettingsStore: GuildSettingsStore | null = null;
let memberStore: MemberStore | null = null;
let userSummaryItem: any = null;
let userIcon: any = null;
let tooltipComponents: TooltipModule | null = null;
let profileSheet: any = null;
let actionSheets: any = null;
let themeStore: ThemeStore | null = null;
let unpatchText: (() => void) | null = null;
let unpatchThread: (() => void) | null = null;
let unpatchThreadRenderer: (() => void) | null = null;
let threadRenderer: ((props: any) => any) | null = null;
let threadRendererHost: { render: (props: any) => any } | null = null;
let removeModuleListener: (() => boolean) | null = null;
let started = false;
const activeIndicators = indicatorRegistry.indicators;

class IndicatorBoundary extends metro.common.React.Component<
	{ children: any },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}

	componentDidCatch(error: unknown): void {
		console.error('Channel typing indicator failed:', error);
	}

	render(): any {
		return this.state.failed ? null : this.props.children;
	}
}

export function visibleTypingIds(
	typingUsers: Record<string, number> | null | undefined,
	currentUserId: string | undefined,
	isBlocked: (id: string) => boolean,
	includeBlockedUsers: boolean,
	isIgnored: (id: string) => boolean = () => false,
	includeIgnoredUsers: boolean = false,
): string[] {
	if (!typingUsers) return [];
	return Object.keys(typingUsers).filter(
		(id) =>
			id !== currentUserId &&
			(includeBlockedUsers || !isBlocked(id)) &&
			(includeIgnoredUsers || !isIgnored(id)),
	);
}

export function sameIds(first: string[], second: string[]): boolean {
	return first.length === second.length && first.every((id, index) => id === second[index]);
}

export function typingLabel(names: string[]): string {
	if (!names.length) return '';
	let fallback = 'Several people are typing...';
	if (names.length === 1) fallback = `${names[0]} is typing...`;
	if (names.length === 2) fallback = `${names[0]} and ${names[1]} are typing...`;
	if (names.length === 3) fallback = `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
	const messageId = TYPING_MESSAGE_IDS[Math.min(names.length, 4) - 1];
	const i18n = (metro.common as any).i18n;
	const message = i18n?.t?.[messageId];
	if (typeof message !== 'function') return fallback;
	try {
		const localized = i18n.intl?.formatToPlainString?.(message, {
			a: names[0],
			b: names[1],
			c: names[2],
		});
		return typeof localized === 'string' && localized ? localized : fallback;
	} catch {
		return fallback;
	}
}

export function tooltipPlacement(
	anchor: TooltipAnchor,
	labelLength: number,
	viewportWidth: number,
): TooltipPlacement {
	const width = Math.min(viewportWidth - 16, Math.max(120, Math.min(260, labelLength * 6 + 28)));
	const left = Math.max(
		8,
		Math.min(anchor.x + anchor.width / 2 - width / 2, viewportWidth - width - 8),
	);
	const height = Math.min(100, Math.max(42, Math.ceil(labelLength / 38) * 18 + 22));
	const below = anchor.y - height - 6 < 28;
	return {
		arrowDirection: below ? 'UP' : 'DOWN',
		arrowOffset: anchor.x + anchor.width / 2 - left - 8,
		left,
		top: below ? anchor.y + anchor.height + 6 : anchor.y - height - 6,
		width,
	};
}

function displayName(user: User, guildId?: string): string {
	return (
		(guildId ? memberStore?.getNick?.(guildId, user.id) : undefined) ??
		user.globalName ??
		user.username ??
		user.id
	);
}

function readTypingIds(
	channel: Channel,
	muted: boolean,
	includeMuted: boolean,
	includeBlocked: boolean,
	includeIgnored: boolean,
	includeCurrent: boolean,
): string[] {
	if (!includeCurrent && selectedChannelStore?.getChannelId?.() === channel.id) return [];
	if (
		!includeMuted &&
		(muted || guildSettingsStore?.isChannelMuted?.(channel.guild_id, channel.id))
	)
		return [];
	return visibleTypingIds(
		typingStore?.getTypingUsers(channel.id),
		userStore?.getCurrentUser()?.id,
		(id) => relationshipStore?.isBlocked(id) ?? false,
		includeBlocked,
		(id) => relationshipStore?.isIgnored?.(id) ?? false,
		includeIgnored,
	);
}

function TypingDots() {
	const { React, ReactNative } = metro.common;
	const Animated = ReactNative.Animated;
	const theme = (metro.common as any).Theme as ThemeModule;
	const [appearance, setAppearance] = React.useState(themeStore?.theme ?? theme.themes.DARK);
	const dotColor = theme.internal.resolveSemanticColor(appearance, theme.colors.TEXT_MUTED);
	const phase = React.useRef(new Animated.Value(2.8)).current;
	const waves = React.useRef(
		[0, 1, 2].map((index) =>
			Animated.modulo(Animated.add(phase, index === 0 ? 0 : -index * 0.25), 2),
		),
	).current;
	const inputRange = [0, 0.4, 0.8, 1, 1.2, 1.6, 2];

	React.useEffect(() => {
		const currentStore = themeStore;
		function refresh(): void {
			setAppearance(currentStore?.theme ?? theme.themes.DARK);
		}
		currentStore?.addChangeListener?.(refresh);
		return () => currentStore?.removeChangeListener?.(refresh);
	}, [theme]);

	React.useEffect(() => {
		const animation = Animated.loop(
			Animated.timing(phase, {
				toValue: 6.8,
				duration: 2400,
				easing: ReactNative.Easing.linear,
				useNativeDriver: true,
			}),
		);
		animation.start();
		return () => animation.stop();
	}, [Animated, phase, ReactNative.Easing]);

	return (
		<ReactNative.View
			style={{ alignItems: 'center', flexDirection: 'row', height: 16, marginLeft: 6 }}
		>
			{waves.map((wave: any, index: number) => (
				<Animated.View
					key={index}
					style={{
						backgroundColor: dotColor,
						borderRadius: 3,
						height: 6,
						marginRight: index < 2 ? 1.5 : 0,
						opacity: wave.interpolate({
							inputRange,
							outputRange: [0.3, 0.3, 1, 1, 1, 0.3, 0.3],
						}),
						transform: [
							{
								scale: wave.interpolate({
									inputRange,
									outputRange: [0.8, 0.8, 1, 1, 1, 0.8, 0.8],
								}),
							},
						],
						width: 6,
					}}
				/>
			))}
		</ReactNative.View>
	);
}

function openProfile(userId: string, channelId: string): void {
	profileSheet ??= metro.find(
		(module) => module?.default?.type?.name === 'UserProfileActionSheet',
		{ interop: false },
	)?.default;
	actionSheets ??= metro.findByProps('openLazy', 'hideActionSheet');
	if (!profileSheet || !actionSheets?.openLazy) return;
	actionSheets.openLazy(Promise.resolve({ default: profileSheet }), `UserProfile${userId}`, {
		userId,
		channelId,
		sourceAnalyticsLocations: ['avatar'],
		openedAt: Date.now(),
	});
}

function TypingAvatars({
	users,
	guildId,
	channelId,
	containerRef,
	onLongPress,
}: {
	users: (User | null)[];
	guildId?: string;
	channelId: string;
	containerRef: any;
	onLongPress: () => void;
}) {
	const { ReactNative } = metro.common;
	const Component = userSummaryItem;
	const UserIcon = userIcon;
	if (!Component) return null;
	const theme = (metro.common as any).Theme as ThemeModule;
	const appearance = themeStore?.theme ?? theme.themes.DARK;
	const background = theme.internal.resolveSemanticColor(
		appearance,
		theme.colors.BACKGROUND_ACCENT,
	);
	const foreground = theme.internal.resolveSemanticColor(appearance, theme.colors.TEXT_DEFAULT);
	const visible = users.slice(0, MAX_AVATARS);
	const overflow = users.length - visible.length;
	function showAvatarsTooltip(event: any): void {
		event.stopPropagation();
		onLongPress();
	}
	return (
		<ReactNative.View
			ref={containerRef}
			style={{ alignItems: 'center', flexDirection: 'row', marginLeft: 6 }}
		>
			{visible.map((user, index) => (
				<ReactNative.View
					key={user?.id ?? `unknown-${index}`}
					style={{ marginLeft: index ? -6 : 0, zIndex: visible.length - index }}
				>
					{user ? (
						<ReactNative.Pressable
							onPress={(event: any) => {
								event.stopPropagation();
								openProfile(user.id, channelId);
							}}
							onLongPress={showAvatarsTooltip}
						>
							<Component
								users={[user]}
								guildId={guildId}
								renderIcon={false}
								max={1}
								size={16}
								showDefaultAvatarsForNullUsers
								showUserPopout
							/>
						</ReactNative.Pressable>
					) : (
						<ReactNative.Pressable
							onPress={showAvatarsTooltip}
							onLongPress={showAvatarsTooltip}
						>
							<ReactNative.View
								style={{
									alignItems: 'center',
									backgroundColor: background,
									borderRadius: 8,
									height: 16,
									justifyContent: 'center',
									width: 16,
								}}
							>
								{UserIcon ? (
									<UserIcon
										color={foreground}
										style={{ transform: [{ scale: 0.5 }] }}
									/>
								) : null}
							</ReactNative.View>
						</ReactNative.Pressable>
					)}
				</ReactNative.View>
			))}
			{overflow > 0 ? (
				<ReactNative.Pressable
					onPress={showAvatarsTooltip}
					onLongPress={showAvatarsTooltip}
					style={{ marginLeft: -6, zIndex: MAX_AVATARS + 1 }}
				>
					<ReactNative.View
						style={{
							alignItems: 'center',
							backgroundColor: '#000',
							borderRadius: 8,
							height: 16,
							justifyContent: 'center',
							width: 16,
						}}
					>
						<ReactNative.Text style={{ color: '#fff', fontSize: 8, fontWeight: '600' }}>
							{`+${overflow}`}
						</ReactNative.Text>
					</ReactNative.View>
				</ReactNative.Pressable>
			) : null}
		</ReactNative.View>
	);
}

function ChannelTypingIndicator({ channel, muted }: { channel: Channel; muted: boolean }) {
	const { React, ReactNative } = metro.common;
	const avatarsRef = React.useRef<any>(null);
	const dotsRef = React.useRef<any>(null);
	const [tooltipAnchor, setTooltipAnchor] = React.useState<TooltipAnchor | null>(null);
	const settings = STORE.useSettingsStore();
	const includeMuted = settings.get('includeMutedChannels', false);
	const includeBlocked = settings.get('includeBlockedUsers', false);
	const includeIgnored = settings.get('includeIgnoredUsers', false);
	const includeCurrent = settings.get('includeCurrentChannel', true);
	const indicatorMode = settings.get('indicatorMode', DOTS | AVATARS);
	const [typingIds, setTypingIds] = React.useState<string[]>(() =>
		readTypingIds(channel, muted, includeMuted, includeBlocked, includeIgnored, includeCurrent),
	);

	React.useEffect(() => {
		let subscribed = false;
		let currentTypingStore: TypingStore | null = null;
		let currentRelationshipStore: RelationshipStore | null = null;
		let currentGuildSettingsStore: GuildSettingsStore | null = null;
		let currentSelectedChannelStore: SelectedChannelStore | null = null;
		function refresh(): void {
			const next = readTypingIds(
				channel,
				muted,
				includeMuted,
				includeBlocked,
				includeIgnored,
				includeCurrent,
			);
			setTypingIds((current) => (sameIds(current, next) ? current : next));
		}
		function unsubscribe(): void {
			if (!subscribed) return;
			subscribed = false;
			currentTypingStore?.removeChangeListener(refresh);
			currentRelationshipStore?.removeChangeListener?.(refresh);
			currentGuildSettingsStore?.removeChangeListener?.(refresh);
			currentSelectedChannelStore?.removeChangeListener?.(refresh);
			currentTypingStore = null;
			currentRelationshipStore = null;
			currentGuildSettingsStore = null;
			currentSelectedChannelStore = null;
		}
		function pause(): void {
			unsubscribe();
			setTypingIds([]);
			setTooltipAnchor(null);
		}
		function resume(): void {
			if (
				subscribed ||
				!indicatorRegistry.enabled ||
				!typingStore?.getTypingUsers ||
				!userStore?.getUser
			)
				return;
			currentTypingStore = typingStore;
			currentRelationshipStore = relationshipStore;
			currentGuildSettingsStore = guildSettingsStore;
			currentSelectedChannelStore = selectedChannelStore;
			subscribed = true;
			refresh();
			currentTypingStore.addChangeListener(refresh);
			currentRelationshipStore?.addChangeListener?.(refresh);
			currentGuildSettingsStore?.addChangeListener?.(refresh);
			currentSelectedChannelStore?.addChangeListener?.(refresh);
		}
		const indicator = { pause, resume };
		activeIndicators.add(indicator);
		resume();
		return () => {
			unsubscribe();
			activeIndicators.delete(indicator);
		};
	}, [
		channel.id,
		channel.guild_id,
		muted,
		includeMuted,
		includeBlocked,
		includeIgnored,
		includeCurrent,
	]);

	if (!typingIds.length) return null;
	const typingUsers = typingIds.map((id) => userStore?.getUser(id) ?? null);
	const names = typingUsers.map((user) =>
		user ? displayName(user, channel.guild_id) : 'Someone',
	);
	const label = typingLabel(names);
	const theme = (metro.common as any).Theme as ThemeModule;
	const appearance = themeStore?.theme ?? theme.themes.DARK;
	const background = theme.internal.resolveSemanticColor(
		appearance,
		theme.colors.BACKGROUND_SURFACE_HIGHEST,
	);
	const foreground = theme.internal.resolveSemanticColor(appearance, theme.colors.TEXT_DEFAULT);
	const placement = tooltipAnchor
		? tooltipPlacement(tooltipAnchor, label.length, ReactNative.Dimensions.get('window').width)
		: null;
	function showTooltip(targetRef: any): void {
		targetRef.current?.measureInWindow?.(
			(x: number, y: number, width: number, height: number) => {
				if (![x, y, width, height].every(Number.isFinite)) return;
				setTooltipAnchor({ x, y, width, height });
			},
		);
	}

	return (
		<>
			<ReactNative.View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 0 }}>
				{indicatorMode & AVATARS ? (
					<TypingAvatars
						users={typingUsers}
						guildId={channel.guild_id}
						channelId={channel.id}
						containerRef={avatarsRef}
						onLongPress={() => showTooltip(avatarsRef)}
					/>
				) : null}
				{indicatorMode & DOTS ? (
					<ReactNative.Pressable
						ref={dotsRef}
						accessibilityLabel={label}
						onPress={(event: any) => {
							event.stopPropagation();
							showTooltip(dotsRef);
						}}
					>
						<TypingDots />
					</ReactNative.Pressable>
				) : null}
			</ReactNative.View>
			{placement && tooltipComponents?.Tooltip ? (
				<ReactNative.Modal
					visible
					transparent
					statusBarTranslucent
					onRequestClose={() => setTooltipAnchor(null)}
				>
					<ReactNative.View style={{ flex: 1 }}>
						<ReactNative.Pressable
							onPress={() => setTooltipAnchor(null)}
							style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
						/>
						<ReactNative.View
							pointerEvents='none'
							style={{
								left: placement.left,
								position: 'absolute',
								top: placement.top,
							}}
						>
							<tooltipComponents.Tooltip
								arrowDirection={placement.arrowDirection}
								arrowOffset={placement.arrowOffset}
								arrowPosition={tooltipComponents.TooltipArrowPositions.LEFT}
								arrowStyle={{
									borderBottomColor: background,
									borderTopColor: background,
								}}
								containerStyle={{ backgroundColor: background }}
								label={label}
								labelStyle={{ color: foreground }}
								style={{ width: placement.width }}
							/>
						</ReactNative.View>
					</ReactNative.View>
				</ReactNative.Modal>
			) : null}
		</>
	);
}

function isIndicatorBoundary(element: any): boolean {
	return (
		element?.type === IndicatorBoundary ||
		element?.key === ADDON_ID ||
		element?.props?.key === ADDON_ID
	);
}

export function insertTypingIndicator(result: any, channel: Channel, muted: boolean): any {
	const { React } = metro.common;
	const outerChildren = result?.props?.children;
	if (!Array.isArray(outerChildren)) return result;
	const row = outerChildren.find((child) => child?.props?.accessibilityRole === 'button');
	const rowChildren = row?.props?.children;
	if (!Array.isArray(rowChildren)) return result;
	const content = rowChildren.find(
		(child) =>
			Array.isArray(child?.props?.children) &&
			child.props.children.some((part: any) => part?.props?.channel?.id === channel.id),
	);
	if (!content) return result;
	const contentChildren = content.props.children;
	if (contentChildren.some(isIndicatorBoundary)) return result;
	const infoIndex = contentChildren.findIndex(
		(part: any) => part?.props?.channel?.id === channel.id,
	);
	if (infoIndex < 0) return result;
	const indicator = (
		<IndicatorBoundary key={ADDON_ID}>
			<ChannelTypingIndicator channel={channel} muted={muted} />
		</IndicatorBoundary>
	);
	const nextContent = React.cloneElement(content, {}, [
		...contentChildren.slice(0, infoIndex),
		indicator,
		...contentChildren.slice(infoIndex),
	]);
	const nextRow = React.cloneElement(
		row,
		{},
		rowChildren.map((child: any) => (child === content ? nextContent : child)),
	);
	return React.cloneElement(
		result,
		{},
		outerChildren.map((child: any) => (child === row ? nextRow : child)),
	);
}

export function insertThreadTypingIndicator(result: any, channel: Channel, muted: boolean): any {
	const { React, ReactNative } = metro.common;
	const outerChildren = result?.props?.children;
	if (!Array.isArray(outerChildren)) return result;
	for (const container of outerChildren) {
		const children = container?.props?.children;
		if (!Array.isArray(children)) continue;
		const row = children.find(
			(child) =>
				child?.props?.channel?.id === channel.id &&
				child.props.accessibilityRole === 'button',
		);
		if (!row) continue;
		const currentInfo = row.props.channelInfo;
		if (
			isIndicatorBoundary(currentInfo) ||
			isIndicatorBoundary(currentInfo?.props?.children?.[1])
		)
			return result;
		const indicator = (
			<IndicatorBoundary key={ADDON_ID}>
				<ChannelTypingIndicator channel={channel} muted={muted} />
			</IndicatorBoundary>
		);
		const channelInfo = currentInfo ? (
			<ReactNative.View style={{ alignItems: 'center', flexDirection: 'row' }}>
				{currentInfo}
				{indicator}
			</ReactNative.View>
		) : (
			indicator
		);
		const nextRow = React.cloneElement(row, { channelInfo });
		const nextContainer = React.cloneElement(
			container,
			{},
			children.map((child: any) => (child === row ? nextRow : child)),
		);
		return React.cloneElement(
			result,
			{},
			outerChildren.map((child: any) => (child === container ? nextContainer : child)),
		);
	}
	return result;
}

function patchTextChannel(module: any): boolean {
	const target = module?.default;
	if (unpatchText || typeof target?.type !== 'function') return Boolean(unpatchText);
	unpatchText = patcher.after(target, 'type', ({ args, result }) => {
		const { channel, muted } = (args[0] ?? {}) as ChannelRowProps;
		if (!channel?.id) return result;
		return insertTypingIndicator(result, channel, Boolean(muted));
	});
	return true;
}

function patchThreadChannel(module: any): boolean {
	if (unpatchThread || typeof module?.default !== 'function') return Boolean(unpatchThread);
	unpatchThread = patcher.after(module, 'default', ({ result }) => {
		if (typeof result?.type !== 'function') return result;
		if (threadRenderer !== result.type) {
			unpatchThreadRenderer?.();
			threadRenderer = result.type;
			threadRendererHost = { render: result.type };
			unpatchThreadRenderer = patcher.after(
				threadRendererHost,
				'render',
				({ args, result }) => {
					const { channel, muted } = (args[0] ?? {}) as ChannelRowProps;
					if (!channel?.id) return result;
					return insertThreadTypingIndicator(result, channel, Boolean(muted));
				},
			);
		}
		const { React } = metro.common;
		return React.createElement(threadRendererHost!.render, {
			...result.props,
			key: result.key,
		});
	});
	return true;
}

function patchAvailableChannelModules(): boolean {
	typingStore ??= metro.findByProps('getTypingUsers') as TypingStore | null;
	userStore ??= metro.findByProps('getCurrentUser', 'getUser') as UserStore | null;
	if (!typingStore?.getTypingUsers || !userStore?.getUser) return false;
	for (const indicator of activeIndicators) indicator.resume();
	const textReady = patchTextChannel(metro.findByFilePath(TEXT_CHANNEL_PATH, { interop: false }));
	const threadReady = patchThreadChannel(
		metro.findByFilePath(THREAD_CHANNEL_PATH, { interop: false }),
	);
	return textReady && threadReady;
}

function waitForChannelModules(): void {
	if (patchAvailableChannelModules()) return;
	removeModuleListener = metro.addListener(() => {
		if (!patchAvailableChannelModules()) return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

function ChannelTypingSettings() {
	const settings = STORE.useSettingsStore();
	const indicatorMode = settings.get('indicatorMode', DOTS | AVATARS);
	return (
		<SettingsScrollView>
			<SettingsSection title='Channel typing indicators'>
				<SettingsSwitchRow
					label='Include current channel'
					description='Show typing activity in the selected channel.'
					value={settings.get('includeCurrentChannel', true)}
					onValueChange={(value: boolean) => settings.set('includeCurrentChannel', value)}
				/>
				<SettingsSwitchRow
					label='Include muted channels'
					description='Show typing activity in muted channels.'
					value={settings.get('includeMutedChannels', false)}
					onValueChange={(value: boolean) => settings.set('includeMutedChannels', value)}
				/>
				<SettingsSwitchRow
					label='Include ignored users'
					description='Show typing activity from ignored users.'
					value={settings.get('includeIgnoredUsers', false)}
					onValueChange={(value: boolean) => settings.set('includeIgnoredUsers', value)}
				/>
				<SettingsSwitchRow
					label='Include blocked users'
					description='Show typing activity from blocked users.'
					value={settings.get('includeBlockedUsers', false)}
					onValueChange={(value: boolean) => settings.set('includeBlockedUsers', value)}
				/>
			</SettingsSection>
			<SettingsSection title='Appearance'>
				<SettingsRow
					label='Avatars and animated dots'
					trailing={indicatorMode === (DOTS | AVATARS) ? '✓' : undefined}
					onPress={() => settings.set('indicatorMode', DOTS | AVATARS)}
				/>
				<SettingsRow
					label='Animated dots'
					trailing={indicatorMode === DOTS ? '✓' : undefined}
					onPress={() => settings.set('indicatorMode', DOTS)}
				/>
				<SettingsRow
					label='Avatars'
					trailing={indicatorMode === AVATARS ? '✓' : undefined}
					onPress={() => settings.set('indicatorMode', AVATARS)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start() {
		if (started) return;
		started = true;
		indicatorRegistry.enabled = true;
		typingStore = metro.findByProps('getTypingUsers') as TypingStore | null;
		userStore = metro.findByProps('getCurrentUser', 'getUser') as UserStore | null;
		relationshipStore = metro.findByProps('isBlocked') as RelationshipStore | null;
		selectedChannelStore = metro.findByProps('getChannelId') as SelectedChannelStore | null;
		guildSettingsStore = metro.findByProps('isChannelMuted') as GuildSettingsStore | null;
		memberStore = metro.findByProps('getNick') as MemberStore | null;
		const summaryModule = metro.findByFilePath(USER_SUMMARY_ITEM_PATH, { interop: false });
		userSummaryItem =
			typeof summaryModule?.default === 'function'
				? summaryModule.default
				: metro.findByName('UserSummaryItem');
		userIcon = (metro.findByProps('UserIcon') as { UserIcon?: unknown } | null)?.UserIcon;
		tooltipComponents = metro.findByProps(
			'TooltipArrowDirections',
			'TooltipArrowPositions',
		) as TooltipModule | null;
		const theme = (metro.common as any).Theme as ThemeModule;
		themeStore = metro.find((module) => {
			const appearance = module?.theme;
			return (
				typeof appearance === 'string' && Object.values(theme.themes).includes(appearance)
			);
		}) as ThemeStore | null;
		waitForChannelModules();
	},
	stop() {
		started = false;
		indicatorRegistry.enabled = false;
		for (const indicator of activeIndicators) indicator.pause();
		unpatchText?.();
		unpatchText = null;
		unpatchThread?.();
		unpatchThread = null;
		unpatchThreadRenderer?.();
		unpatchThreadRenderer = null;
		threadRenderer = null;
		threadRendererHost = null;
		removeModuleListener?.();
		removeModuleListener = null;
	},
	getSettingsPanel: () => <ChannelTypingSettings />,
};
