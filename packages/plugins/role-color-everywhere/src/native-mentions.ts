import { getRoleColorAppearance, roleColorAt, type RoleColorStops } from '@shared/role-colors';
import { metro } from '@unbound-app/api';
import type { NativeHookToken, NativeObjCBridge } from '@unbound-app/api/native';

type NativeValue = any;

interface Member {
	nick?: string | null;
	colorString?: string | null;
	colorStrings?: RoleColorStops | null;
}

interface Message {
	authorId?: string;
	channelId?: string;
	content?: string;
	guildId?: string;
	id?: string;
}

interface Mention {
	colors: string[];
	labels: string[];
	userId: string;
}

interface TextViewState {
	applied: NativeValue;
	messageId: string;
	original: NativeValue;
	view: NativeValue;
}

interface MemberStore {
	getMember(guildId: string, userId: string): Member | null | undefined;
}

interface MessageStore {
	getMessage(channelId: string, messageId: string): Message | null | undefined;
}

interface ChannelStore {
	getChannel(channelId: string): { guild_id?: string } | null | undefined;
}

interface UserStore {
	getUser(userId: string): { globalName?: string | null; username?: string } | null | undefined;
}

interface SelectedChannelStore {
	addChangeListener?(listener: () => void): void;
	getChannelId(): string | undefined;
	removeChangeListener?(listener: () => void): void;
}

const MAX_SCAN_NODES = 1_600;
const MAX_SCAN_DEPTH = 40;
const MAX_TEXT_VIEWS = 80;
const MAX_TEXT_VIEW_DEPTH = 12;
const SCAN_DELAYS = [0, 100, 500, 1_500, 3_000];

function selectMentionLabel(text: string, labels: string[]): string | undefined {
	const at = text.indexOf('@');
	if (at < 0) return;
	return [...labels]
		.sort((a, b) => b.length - a.length)
		.find((label) => {
			const prefix = `@${label}`;
			if (!text.slice(at).startsWith(prefix)) return false;
			const next = text[at + prefix.length];
			return !next || next === '\u2068' || next === '\u2069' || /\s/u.test(next);
		});
}

