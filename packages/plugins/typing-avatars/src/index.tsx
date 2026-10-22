import { metro, patcher } from '@unbound-app/api';

const TYPING_INDICATOR_PATH = 'modules/chat/native/TypingIndicator.tsx';
const AVATAR_GUTTER = 24;
const AVATAR_HEIGHT = 16;
const AVATAR_LIFT = 2;
const AVATAR_OVERLAP = -6;
const MAX_AVATARS = 3;

let components: any = null;
let users: { getUser?: (id: string) => User | undefined } | null = null;
let unpatch: (() => void) | null = null;
let removeModuleListener: (() => boolean) | null = null;

type User = {
	id: string;
};

type TypingItem = {
	channel?: { guild_id?: string };
	typingUserIds?: string[];
	wrapperStyle?: unknown;
};

function collapseGutter(item: TypingItem): void {
	if (!Array.isArray(item.wrapperStyle)) return;
	item.wrapperStyle = item.wrapperStyle.map((style: any) =>
		style?.paddingLeft != null ? { ...style, paddingLeft: 0 } : style,
	);
}

function TypingAvatars({ item, typingUsers }: { item: TypingItem; typingUsers: User[] }) {
	const ReactNative = metro.common.ReactNative;
	const visibleUsers = typingUsers.slice(0, MAX_AVATARS);
	return (
		<ReactNative.View
			style={{
				flexDirection: 'row',
				height: AVATAR_HEIGHT,
				marginRight: 0,
				transform: [{ translateY: -AVATAR_LIFT }],
				width: visibleUsers.length
					? AVATAR_HEIGHT + (visibleUsers.length - 1) * (AVATAR_HEIGHT + AVATAR_OVERLAP)
					: 0,
			}}
		>
			{visibleUsers.map((user, index) => (
				<ReactNative.View
					key={user.id}
					style={{
						marginLeft: index ? AVATAR_OVERLAP : 0,
						zIndex: visibleUsers.length - index,
					}}
				>
					<components.Avatar
						user={user}
						size={components.AvatarSizes.SIZE_16}
						guildId={item.channel?.guild_id}
					/>
				</ReactNative.View>
			))}
		</ReactNative.View>
	);
}

function modulePath(id: number | string): string | undefined {
	return globalThis.window?.modules?.get?.(id)?.__filePath;
}

function resolvePatchTarget(module: any): { holder: any; prop: string } | null {
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

function patchTypingIndicator(module: { default?: unknown } | null): boolean {
	const target = resolvePatchTarget(module);
	if (unpatch || !target) return Boolean(unpatch);
	unpatch = patcher.after(target.holder, target.prop, ({ result }) => {
		const renderItem = result?.props?.renderItem;
		const item = result?.props?.item as TypingItem | undefined;
		const directIds = result?.props?.typingUserIds;
		const ids = item?.typingUserIds ?? (Array.isArray(directIds) ? directIds : undefined);
		const resolvedItem = item ?? {
			channel: result?.props?.channel,
			wrapperStyle: result?.props?.wrapperStyle,
		};
		if (typeof renderItem !== 'function' || !ids?.length) return result;
		const { React, ReactNative } = metro.common;
		collapseGutter(resolvedItem);
		return React.cloneElement(result, {
			renderItem: (...args: unknown[]) => {
				const inner = renderItem(...args);
				const typingUsers = ids
					.map((id) => users?.getUser?.(id))
					.filter((user): user is User => Boolean(user));
				if (!typingUsers.length) return inner;
				return (
					<ReactNative.View
						style={{
							alignItems: 'center',
							flexDirection: 'row',
							paddingLeft: AVATAR_GUTTER,
						}}
					>
						<TypingAvatars item={resolvedItem} typingUsers={typingUsers} />
						<ReactNative.View style={{ flex: 1, marginLeft: -26 }}>
							{inner}
						</ReactNative.View>
					</ReactNative.View>
				);
			},
		});
	});
	return true;
}

function start(): void {
	components = metro.findByProps('SummarizedIconRow', 'Avatar', 'AvatarSizes');
	users = metro.findByProps('getCurrentUser', 'getUser');
	if (!components?.SummarizedIconRow || !components?.Avatar || !users?.getUser) return;
	if (patchTypingIndicator(metro.findByFilePath(TYPING_INDICATOR_PATH, { interop: false })))
		return;
	removeModuleListener = metro.addListener((module, id) => {
		if (modulePath(id) !== TYPING_INDICATOR_PATH || !patchTypingIndicator(module)) return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

export default {
	start,
	stop() {
		unpatch?.();
		unpatch = null;
		removeModuleListener?.();
		removeModuleListener = null;
		components = null;
		users = null;
	},
};
