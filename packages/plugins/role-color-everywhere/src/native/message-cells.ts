import { safeCall, safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import hookMessageCells from '@unbound-plugins/shared/native/message-cell-hooks';
import findVisibleCells from '@unbound-plugins/shared/native/visible-cells';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import { viewKey } from '@unbound-plugins/shared/native/view-key';
import type { NativeObjCBridge } from '@unbound-app/api/native';

import {
	ChannelStore,
	GuildMemberStore,
	MessageStore,
	SelectedChannelStore,
	UserStore,
} from '~/modules';
import { longestFirst, matchMention, mentionedUserIds } from '~/mentions';
import { createMentionPainter } from '~/native/mention-painter';
import { CELL_SCAN_DELAYS, PLUGIN_NAME } from '~/constants';
import type { Message, NativeValue } from '~/types';
import { presentNames } from '~/names';

type Mention = {
	colors: string[];
	names: string[];
};

type TextViewState = {
	applied: NativeValue;
	messageId: string;
	original: NativeValue;
	view: NativeValue;
};

// Everything a render read before awaiting native calls; it is dropped if any of it changed meanwhile.
type CellRender = {
	cell: NativeValue;
	cellKey: string;
	cellRevision: number;
	channelId: string;
	channelRevision: number;
	messageId: string;
	mentions: Mention[];
};

function mentionsIn(message: Message, guildId: string): Mention[] {
	const mentions: Mention[] = [];

	for (const userId of mentionedUserIds(message.content ?? '')) {
		const member = GuildMemberStore.getMember(guildId, userId);
		const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);

		if (!appearance.colors.length) {
			continue;
		}

		const user = UserStore.getUser(userId);
		const names = presentNames(member?.nick, user?.globalName, user?.username);

		if (names.length) mentions.push({ colors: appearance.colors, names: longestFirst(names) });
	}

	return mentions;
}

/**
 * @description Paints mentions in native chat message cells with the mentioned member's role colors.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns A function that removes the hooks and restores every painted text view.
 */
