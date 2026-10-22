import { assets, metro, patcher, toasts } from '@unbound-app/api';

const PATCHER = patcher.createPatcher('unbound.view-icons');
const DEFAULT_AVATAR_SIZE = 512;
const DEFAULT_BANNER_WIDTH = 1024;
const DEFAULT_BANNER_HEIGHT = 256;
const IMAGE_SIZE = 4096;

type User = {
	id: string;
	username?: string;
	avatar?: string | null;
	banner?: string | null;
};

type Guild = {
	id: string;
	name?: string;
	icon?: string | null;
	banner?: string | null;
};

type Channel = {
	id: string;
	type?: number;
	icon?: string | null;
	recipients?: string[];
};

type UrlBuilder = {
	getUserAvatarURL?: (user: User, canAnimate?: boolean) => string | null;
	getGuildMemberAvatarURLSimple?: (options: {
		userId: string;
		avatar: string;
		guildId: string;
		canAnimate?: boolean;
	}) => string | null;
	getUserBannerURL?: (user: User, canAnimate?: boolean) => string | null;
	getGuildIconURL?: (options: {
		id: string;
		icon: string;
		canAnimate?: boolean;
	}) => string | null;
	getGuildBannerURL?: (
		guild: Guild | { id: string; banner: string },
		canAnimate?: boolean,
	) => string | null;
	getChannelIconURL?: (channel: Channel) => string | null;
};

type ImageTarget = {
	label: string;
	url: string;
	width: number;
	height: number;
};

type MenuItem = {
	label?: string;
	action?: () => void;
	[key: string]: unknown;
};

type ContextMenu = {
	items?: MenuItem[];
	key?: string;
	user?: User;
	userId?: string;
	guild?: Guild;
	guildId?: string;
	channel?: Channel;
	context?: Record<string, unknown>;
	[key: string]: unknown;
};

type SheetHost = {
	hideActionSheet?: (key?: string) => void;
	openLazy?: (
		component: Promise<{ default?: unknown }>,
		key: string,
		props?: object,
		options?: object,
	) => void;
};

type ComponentFunction = ((...args: unknown[]) => unknown) & {
	displayName?: string;
	name?: string;
};

type ComponentObject = {
	displayName?: string;
	name?: string;
	type?: ComponentFunction;
	render?: ComponentFunction;
};

type Element = {
	key?: unknown;
	props?: { children?: unknown; [key: string]: unknown };
	type?: string | ComponentObject | ComponentFunction;
};

type Store = {
	getUser?: (id: string) => User | null;
	getUserProfile?: (id: string) => User | null;
	getGuildMemberProfile?: (userId: string, guildId?: string) => User | null;
	getGuild?: (id: string) => Guild | null;
	getChannel?: (id: string) => Channel | null;
	getMember?: (guildId: string, userId: string) => { avatar?: string | null } | null;
};

let profileUserId: string | null = null;
let profileGuildId: string | null = null;
let actionSheetGuild: Guild | null = null;
let contextMenuTimer: ReturnType<typeof setInterval> | null = null;
let contextMenuPatched = false;
let profileSheetPatched = false;
let patchedSheetInstances = new WeakSet<object>();
let patchedSheetComponents = new WeakSet<object>();
let patchedSheetElements = new WeakSet<object>();
let lifecycle = 0;

function getUrlBuilder(): UrlBuilder | null {
	return metro.findByProps('getUserAvatarURL', 'getGuildIconURL') as UrlBuilder | null;
}

function getStore(name: string): Store | null {
	return metro.findStore(name) as Store | null;
}

function makeTarget(
	label: string,
	url: string | null | undefined,
	width: number,
	height: number,
): ImageTarget | null {
	return url ? { label, url, width, height } : null;
}