function hexChannels(hex: string): [number, number, number] | null {
	if (!/^#[\da-f]{6}$/i.test(hex)) return null;
	return [
		Number.parseInt(hex.slice(1, 3), 16) / 255,
		Number.parseInt(hex.slice(3, 5), 16) / 255,
		Number.parseInt(hex.slice(5, 7), 16) / 255,
	];
}

export function installNativeMentionColors(
	bridge: NativeObjCBridge,
	members: MemberStore,
	enabled: () => boolean,
): () => Promise<void> {
	const messageStore = metro.findStore('Message') as MessageStore | null;
	const channelStore = metro.findStore('Channel') as ChannelStore | null;
	const userStore = metro.findStore('User') as UserStore | null;
	const selectedStore = metro.findByProps(
		'getChannelId',
		'getLastSelectedChannelId',
	) as SelectedChannelStore | null;
	if (!messageStore || !channelStore || !userStore || !selectedStore)
		return async () => undefined;
	const messages = messageStore;
	const channels = channelStore;
	const users = userStore;
	const selected = selectedStore;

	const hooks: NativeHookToken[] = [];
	const textViews = new Map<string, TextViewState>();
	const pendingCells = new Set<string>();
	const dirtyCells = new Set<string>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const colors = new Map<string, NativeValue>();
	const cellTextViews = new Map<string, Set<string>>();
	const cellRevisions = new Map<string, number>();
	let currentChannelId = selected.getChannelId();
	let channelRevision = 0;
	let stopped = false;

	function call(handle: NativeValue, selector: string, ...args: NativeValue[]): NativeValue {
		if (!handle) return null;
		try {
			return bridge.call(handle, selector, ...args);
		} catch {
			return null;
		}
	}

	async function callMain(
		handle: NativeValue,
		selector: string,
		...args: NativeValue[]
	): Promise<NativeValue> {
		if (!handle) return null;
		try {
			return await bridge.invokeAsync(handle, selector, args);
		} catch {
			return null;
		}
	}

	function keyFor(handle: NativeValue): string | undefined {
		const name = bridge.className(handle);
		const hash = call(handle, 'hash');
		return name && hash != null ? `${name}:${String(hash)}` : undefined;
	}

	function messageIdForCell(cell: NativeValue): string | undefined {
		const viewModel = bridge.getIvar(cell, 'viewModel');
		const message = call(viewModel, 'message');
		const identifier = call(message, 'id');
		if (typeof identifier === 'string') return identifier;
		const description = call(identifier, 'description');
		return typeof description === 'string' ? description : undefined;
	}

	function mentionsFor(message: Message, guildId: string): Mention[] {
		if (typeof message.content !== 'string') return [];
		const result: Mention[] = [];
		for (const match of message.content.matchAll(/<@!?([0-9]+)>/g)) {
			const userId = match[1];
			const member = members.getMember(guildId, userId);
			const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);
			if (!appearance.colors.length) continue;
			const user = users.getUser(userId);
			const labels = [member?.nick, user?.globalName, user?.username].filter(
				(value): value is string => typeof value === 'string' && value.length > 0,
			);
			if (labels.length) result.push({ colors: appearance.colors, labels, userId });
		}
		return result;
	}

	async function colorFor(hex: string): Promise<NativeValue> {
		const cached = colors.get(hex);
		if (cached) return cached;
		const channels = hexChannels(hex);
		if (!channels) return null;
		const color = await callMain(
			bridge.getClass('UIColor'),
			'colorWithRed:green:blue:alpha:',
			...channels,
			1,
		);
		if (colors.size >= 256) colors.clear();
		if (color) colors.set(hex, color);
		return color;
	}

	async function colorMention(
		attributed: NativeValue,
		text: string,
		location: number,
		colors: string[],
	): Promise<void> {
		const characters = colors.length === 1 ? [text] : Array.from(text);
		let position = location;
		for (let index = 0; index < characters.length; index++) {
			const character = characters[index];
			const hex = roleColorAt(
				colors,
				characters.length === 1 ? 0 : index / (characters.length - 1),
			);
			const color = hex ? await colorFor(hex) : null;
			if (color)
				call(
					attributed,
					'addAttribute:value:range:',
					'NSColor',
					color,
					bridge.struct('NSRange', { location: position, length: character.length }),
				);
			position += character.length;
		}
	}

	async function childViews(root: NativeValue): Promise<NativeValue[]> {
		const nodes = await bridge.snapshot(root, {
			maxDepth: MAX_TEXT_VIEW_DEPTH,
			maxNodes: MAX_TEXT_VIEWS,
		});
		return nodes
			.map((node) => node.view)
			.filter(
				(view) =>
					bridge.respondsTo(view, 'attributedText') &&
					bridge.respondsTo(view, 'setAttributedText:'),
			);
	}

	async function restoreView(key: string): Promise<void> {
		const state = textViews.get(key);
		if (!state) return;
		try {
			const current = await callMain(state.view, 'attributedText');
			if (call(current, 'isEqual:', state.applied)) {
				await callMain(state.view, 'setAttributedText:', state.original);
			}
		} finally {
			textViews.delete(key);
		}
	}

	async function updateView(
		cell: NativeValue,
		cellKey: string,
		cellRevision: number,
		channelId: string,
		activeChannelRevision: number,
		view: NativeValue,
		messageId: string,
		mentions: Mention[],
	): Promise<void> {
		const key = keyFor(view);
		if (!key) return;
		const current = await callMain(view, 'attributedText');
		if (!current) return;
		const state = textViews.get(key);
		if (state?.messageId === messageId && call(current, 'isEqual:', state.applied)) return;
		if (state) textViews.delete(key);
		const text = call(current, 'string');
		if (typeof text !== 'string' || !text.includes('@')) return;
		const updated = bridge.alloc('NSMutableAttributedString');
		if (!call(updated, 'initWithAttributedString:', current)) return;
		let offset = 0;
		let changed = false;

		for (const mention of mentions) {
			for (let at = text.indexOf('@', offset); at >= 0; at = text.indexOf('@', at + 1)) {
				const label = selectMentionLabel(text.slice(at), mention.labels);
				if (!label) continue;
				const attributes = call(current, 'attributesAtIndex:effectiveRange:', at, null);
				if (!attributes?.YYTextHighlight) continue;
				const length = label.length + 1;
				await colorMention(updated, text.slice(at, at + length), at, mention.colors);
				offset = at + length;
				changed = true;
				break;
			}
		}

		if (!changed || stopped) return;
		const latest = await callMain(view, 'attributedText');
		if (
			!latest ||
			stopped ||
			!call(latest, 'isEqual:', current) ||
			currentChannelId !== channelId ||
			channelRevision !== activeChannelRevision ||
			(cellRevisions.get(cellKey) ?? 0) !== cellRevision ||
			messageIdForCell(cell) !== messageId
		)
			return;
		textViews.set(key, { applied: updated, messageId, original: current, view });
		let views = cellTextViews.get(cellKey);
		if (!views) {
			views = new Set<string>();
			cellTextViews.set(cellKey, views);
		}
		views.add(key);
		await callMain(view, 'setAttributedText:', updated);
	}

	async function renderCell(cell: NativeValue): Promise<void> {
		if (stopped || !enabled() || !currentChannelId) return;
		const cellKey = keyFor(cell);
		if (!cellKey) return;
		if (!(await callMain(cell, 'window'))) {
			forgetCell(cell);
			return;
		}
		const channelId = currentChannelId;
		const activeChannelRevision = channelRevision;
		const cellRevision = cellRevisions.get(cellKey) ?? 0;
		const messageId = messageIdForCell(cell);
		if (!messageId) return;
		const message = messages.getMessage(channelId, messageId);
		if (!message) return;
		const guildId = message.guildId ?? channels.getChannel(channelId)?.guild_id;
		if (!guildId) return;
		const mentions = mentionsFor(message, guildId);
		if (!mentions.length) return;
		for (const view of await childViews(cell)) {
			await updateView(
				cell,
				cellKey,
				cellRevision,
				channelId,
				activeChannelRevision,
				view,
				messageId,
				mentions,
			);
		}
	}

	function scheduleCell(cell: NativeValue): void {
		if (stopped || !enabled()) return;
		const key = keyFor(cell);
		if (!key) return;
		if (pendingCells.has(key)) {
			dirtyCells.add(key);
			return;
		}
		pendingCells.add(key);
		const timer = setTimeout(() => {
			timers.delete(timer);
			void renderCell(cell)
				.catch((error) => {
					console.error('Role Color Everywhere native mention rendering failed:', error);
				})
				.finally(() => {
					pendingCells.delete(key);
					if (dirtyCells.delete(key) && !stopped) scheduleCell(cell);
				});
		}, 0);
		timers.add(timer);
	}

	function forgetCell(cell: NativeValue): void {
		const cellKey = keyFor(cell);
		if (!cellKey) return;
		cellRevisions.set(cellKey, (cellRevisions.get(cellKey) ?? 0) + 1);
		for (const viewKey of cellTextViews.get(cellKey) ?? []) textViews.delete(viewKey);
		cellTextViews.delete(cellKey);
	}

	async function scanVisible(): Promise<void> {
		if (stopped || !enabled()) return;
		const application = await callMain(bridge.getClass('UIApplication'), 'sharedApplication');
		const windows = await callMain(application, 'windows');
		if (!windows) return;
		const roots = Array.isArray(windows) ? windows : bridge.array(windows);
		for (const root of roots) {
			if (stopped) return;
			const cells = await bridge.findViews(root, 'DCDMessageTableViewCell', {
				maxDepth: MAX_SCAN_DEPTH,
				maxVisited: MAX_SCAN_NODES,
				maxResults: MAX_TEXT_VIEWS,
				attachedOnly: true,
				stopAtMatch: true,
			});
			for (const cell of cells) scheduleCell(cell);
		}
	}

	function scheduleScan(delay: number): void {
		const timer = setTimeout(() => {
			timers.delete(timer);
			void scanVisible().catch((error) => {
				console.error('Role Color Everywhere visible-cell scan failed:', error);
			});
		}, delay);
		timers.add(timer);
	}

	function onChannelChange(): void {
		const nextChannelId = selected.getChannelId();
		if (!nextChannelId || nextChannelId === currentChannelId) return;
		currentChannelId = nextChannelId;
		channelRevision++;
		for (const key of pendingCells) dirtyCells.add(key);
		textViews.clear();
		cellTextViews.clear();
		for (const delay of SCAN_DELAYS) scheduleScan(delay);
	}

	hooks.push(
		bridge.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
			after: ({ self }) => scheduleCell(self),
		}),
		bridge.hook('DCDMessageTableViewCell', 'layoutSubviews', {
			after: ({ self }) => scheduleCell(self),
		}),
		bridge.hook('DCDMessageTableViewCell', 'prepareForReuse', {
			after: ({ self }) => forgetCell(self),
		}),
	);
	selected.addChangeListener?.(onChannelChange);
	for (const delay of SCAN_DELAYS) scheduleScan(delay);

	return async () => {
		stopped = true;
		selected.removeChangeListener?.(onChannelChange);
		for (const hook of hooks) hook.remove();
		for (const timer of timers) clearTimeout(timer);
		await Promise.all([...textViews.keys()].map(restoreView));
		pendingCells.clear();
		dirtyCells.clear();
		cellTextViews.clear();
		cellRevisions.clear();
		colors.clear();
	};
}
