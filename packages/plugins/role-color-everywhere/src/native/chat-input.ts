import { safeCall, safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import type { NativeHookToken, NativeObjCBridge } from '@unbound-app/api/native';
import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import findVisibleCells from '@unbound-plugins/shared/native/visible-cells';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import { viewKey } from '@unbound-plugins/shared/native/view-key';

import { ChannelStore, GuildMemberStore, SelectedChannelStore, UserStore } from '~/modules';
import { presentNames, uniqueNames, type NameOwner } from '~/names';
import { createMentionPainter } from '~/native/mention-painter';
import { longestFirst, matchMention } from '~/mentions';
import { guildIdOf } from '~/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import type { NativeValue } from '~/types';

type TextViewState = {
	applied: NativeValue;
	original: NativeValue;
	view: NativeValue;
};

type GuildAliases = {
	owners: Map<string, string>;
	names: string[];
};

function currentGuildId(): string | undefined {
	return guildIdOf(SelectedChannelStore.getChannelId());
}

// The composer shows a mention as plain "@name" text, so names are matched against every member's names.
function guildAliases(guildId: string): GuildAliases {
	const members = (GuildMemberStore.getMembers(guildId) ?? []).slice(0, 5_000);
	const owners = uniqueNames(
		members.map((member): NameOwner<string> => {
			const user = UserStore.getUser(member.userId);
			const tag =
				user?.username && user.discriminator && user.discriminator !== '0'
					? `${user.username}#${user.discriminator}`
					: null;

			return [
				presentNames(member.nick, user?.globalName, user?.username, tag),
				member.userId,
			];
		}),
	);

	return { owners, names: longestFirst(owners.keys()) };
}

/**
 * @description Paints mentions typed in the native chat input with the mentioned member's role colors.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns A function that removes the hooks and restores the input's text and selection.
 */
export function colorChatInputMentions(objc: NativeObjCBridge): () => Promise<void> {
	const feature = `${PLUGIN_NAME}: composer mentions`;

	if (
		!ensureModules(feature, { UserStore, ChannelStore, SelectedChannelStore }) ||
		!ensureClasses(feature, objc, ['DCDChatInputComponentView'])
	) {
		return async () => {};
	}

	const painter = createMentionPainter(objc);
	const states = new Map<string, TextViewState>();
	const pending = new Map<string, ReturnType<typeof setTimeout>>();
	const updating = new Set<string>();
	const dirty = new Set<string>();
	const aliases = new Map<string, GuildAliases>();
	let stopped = false;

	function aliasesFor(guildId: string): GuildAliases {
		const cached = aliases.get(guildId) ?? guildAliases(guildId);

		aliases.set(guildId, cached);

		return cached;
	}

	async function paint(view: NativeValue, key: string): Promise<void> {
		if (!(await safeInvokeAsync(objc, view, 'window')) || stopped) return;

		const guildId = currentGuildId();

		if (!guildId) return;

		const original: NativeValue = await safeInvokeAsync(objc, view, 'attributedText');

		if (!original) return;

		const state = states.get(key);

		if (state && safeCall(objc, original, 'isEqual:', state.applied)) return;

		if (state) states.delete(key);

		const text = safeCall(objc, original, 'string');

		if (typeof text !== 'string' || !text.includes('@')) return;

		const painted = objc.alloc('NSMutableAttributedString');

		if (!safeCall(objc, painted, 'initWithAttributedString:', original)) return;

		let known = aliasesFor(guildId);
		let refreshed = false;
		let changed = false;

		for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
			const attributes: NativeValue = safeCall(
				objc,
				original,
				'attributesAtIndex:effectiveRange:',
				at,
				null,
			);
			const fontName = safeCall(objc, attributes?.NSFont, 'fontName');

			// The composer bolds a completed mention; unbolded "@text" is still being typed.
			if (typeof fontName !== 'string' || !/bold|semibold/i.test(fontName)) {
				continue;
			}

			let name = matchMention(text, at, known.names, /[\s,.!?;:]/u);

			if (!name && !refreshed) {
				aliases.delete(guildId);
				known = aliasesFor(guildId);
				refreshed = true;
				name = matchMention(text, at, known.names, /[\s,.!?;:]/u);
			}

			if (!name) {
				continue;
			}

			const userId = known.owners.get(name);
			const member = userId ? GuildMemberStore.getMember(guildId, userId) : null;
			const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);

			if (!appearance.colors.length) {
				continue;
			}

			await painter.paint(painted, `@${name}`, at, appearance.colors);
			at += name.length;
			changed = true;
		}

		if (!changed || stopped) return;

		const selection = await safeInvokeAsync(objc, view, 'selectedRange');
		const latest: NativeValue = await safeInvokeAsync(objc, view, 'attributedText');

		if (!latest || !safeCall(objc, latest, 'isEqual:', original)) {
			dirty.add(key);

			return;
		}

		if (stopped || guildId !== currentGuildId()) return;

		states.set(key, { applied: painted, original, view });
		await safeInvokeAsync(objc, view, 'setAttributedText:', painted);

		if (stopped) return;

		if (selection) await safeInvokeAsync(objc, view, 'setSelectedRange:', selection);
	}

	async function update(view: NativeValue): Promise<void> {
		if (stopped) return;

		const key = viewKey(objc, view);

		if (!key) return;

		if (updating.has(key)) {
			dirty.add(key);

			return;
		}

		updating.add(key);

		try {
			await paint(view, key);
		} finally {
			updating.delete(key);

			if (dirty.delete(key) && !stopped) schedule(view);
		}
	}

	function schedule(view: NativeValue): void {
		if (stopped) return;

		const key = viewKey(objc, view);

		if (!key || pending.has(key)) return;

		const timer = setTimeout(() => {
			pending.delete(key);

			void update(view).catch((error) => {
				console.error(`[${PLUGIN_NAME}] Failed to paint composer mentions:`, error);
			});
		}, 0);

		pending.set(key, timer);
	}

	async function restore(key: string, state: TextViewState): Promise<void> {
		const current: NativeValue = await safeInvokeAsync(objc, state.view, 'attributedText');

		if (!safeCall(objc, current, 'isEqual:', state.applied)) return;

		const selection = await safeInvokeAsync(objc, state.view, 'selectedRange');

		updating.add(key);

		try {
			await safeInvokeAsync(objc, state.view, 'setAttributedText:', state.original);

			if (selection) await safeInvokeAsync(objc, state.view, 'setSelectedRange:', selection);
		} finally {
			updating.delete(key);
		}
	}

	const hooks: NativeHookToken[] = [];

	try {
		for (const selector of [
			'setAttributedText:',
			'setText:',
			'layoutSubviews',
			'didMoveToWindow',
		]) {
			hooks.push(
				objc.hook('DCDChatInputComponentView', selector, {
					after: ({ self }) => schedule(self),
				}),
			);
		}
	} catch (error) {
		for (const hook of hooks) hook.remove();

		throw error;
	}

	void findVisibleCells(objc, 'DCDChatInputComponentView')
		.then((views) => {
			for (const view of views) schedule(view);
		})
		.catch((error) => {
			console.error(`[${PLUGIN_NAME}] Failed to scan the composer:`, error);
		});

	return async () => {
		stopped = true;

		for (const hook of hooks) hook.remove();

		for (const timer of pending.values()) clearTimeout(timer);

		const painted = [...states];

		states.clear();
		await Promise.all(painted.map(([key, state]) => restore(key, state)));
		pending.clear();
		dirty.clear();
		aliases.clear();
		painter.clear();
	};
}

export default colorChatInputMentions;