function getUserTargets(userId: string, guildId?: string): ImageTarget[] {
	const users = getStore('User');
	const members = getStore('GuildMember');
	const user = users?.getUser?.(userId);
	const profiles = getStore('UserProfile');
	const builder = getUrlBuilder();
	if (!user || !builder) return [];

	const profile = guildId
		? (profiles?.getGuildMemberProfile?.(userId, guildId) ?? profiles?.getUserProfile?.(userId))
		: profiles?.getUserProfile?.(userId);
	const targetUser = profile ? { ...user, ...profile } : user;
	const targets: ImageTarget[] = [];
	const avatar = builder.getUserAvatarURL?.(targetUser, true);
	const banner = builder.getUserBannerURL?.(targetUser, true);
	const memberAvatar = guildId ? members?.getMember?.(guildId, userId)?.avatar : null;
	const serverAvatar =
		guildId && memberAvatar
			? builder.getGuildMemberAvatarURLSimple?.({
					userId,
					avatar: memberAvatar,
					guildId,
					canAnimate: true,
				})
			: null;

	const userAvatarTarget = makeTarget('Avatar', avatar, DEFAULT_AVATAR_SIZE, DEFAULT_AVATAR_SIZE);
	const userBannerTarget = makeTarget(
		'Banner',
		banner,
		DEFAULT_BANNER_WIDTH,
		DEFAULT_BANNER_HEIGHT,
	);
	const serverAvatarTarget = makeTarget(
		'Server Avatar',
		serverAvatar,
		DEFAULT_AVATAR_SIZE,
		DEFAULT_AVATAR_SIZE,
	);
	if (userAvatarTarget) targets.push(userAvatarTarget);
	if (userBannerTarget) targets.push(userBannerTarget);
	if (serverAvatarTarget) targets.push(serverAvatarTarget);
	return targets;
}

function getGuildTargets(guild: Guild): ImageTarget[] {
	const builder = getUrlBuilder();
	if (!builder) return [];

	const icon = guild.icon
		? builder.getGuildIconURL?.({ id: guild.id, icon: guild.icon, canAnimate: true })
		: null;
	const banner = guild.banner ? builder.getGuildBannerURL?.(guild, true) : null;
	const targets: ImageTarget[] = [];
	const iconTarget = makeTarget('Server Icon', icon, DEFAULT_AVATAR_SIZE, DEFAULT_AVATAR_SIZE);
	const bannerTarget = makeTarget(
		'Server Banner',
		banner,
		DEFAULT_BANNER_WIDTH,
		DEFAULT_BANNER_HEIGHT,
	);
	if (iconTarget) targets.push(iconTarget);
	if (bannerTarget) targets.push(bannerTarget);
	return targets;
}

function getChannelTargets(channel: Channel): ImageTarget[] {
	const builder = getUrlBuilder();
	const icon = channel.icon && builder?.getChannelIconURL?.(channel);
	const target = makeTarget('Group DM Icon', icon, DEFAULT_AVATAR_SIZE, DEFAULT_AVATAR_SIZE);
	return target ? [target] : [];
}

function normalizeImageUrl(source: string, size: number): string {
	if (source.startsWith('data:')) return source;

	const url = new URL(source, 'https://discord.com');
	const animated =
		url.searchParams.get('animated') === 'true' ||
		/\/a_[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname);
	const format = animated ? 'gif' : 'webp';
	url.searchParams.set('size', String(size));
	url.pathname = url.pathname.replace(/\.(?:png|jpe?g|webp|gif)$/i, `.${format}`);
	return url.toString();
}

function showMessage(content: string): void {
	toasts.showToast({ title: 'View Icons', content });
}

function ViewIcon() {
	const SVG = metro.common.SVG;
	return (
		<SVG.Svg width={20} height={20} viewBox='0 0 24 24'>
			<SVG.Path
				fill='#f2f3f5'
				d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V5h14v14ZM8.5 13.5 11 16.51 14.5 12 19 18H5l3.5-4.5ZM8 10.5A1.5 1.5 0 1 0 8 7.5a1.5 1.5 0 0 0 0 3Z'
			/>
		</SVG.Svg>
	);
}

