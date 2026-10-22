import { metro, patcher, toasts } from '@unbound-app/api';

const PATCHER = patcher.createPatcher('unbound.view-raw');
const ROW_KEY = 'unbound-view-raw';
const SHEET_PREFIX = 'unbound-view-raw-';

type Message = {
	attachments?: Array<Record<string, unknown>>;
	author?: Record<string, unknown>;
	content?: string;
	id?: string;
	[key: string]: unknown;
};

type RawItem = {
	content?: string;
	data: Record<string, unknown>;
	type: string;
};

type Element = {
	key?: unknown;
	props?: { children?: unknown; [key: string]: unknown };
	type?: string | { displayName?: string; name?: string };
} | null;

type SheetHost = {
	hideActionSheet?: (key: string) => void;
	openLazy?: (
		component: Promise<{ default: unknown }>,
		key: string,
		props?: object,
		options?: object,
	) => void;
};

let patchedInstances = new WeakSet<object>();
let patchedComponents = new WeakSet<object>();
const unpatches: Array<() => void> = [];
let currentItem: RawItem | null = null;
let currentSheetKey: string | null = null;
let currentProfileUserId: string | null = null;
let contextMenuPatched = false;
let contextMenuTimer: ReturnType<typeof setInterval> | null = null;
let lifecycle = 0;

function typeName(element: Element): string | undefined {
	if (typeof element?.type === 'string') return element.type;
	return element?.type?.displayName ?? element?.type?.name;
}

function findElement(node: unknown, predicate: (element: Element) => boolean, depth = 0): Element {
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
	return findElement(element?.props?.children, predicate, depth + 1);
}

function sortObject(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortObject);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => [key, sortObject(item)]),
	);
}