export function colorMessageMentions(objc: NativeObjCBridge): () => Promise<void> {
	const feature = `${PLUGIN_NAME}: chat mentions`;
	const modules = { MessageStore, ChannelStore, UserStore, SelectedChannelStore };

	if (
		!ensureModules(feature, modules) ||
		!ensureClasses(feature, objc, ['DCDMessageTableViewCell'])
	) {
		return async () => {};
	}

	const painter = createMentionPainter(objc);
	const textViews = new Map<string, TextViewState>();
	const pendingCells = new Set<string>();
	const dirtyCells = new Set<string>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const cellTextViews = new Map<string, Set<string>>();
	const cellRevisions = new Map<string, number>();
	let currentChannelId = SelectedChannelStore.getChannelId();
	let channelRevision = 0;
	let stopped = false;

	function messageIdFor(cell: NativeValue): string | undefined {
		const message: NativeValue = safeCall(
			objc,
			objc.getIvar(cell, 'viewModel') as NativeValue,
			'message',
		);
		const identifier: NativeValue = safeCall(objc, message, 'id');

		if (typeof identifier === 'string') return identifier;

		const description = safeCall(objc, identifier, 'description');

		return typeof description === 'string' ? description : undefined;
	}

	function isCurrent(render: CellRender): boolean {
		return (
			!stopped &&
			currentChannelId === render.channelId &&
			channelRevision === render.channelRevision &&
			(cellRevisions.get(render.cellKey) ?? 0) === render.cellRevision &&
			messageIdFor(render.cell) === render.messageId
		);
	}

	async function textViewsIn(cell: NativeValue): Promise<NativeValue[]> {
		const nodes = await objc.snapshot(cell, {
			maxDepth: 12,
			maxNodes: 80,
		});

		return nodes
			.map((node) => node.view)
			.filter(
				(view) =>
					objc.respondsTo(view, 'attributedText') &&
					objc.respondsTo(view, 'setAttributedText:'),
			);
	}

	async function paintView(render: CellRender, view: NativeValue): Promise<void> {
		const key = viewKey(objc, view);

		if (!key) return;

		const current: NativeValue = await safeInvokeAsync(objc, view, 'attributedText');

		if (!current) return;

		const state = textViews.get(key);

		if (
			state?.messageId === render.messageId &&
			safeCall(objc, current, 'isEqual:', state.applied)
		) {
			return;
		}

		if (state) textViews.delete(key);

		const text = safeCall(objc, current, 'string');

		if (typeof text !== 'string' || !text.includes('@')) return;

		const painted = objc.alloc('NSMutableAttributedString');

		if (!safeCall(objc, painted, 'initWithAttributedString:', current)) return;

		let offset = 0;
		let changed = false;

		for (const mention of render.mentions) {
			for (let at = text.indexOf('@', offset); at >= 0; at = text.indexOf('@', at + 1)) {
				const name = matchMention(text, at, mention.names, /[\s\u2068\u2069]/u);

				if (!name) {
					continue;
				}

				const attributes: NativeValue = safeCall(
					objc,
					current,
					'attributesAtIndex:effectiveRange:',
					at,
					null,
				);

				// Only Discord's tappable mention spans carry a highlight; plain "@name" text stays as is.
				if (!attributes?.YYTextHighlight) {
					continue;
				}

				const length = name.length + 1;

				await painter.paint(painted, text.slice(at, at + length), at, mention.colors);
				offset = at + length;
				changed = true;

				break;
			}
		}

		if (!changed || stopped) return;

		const latest: NativeValue = await safeInvokeAsync(objc, view, 'attributedText');

		if (!latest || !safeCall(objc, latest, 'isEqual:', current) || !isCurrent(render)) return;

		textViews.set(key, {
			applied: painted,
			messageId: render.messageId,
			original: current,
			view,
		});

		let views = cellTextViews.get(render.cellKey);

		if (!views) {
			views = new Set();
			cellTextViews.set(render.cellKey, views);
		}

		views.add(key);

		await safeInvokeAsync(objc, view, 'setAttributedText:', painted);
	}

	async function paintCell(cell: NativeValue): Promise<void> {
		if (stopped || !currentChannelId) return;

		const cellKey = viewKey(objc, cell);

		if (!cellKey) return;

		if (!(await safeInvokeAsync(objc, cell, 'window'))) {
			forgetCell(cell);

			return;
		}

		const channelId = currentChannelId;
		const render = { cell, cellKey, channelId, channelRevision };
		const cellRevision = cellRevisions.get(cellKey) ?? 0;
		const messageId = messageIdFor(cell);
		const message = messageId ? MessageStore.getMessage(channelId, messageId) : null;

		if (!messageId || !message) return;

		const guildId = message.guildId ?? ChannelStore.getChannel(channelId)?.guild_id;

		if (!guildId) return;

		const mentions = mentionsIn(message, guildId);

		if (!mentions.length) return;

		for (const view of await textViewsIn(cell)) {
			await paintView({ ...render, cellRevision, messageId, mentions }, view);
		}
	}

	function scheduleCell(cell: NativeValue): void {
		if (stopped) return;

		const key = viewKey(objc, cell);

		if (!key) return;

		if (pendingCells.has(key)) {
			dirtyCells.add(key);

			return;
		}

		pendingCells.add(key);

		const timer = setTimeout(() => {
			timers.delete(timer);

			void paintCell(cell)
				.catch((error) => {
					console.error(`[${PLUGIN_NAME}] Failed to paint native mentions:`, error);
				})
				.finally(() => {
					pendingCells.delete(key);

					if (dirtyCells.delete(key) && !stopped) scheduleCell(cell);
				});
		}, 0);

		timers.add(timer);
	}

	function forgetCell(cell: NativeValue): void {
		const cellKey = viewKey(objc, cell);

		if (!cellKey) return;

		cellRevisions.set(cellKey, (cellRevisions.get(cellKey) ?? 0) + 1);

		for (const key of cellTextViews.get(cellKey) ?? []) textViews.delete(key);

		cellTextViews.delete(cellKey);
	}

	async function scanVisibleCells(): Promise<void> {
		if (stopped) return;

		const cells = await findVisibleCells(objc, 'DCDMessageTableViewCell');

		for (const cell of cells) scheduleCell(cell);
	}

	function scheduleScans(): void {
		for (const delay of CELL_SCAN_DELAYS) {
			const timer = setTimeout(() => {
				timers.delete(timer);

				void scanVisibleCells().catch((error) => {
					console.error(`[${PLUGIN_NAME}] Failed to scan visible message cells:`, error);
				});
			}, delay);

			timers.add(timer);
		}
	}

	function onChannelChange(): void {
		const channelId = SelectedChannelStore.getChannelId();

		if (!channelId || channelId === currentChannelId) return;

		currentChannelId = channelId;
		channelRevision++;

		for (const key of pendingCells) dirtyCells.add(key);

		textViews.clear();
		cellTextViews.clear();
		scheduleScans();
	}

	async function restoreView(state: TextViewState): Promise<void> {
		const current: NativeValue = await safeInvokeAsync(objc, state.view, 'attributedText');

		if (safeCall(objc, current, 'isEqual:', state.applied)) {
			await safeInvokeAsync(objc, state.view, 'setAttributedText:', state.original);
		}
	}

	const unhook = hookMessageCells(objc, {
		shown: scheduleCell,
		laidOut: scheduleCell,
		reused: forgetCell,
	});

	SelectedChannelStore.addChangeListener(onChannelChange);
	scheduleScans();

	return async () => {
		stopped = true;
		SelectedChannelStore.removeChangeListener(onChannelChange);

		unhook();

		for (const timer of timers) clearTimeout(timer);

		const painted = [...textViews.values()];

		textViews.clear();
		await Promise.all(painted.map(restoreView));
		pendingCells.clear();
		dirtyCells.clear();
		cellTextViews.clear();
		cellRevisions.clear();
		painter.clear();
	};
}

export default colorMessageMentions;