function openImage(target: ImageTarget): void {
	const media = metro.findByProps('openMediaModal') as {
		openMediaModal?: (options: Record<string, unknown>) => void;
	} | null;
	if (typeof media?.openMediaModal !== 'function') {
		showMessage('The image viewer is unavailable.');
		return;
	}

	const uri = normalizeImageUrl(target.url, IMAGE_SIZE);
	const open = (width: number, height: number) => {
		try {
			media.openMediaModal?.({
				initialIndex: 0,
				initialSources: [{ uri, sourceURI: uri, width, height }],
			});
		} catch {
			showMessage(`Unable to open ${target.label.toLowerCase()}.`);
		}
	};

	const image = metro.common.ReactNative.Image;
	if (typeof image?.getSize !== 'function') {
		open(target.width, target.height);
		return;
	}

	try {
		image.getSize(uri, open, () => open(target.width, target.height));
	} catch {
		open(target.width, target.height);
	}
}

function addTargetActions(menu: ContextMenu, target: ImageTarget, hide: () => void): void {
	if (!Array.isArray(menu.items)) return;
	const viewLabel = `View ${target.label}`;
	if (!menu.items.some((item) => item.label === viewLabel)) {
		menu.items.push({
			label: viewLabel,
			IconComponent: ViewIcon,
			action: () => {
				hide();
				openImage(target);
			},
		});
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

function typeName(element: Element | null): string | undefined {
	if (typeof element?.type === 'string') return element.type;
	const type = element?.type;
	if (typeof type === 'function') return type.displayName ?? type.name;
	return (
		type?.displayName ??
		type?.name ??
		type?.render?.displayName ??
		type?.render?.name ??
		type?.type?.displayName ??
		type?.type?.name
	);
}

function findElement(
	node: unknown,
	predicate: (element: Element) => boolean,
	depth = 0,
): Element | null {
	if (depth > 15 || !node || typeof node !== 'object') return null;
	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate, depth + 1);
			if (match) return match;
		}
		return null;
	}
	const element = node as Element;
	if (predicate(element)) return element;
	return findElement(element.props?.children, predicate, depth + 1);
}

function resolveContextTargets(menu: ContextMenu): ImageTarget[] {
	const context = menu.context ?? {};
	const key = stringValue(menu.key);
	const guildId = stringValue(menu.guildId) ?? stringValue(context.guildId) ?? profileGuildId;
	const explicitUserId = stringValue(menu.userId) ?? stringValue(context.userId);
	const guild =
		menu.guild ?? (key ? (getStore('Guild')?.getGuild?.(key) ?? undefined) : undefined);
	if (guild) return getGuildTargets(guild);
	const user =
		menu.user ??
		(explicitUserId ? getStore('User')?.getUser?.(explicitUserId) : undefined) ??
		(key ? (getStore('User')?.getUser?.(key) ?? undefined) : undefined);
	if (user) return getUserTargets(user.id, guildId ?? undefined);
	const channel =
		menu.channel ?? (key ? (getStore('Channel')?.getChannel?.(key) ?? undefined) : undefined);
	if (channel?.icon) return getChannelTargets(channel);
	const isProfileMenu = menu.items?.some((item) =>
		/^(View (?:Main )?Profile|Message)$/.test(item.label ?? ''),
	);
	const isUserActionMenu = menu.items?.some((item) =>
		/^(Change Friend Nickname|Copy Username|Copy User ID|Report User Profile)$/.test(
			item.label ?? '',
		),
	);
	if (profileUserId && (isProfileMenu || isUserActionMenu))
		return getUserTargets(profileUserId, guildId ?? undefined);
	return [];
}