function cleanMessage(message: Message): Message {
	const clone = JSON.parse(JSON.stringify(message)) as Message;
	const author = clone.author;
	if (author) {
		delete author.email;
		delete author.phone;
		delete author.mfaEnabled;
		delete author.personalConnectionId;
	}
	delete clone.editHistory;
	delete clone.deleted;
	delete clone.firstEditTimestamp;
	for (const attachment of clone.attachments ?? []) delete attachment.deleted;
	return sortObject(clone) as Message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isActionSheetRowGroup(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const element = value as Element;
	if (typeName(element) === 'ActionSheetRowGroup') return true;
	const props = element?.props;
	if (typeof props?.hasIcons !== 'boolean' || !Array.isArray(props.children)) return false;
	return (
		props.children.length > 0 &&
		props.children.every(
			(row) =>
				isRecord(row) &&
				isRecord(row.props) &&
				typeof row.props.label === 'string' &&
				typeof row.props.onPress === 'function',
		)
	);
}

function supportsRawSheet(key: string): boolean {
	return (
		/MessageLongPressActionSheet$/i.test(key) ||
		/^UserProfile/i.test(key) ||
		/^GuildActionSheet:/i.test(key) ||
		/Channel(?:LongPress)?ActionSheet/i.test(key)
	);
}

function getRawItem(key: string, props: Record<string, unknown>): RawItem | null {
	if (!supportsRawSheet(key)) return null;
	if (isRecord(props.message)) {
		const message = props.message as Message;
		return {
			content: typeof message.content === 'string' ? message.content : '',
			data: cleanMessage(message),
			type: 'Message',
		};
	}
	if (isRecord(props.profile))
		return { data: sortObject(props.profile) as Record<string, unknown>, type: 'Profile' };
	if (isRecord(props.channel))
		return { data: sortObject(props.channel) as Record<string, unknown>, type: 'Channel' };
	if (isRecord(props.guild))
		return { data: sortObject(props.guild) as Record<string, unknown>, type: 'Guild' };
	const channelId = typeof props.channelId === 'string' ? props.channelId : undefined;
	const channels = metro.findStore('Channel') as {
		getChannel?: (id: string) => Record<string, unknown> | undefined;
	} | null;
	const channel = channelId ? channels?.getChannel?.(channelId) : undefined;
	if (channel) return { data: sortObject(channel), type: 'Channel' };
	const guildId = typeof props.guildId === 'string' ? props.guildId : undefined;
	const users = metro.findStore('User') as {
		getUser?: (id: string) => Record<string, unknown> | undefined;
	} | null;
	const userId =
		typeof props.userId === 'string'
			? props.userId
			: isRecord(props.user) && typeof props.user.id === 'string'
				? props.user.id
				: undefined;
	const user = isRecord(props.user) ? props.user : userId ? users?.getUser?.(userId) : undefined;
	if (!user) return null;
	if (!/profile/i.test(key)) return { data: sortObject(user), type: 'User' };
	const profiles = metro.findStore('UserProfile') as {
		getGuildMemberProfile?: (
			userId: string,
			guildId?: string,
		) => Record<string, unknown> | undefined;
		getUserProfile?: (userId: string) => Record<string, unknown> | undefined;
	} | null;
	const profile = userId
		? (profiles?.getGuildMemberProfile?.(userId, guildId) ?? profiles?.getUserProfile?.(userId))
		: undefined;
	return profile
		? { data: sortObject(profile), type: 'Profile' }
		: { data: sortObject(user), type: 'User' };
}

function copy(value: string, label: string): void {
	const clipboard = metro.common.Clipboard as
		| { setString?: (text: string) => Promise<void> | void }
		| undefined;
	if (typeof clipboard?.setString !== 'function') {
		toasts.showToast({ title: 'View Raw', content: 'Clipboard access is unavailable.' });
		return;
	}
	void Promise.resolve(clipboard.setString(value)).then(() =>
		toasts.showToast({ title: 'View Raw', content: `${label} copied to clipboard.` }),
	);
}

function RawIcon() {
	const SVG = metro.common.SVG;
	return (
		<SVG.Svg width={20} height={20} viewBox='0 0 20 20'>
			<SVG.Path
				fill='#f2f3f5'
				d='M12.9297 3.25007C12.7343 3.05261 12.4154 3.05226 12.2196 3.24928L11.5746 3.89824C11.3811 4.09297 11.3808 4.40733 11.5739 4.60245L16.5685 9.64824C16.7614 9.84309 16.7614 10.1569 16.5685 10.3517L11.5739 15.3975C11.3808 15.5927 11.3811 15.907 11.5746 16.1017L12.2196 16.7507C12.4154 16.9477 12.7343 16.9474 12.9297 16.7499L19.2604 10.3517C19.4532 10.1568 19.4532 9.84314 19.2604 9.64832L12.9297 3.25007Z'
			/>
			<SVG.Path
				fill='#f2f3f5'
				d='M8.42616 4.60245C8.6193 4.40733 8.61898 4.09297 8.42545 3.89824L7.78047 3.24928C7.58466 3.05226 7.26578 3.05261 7.07041 3.25007L0.739669 9.64832C0.5469 9.84314 0.546901 10.1568 0.739669 10.3517L7.07041 16.7499C7.26578 16.9474 7.58465 16.9477 7.78047 16.7507L8.42545 16.1017C8.61898 15.907 8.6193 15.5927 8.42616 15.3975L3.43155 10.3517C3.23869 10.1569 3.23869 9.84309 3.43155 9.64824L8.42616 4.60245Z'
			/>
		</SVG.Svg>
	);
}

function RawSheet({
	content,
	json,
	onClose,
	type,
}: {
	content: string;
	json: string;
	onClose: () => void;
	type: string;
}) {
	const ReactNative = metro.common.ReactNative;
	const Discord = metro.findByProps('ActionSheet', 'Button', 'Text') as {
		ActionSheet?: any;
		Button?: any;
		Text?: any;
	} | null;
	if (!Discord?.ActionSheet || !Discord?.Button || !Discord?.Text) return <ReactNative.View />;
	const action = (label: string, onPress: () => void) => (
		<ReactNative.Pressable
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				alignItems: 'center',
				backgroundColor: pressed ? '#4752c4' : '#5865f2',
				borderRadius: 9,
				flex: 1,
				justifyContent: 'center',
				minHeight: 34,
				paddingHorizontal: 6,
			})}
		>
			<ReactNative.Text
				numberOfLines={1}
				style={{ color: '#f2f3f5', fontSize: 12, fontWeight: '700' }}
			>
				{label}
			</ReactNative.Text>
		</ReactNative.Pressable>
	);
	return (
		<Discord.ActionSheet startExpanded>
			<ReactNative.View
				style={{
					maxHeight: '85%',
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 18,
				}}
			>
				<Discord.Text variant='text-lg/semibold'>{`Raw ${type} Data`}</Discord.Text>
				{content ? (
					<Discord.Text style={{ marginTop: 16 }} variant='text-sm/semibold'>
						Message Content
					</Discord.Text>
				) : null}
				{content ? (
					<ReactNative.TextInput
						multiline
						scrollEnabled
						selectTextOnFocus
						showSoftInputOnFocus={false}
						style={{
							backgroundColor: '#1e1f22',
							borderRadius: 8,
							color: '#dbdee1',
							fontFamily: 'Menlo',
							fontSize: 13,
							height: 96,
							marginTop: 6,
							padding: 12,
							textAlignVertical: 'top',
						}}
						value={content}
					/>
				) : null}
				{content ? (
					<Discord.Text style={{ marginTop: 16 }} variant='text-sm/semibold'>
						Message Data
					</Discord.Text>
				) : null}
				<ReactNative.TextInput
					multiline
					scrollEnabled
					selectTextOnFocus
					showSoftInputOnFocus={false}
					style={{
						backgroundColor: '#1e1f22',
						borderRadius: 8,
						color: '#dbdee1',
						fontFamily: 'Menlo',
						fontSize: 12,
						marginTop: content ? 6 : 16,
						maxHeight: 480,
						padding: 12,
						textAlignVertical: 'top',
					}}
					value={json}
				/>
				<ReactNative.View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
					{action('Copy data', () => copy(json, `${type} data`))}
					{content ? action('Copy content', () => copy(content, 'Raw content')) : null}
					{action('Close', onClose)}
				</ReactNative.View>
			</ReactNative.View>
		</Discord.ActionSheet>
	);
}

function openRawSheet(item: RawItem): void {
	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as SheetHost | null;
	if (!sheets?.openLazy) return;
	const key = `${SHEET_PREFIX}${Date.now()}`;
	const json = JSON.stringify(item.data, null, 4);
	sheets.openLazy(
		Promise.resolve({
			default: () => (
				<RawSheet
					content={item.content ?? ''}
					json={json}
					onClose={() => sheets.hideActionSheet?.(key)}
					type={item.type}
				/>
			),
		}),
		key,
		{ onClose: () => sheets.hideActionSheet?.(key) },
		{ initialSnapIndex: 1 },
	);
}

function addMessageRow(result: unknown, sheets: SheetHost, ActionSheetRow: any): unknown {
	const item = currentItem;
	const key = currentSheetKey;
	if (!item || !key) return result;
	const group = findElement(result, isActionSheetRowGroup);
	const rows = group?.props?.children;
	if (
		!group?.props ||
		!Array.isArray(rows) ||
		rows.some((row) => (row as Element)?.key === ROW_KEY)
	)
		return result;
	const row = metro.common.React.createElement(ActionSheetRow, {
		key: ROW_KEY,
		label: 'View Raw',
		icon: <RawIcon />,
		onPress: () => {
			sheets.hideActionSheet?.(key);
			openRawSheet(item);
		},
	});
	rows.splice(1, 0, row);
	return result;
}

function addContextMenuItem(
	menu: { items?: Array<Record<string, unknown>> },
	item: RawItem,
	close: () => void,
	showIcon = true,
): void {
	if (!Array.isArray(menu.items) || menu.items.some((entry) => entry.label === 'View Raw'))
		return;
	const entry: Record<string, unknown> = {
		label: 'View Raw',
		action: () => {
			close();
			openRawSheet(item);
		},
	};
	if (showIcon) entry.IconComponent = RawIcon;
	menu.items.push(entry);
}

function patchSheetComponent(
	result: unknown,
	sheets: SheetHost,
	ActionSheetRow: any,
	depth = 0,
	activeLifecycle = lifecycle,
): unknown {
	const patchedResult = addMessageRow(result, sheets, ActionSheetRow);
	if (activeLifecycle !== lifecycle) return patchedResult;
	if (depth >= 15 || !isRecord(patchedResult)) return patchedResult;
	const directHolder =
		typeof patchedResult.type === 'function'
			? { holder: patchedResult, method: 'type' as const }
			: null;
	const wrappedType = isRecord(patchedResult.type) ? patchedResult.type : null;
	const wrappedHolder =
		typeof wrappedType?.type === 'function'
			? { holder: wrappedType, method: 'type' as const }
			: null;
	const renderHolder =
		typeof wrappedType?.render === 'function'
			? { holder: wrappedType, method: 'render' as const }
			: null;
	const target = directHolder ?? wrappedHolder ?? renderHolder;
	if (!target || patchedComponents.has(target.holder)) return patchedResult;
	patchedComponents.add(target.holder);
	unpatches.push(
		PATCHER.after(
			target.holder as {
				type?: (...args: unknown[]) => unknown;
				render?: (...args: unknown[]) => unknown;
			},
			target.method,
			(ctx) => {
				if (activeLifecycle !== lifecycle) return ctx.result;
				return patchSheetComponent(
					ctx.result,
					sheets,
					ActionSheetRow,
					depth + 1,
					activeLifecycle,
				);
			},
		),
	);
	return patchedResult;
}