function patchContextMenus(): boolean {
	if (contextMenuPatched) return true;
	const contextMenus = metro.findByProps('showContextMenu', 'hideContextMenu') as {
		showContextMenu: (menu: ContextMenu) => void;
		hideContextMenu?: () => void;
	} | null;
	if (typeof contextMenus?.showContextMenu !== 'function') return false;

	PATCHER.before(contextMenus, 'showContextMenu', (ctx) => {
		const menu = ctx.args[0] as ContextMenu | undefined;
		if (!menu || !Array.isArray(menu.items)) return;
		try {
			const targets = resolveContextTargets(menu);
			for (const target of targets)
				addTargetActions(menu, target, () => contextMenus.hideContextMenu?.());
		} catch {}
	});
	contextMenuPatched = true;
	return true;
}

function getActionSheetTargets(): ImageTarget[] {
	if (actionSheetGuild) return getGuildTargets(actionSheetGuild);
	if (profileUserId) return getUserTargets(profileUserId, profileGuildId ?? undefined);
	return [];
}

function addActionSheetRows(
	result: unknown,
	sheets: SheetHost,
	ActionSheetRow: unknown,
	sheetKey: string,
): unknown {
	const group = findElement(result, (element) => typeName(element) === 'ActionSheetRowGroup');
	const rows = group?.props?.children;
	if (!group?.props || !Array.isArray(rows)) return result;

	const targets = getActionSheetTargets();
	const iconId = assets.getIDByName('ImageIcon');
	const rowsToAdd: unknown[] = [];
	for (const target of targets) {
		const label = `View ${target.label}`;
		const key = `unbound-view-icons-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
		if (rows.some((row) => (row as Element)?.key === key)) continue;
		rowsToAdd.push(
			metro.common.React.createElement(ActionSheetRow as never, {
				key,
				label,
				icon:
					iconId != null &&
					typeof (ActionSheetRow as { Icon?: unknown }).Icon === 'function'
						? metro.common.React.createElement(
								(ActionSheetRow as { Icon: unknown }).Icon as never,
								{ source: iconId },
							)
						: undefined,
				onPress: () => {
					sheets.hideActionSheet?.(sheetKey);
					openImage(target);
				},
			}),
		);
	}
	if (rowsToAdd.length) rows.splice(1, 0, ...rowsToAdd);
	return result;
}

function patchNestedActionSheetComponents(
	node: unknown,
	sheets: SheetHost,
	ActionSheetRow: unknown,
	sheetKey: string,
	depth: number,
): void {
	if (depth >= 15 || !node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node)
			patchNestedActionSheetComponents(child, sheets, ActionSheetRow, sheetKey, depth + 1);
		return;
	}

	const element = node as Element;
	const component = element.type;
	const componentLabel = typeName(element);
	const shouldPatch =
		componentLabel === 'GuildActionSheetSecondaryActions' ||
		componentLabel === 'UserProfileActionSheetActions';
	if (shouldPatch && typeof component === 'function') {
		if (!patchedSheetElements.has(element as object)) {
			patchedSheetElements.add(element as object);
			element.type = (...args: unknown[]) =>
				patchActionSheetComponent(
					component(...args),
					sheets,
					ActionSheetRow,
					sheetKey,
					depth + 1,
				);
		}
	} else if (shouldPatch && component && typeof component === 'object') {
		const componentObject = component as ComponentObject;
		const wrappedType =
			typeof componentObject.type === 'function'
				? { holder: componentObject, method: 'type' as const }
				: null;
		const renderHolder =
			typeof componentObject.render === 'function'
				? { holder: componentObject, method: 'render' as const }
				: null;
		const target = wrappedType ?? renderHolder;
		if (target && !patchedSheetComponents.has(target.holder as object)) {
			patchedSheetComponents.add(target.holder as object);
			PATCHER.after(target.holder as never, target.method as never, ({ result }) =>
				patchActionSheetComponent(result, sheets, ActionSheetRow, sheetKey, depth + 1),
			);
		}
	}

	patchNestedActionSheetComponents(
		element.props?.children,
		sheets,
		ActionSheetRow,
		sheetKey,
		depth + 1,
	);
}

function patchActionSheetComponent(
	result: unknown,
	sheets: SheetHost,
	ActionSheetRow: unknown,
	sheetKey: string,
	depth = 0,
): unknown {
	const patchedResult = addActionSheetRows(result, sheets, ActionSheetRow, sheetKey);
	patchNestedActionSheetComponents(patchedResult, sheets, ActionSheetRow, sheetKey, depth);
	return patchedResult;
}

function patchActionSheets(): boolean {
	if (profileSheetPatched) return true;
	const activeLifecycle = lifecycle;
	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as SheetHost | null;
	const ActionSheetRow = (
		metro.findByProps('ActionSheetRow') as { ActionSheetRow?: unknown } | null
	)?.ActionSheetRow;
	if (typeof sheets?.openLazy !== 'function' || !ActionSheetRow) return false;

	PATCHER.before(sheets as never, 'openLazy' as never, (ctx) => {
		const [componentPromise, key, props] = ctx.args as [
			Promise<{ default?: unknown }> | undefined,
			unknown,
			Record<string, unknown> | undefined,
		];
		if (typeof key !== 'string' || !componentPromise?.then || !props) return;
		const isProfileSheet = /^UserProfile/i.test(key) && Boolean(props.userId);
		const isGuildSheet =
			/^GuildActionSheet:/i.test(key) && props.guild && typeof props.guild === 'object';
		if (!isProfileSheet && !isGuildSheet) return;
		profileUserId = isProfileSheet ? (stringValue(props.userId) ?? null) : null;
		profileGuildId = isProfileSheet ? (stringValue(props.guildId) ?? null) : null;
		actionSheetGuild = isGuildSheet ? (props.guild as Guild) : null;
		componentPromise
			.then((instance) => {
				if (activeLifecycle !== lifecycle) return;
				if (!instance || patchedSheetInstances.has(instance)) return;
				patchedSheetInstances.add(instance);
				const defaultExport = instance.default;
				if (typeof defaultExport === 'function') {
					PATCHER.after(
						instance as { default: (...args: unknown[]) => unknown },
						'default',
						({ result }) =>
							patchActionSheetComponent(result, sheets, ActionSheetRow, key),
					);
					return;
				}
				if (
					defaultExport &&
					typeof defaultExport === 'object' &&
					typeof (defaultExport as ComponentObject).type === 'function'
				) {
					PATCHER.after(defaultExport as never, 'type' as never, ({ result }) =>
						patchActionSheetComponent(result, sheets, ActionSheetRow, key),
					);
					return;
				}
				if (
					defaultExport &&
					typeof defaultExport === 'object' &&
					typeof (defaultExport as ComponentObject).render === 'function'
				) {
					PATCHER.after(defaultExport as never, 'render' as never, ({ result }) =>
						patchActionSheetComponent(result, sheets, ActionSheetRow, key),
					);
				}
			})
			.catch(() => undefined);
	});
	profileSheetPatched = true;
	return true;
}

export default {
	start() {
		lifecycle++;
		if (!patchContextMenus() || !patchActionSheets()) {
			contextMenuTimer = setInterval(() => {
				if (!patchContextMenus() || !patchActionSheets() || !contextMenuTimer) return;
				clearInterval(contextMenuTimer);
				contextMenuTimer = null;
			}, 1000);
		}
	},
	stop() {
		lifecycle++;
		PATCHER.unpatchAll();
		if (contextMenuTimer) clearInterval(contextMenuTimer);
		contextMenuTimer = null;
		contextMenuPatched = false;
		profileSheetPatched = false;
		profileUserId = null;
		profileGuildId = null;
		actionSheetGuild = null;
		patchedSheetInstances = new WeakSet<object>();
		patchedSheetComponents = new WeakSet<object>();
		patchedSheetElements = new WeakSet<object>();
	},
};