function patchContextMenus(): boolean {
	if (contextMenuPatched) return true;
	const contextMenus = metro.findByProps('showContextMenu', 'hideContextMenu') as {
		hideContextMenu?: () => void;
		showContextMenu?: (menu: { items?: Array<Record<string, unknown>>; key?: string }) => void;
	} | null;
	if (!contextMenus?.showContextMenu) return false;
	unpatches.push(
		PATCHER.before(contextMenus, 'showContextMenu', (ctx) => {
			const menu = ctx.args[0] as
				| { items?: Array<Record<string, unknown>>; key?: string }
				| undefined;
			if (!menu) return;
			const guilds = metro.findByProps('getGuild') as {
				getGuild?: (id: string) => Record<string, unknown> | undefined;
			} | null;
			const guild = typeof menu.key === 'string' ? guilds?.getGuild?.(menu.key) : undefined;
			if (guild) {
				addContextMenuItem(menu, { data: sortObject(guild), type: 'Guild' }, () =>
					contextMenus.hideContextMenu?.(),
				);
				return;
			}
			if (
				!menu.items?.some((item) => item.label === 'View Main Profile') ||
				!currentProfileUserId
			)
				return;
			const profile = getRawItem(`UserProfile${currentProfileUserId}`, {
				userId: currentProfileUserId,
			});
			if (profile)
				addContextMenuItem(menu, profile, () => contextMenus.hideContextMenu?.(), false);
		}),
	);
	contextMenuPatched = true;
	return true;
}

function start(): void {
	const activeLifecycle = ++lifecycle;
	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as SheetHost | null;
	const ActionSheetRow = (metro.findByProps('ActionSheetRow') as { ActionSheetRow?: any } | null)
		?.ActionSheetRow;
	if (!sheets?.openLazy || !ActionSheetRow) return;
	if (!patchContextMenus())
		contextMenuTimer = setInterval(() => {
			if (activeLifecycle !== lifecycle) return;
			if (!patchContextMenus() || !contextMenuTimer) return;
			clearInterval(contextMenuTimer);
			contextMenuTimer = null;
		}, 1000);
	unpatches.push(
		PATCHER.before(sheets, 'openLazy', (ctx) => {
			const [componentPromise, key, props] = ctx.args as [
				Promise<{ default?: unknown }> | undefined,
				unknown,
				Record<string, unknown> | undefined,
			];
			if (typeof key !== 'string' || !componentPromise?.then || !props) return;
			if (key.startsWith('UserProfile') && typeof props.userId === 'string')
				currentProfileUserId = props.userId;
			currentItem = null;
			currentSheetKey = null;
			const item = getRawItem(key, props);
			if (!item) return;
			currentItem = item;
			currentSheetKey = key;
			componentPromise
				.then((instance) => {
					if (activeLifecycle !== lifecycle) return;
					if (!instance || patchedInstances.has(instance)) return;
					patchedInstances.add(instance);
					unpatches.push(
						PATCHER.after(instance, 'default', ({ result }) =>
							patchSheetComponent(result, sheets, ActionSheetRow, 0, activeLifecycle),
						),
					);
				})
				.catch(() => undefined);
		}),
	);
}

export default {
	start,
	stop() {
		lifecycle++;
		for (const unpatch of unpatches.splice(0)) {
			try {
				unpatch();
			} catch {}
		}
		if (contextMenuTimer) clearInterval(contextMenuTimer);
		currentItem = null;
		currentSheetKey = null;
		currentProfileUserId = null;
		contextMenuPatched = false;
		contextMenuTimer = null;
		patchedInstances = new WeakSet<object>();
		patchedComponents = new WeakSet<object>();
	},
};
