import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
} from '@unbound-app/api/native';
import { layoutHostingList, removeHost } from '@unbound-plugins/shared/native/android/inline-hosts';
import { shapeField } from '@unbound-plugins/shared/native/android/discord-shapes';
import { viewByIdNameAsync } from '@unbound-plugins/shared/native/android/discord-views';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
	javaViewKey,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import { watchMessageRows } from '@unbound-plugins/shared/native/android/message-rows';
import { legacyJavaClass } from '@unbound-plugins/shared/native/android/legacy-classes';
import { displayDensity, readCalls, runOnMain } from '@unbound-plugins/shared/native/android/views';
import { flux } from '@unbound-app/api';

import {
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStackWidth,
	type Reactor,
} from '~/reactions/avatars';
import { reactionContext, type Reaction, type ReactionContext } from '~/reactions/reaction-context';
import { Avatar, REACTION_ACTIONS } from '~/constants';
import { ChannelStore, MessageStore } from '~/reactions/modules';
import { selectedChannelId } from '~/reactions/selected-channel';
import type { ReactionChange } from '~/types';
import { surfaceStates } from '~/reactions/surface-states';
import ReactionUserCache from '~/reactions/reactor-cache';
import { fetchReactors } from '~/reactions/reactors';

const REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
const REACTION_ROW = 'com.discord.reactions.ShortcutsFlexbox';
const ADD_REACTION_VIEW = 'com.discord.reactions.AddReactionView';
const LINEAR_PARAMS = 'android.widget.LinearLayout$LayoutParams';
const CENTER_VERTICAL = 16;
const VISIBLE = 0;
const HOST_HEIGHT = 20;
const AVATAR_GAP = 4;
const MAX_SEARCH_DEPTH = 6;
const UNMOUNT_WAIT_MS = 1000;
const DISPOSE_WAIT_MS = 3000;

function settledWithin<T>(pending: Promise<T> | null, timeout: number): Promise<T | null> {
	if (!pending) return Promise.resolve(null);

	return Promise.race([
		pending.catch(() => null),
		new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
	]);
}

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
	ui: NativeUIBridge;
};

type Pill = {
	id: string;
	messageView: NativeJavaReference;
	reactionView: NativeJavaReference;
	host: NativeJavaHandle;
	contextKey: string;
	mounting: Promise<NativeFabricSurface> | null;
	revision: number;
	disposed: boolean;
};

function emojiKey(reaction: Reaction): string | undefined {
	if (typeof reaction.emoji === 'string') return reaction.emoji;

	return reaction.emoji.id ? String(reaction.emoji.id) : (reaction.emoji.name ?? undefined);
}

/**
 * @description Shows the first reactors inside each reaction pill of Discord's Android message rows, the way the iOS client does.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param surfaceName The registered avatar surface to mount in each pill.
 * @returns `dispose`, which removes every avatar stack and resolves once the pills are restored.
 */
export function createAndroidReactions(native: Native, surfaceName: string) {
	const { java, fabric } = native;
	const reactors = new ReactionUserCache<Reactor>();
	const pills = new Map<string, Pill>();
	let nextId = 0;
	let disposed = false;

	function isA(className: string, view: NativeJavaReference): boolean {
		return javaFlag(java.invoke(java.getClass(className), 'isInstance', [view]));
	}

	async function children(view: NativeJavaReference): Promise<NativeJavaReference[]> {
		const found = await java.findViews(view, 'android.view.View', {
			maxDepth: 1,
			maxResults: 256,
		});

		return found
			.map((child) => javaReference(child))
			.filter(
				(child): child is NativeJavaReference => !!child && !sameJavaReference(child, view),
			);
	}

	const reactionViewNamed = (() => {
		try {
			java.getClass(REACTION_VIEW);

			return true;
		} catch {
			return false;
		}
	})();
	const emojiFields = new Map<string, string>();

	function isReactionView(view: NativeJavaReference): boolean {
		if (reactionViewNamed) return isA(REACTION_VIEW, view);

		return (
			isA('android.view.View', view) && javaText(java.className(view)) !== ADD_REACTION_VIEW
		);
	}

	function emojiField(reactionView: NativeJavaReference): string | undefined {
		const className = javaText(java.className(reactionView));

		if (!className) return undefined;

		const cached = emojiFields.get(className);

		if (cached) return cached;

		const field = shapeField(java, 'reactionEmoji', className);

		if (!field) return undefined;

		emojiFields.set(className, field.name);

		return field.name;
	}

	async function reactionRow(
		messageView: NativeJavaReference,
	): Promise<NativeJavaReference | null> {
		const accessories = await viewByIdNameAsync(java, messageView, 'accessories_view');

		if (!accessories) return null;

		const [row] = await java.findViews(accessories, REACTION_ROW, {
			maxDepth: MAX_SEARCH_DEPTH,
			maxResults: 1,
			stopAtMatch: true,
		});

		return javaReference(row);
	}

	async function removePill(pill: Pill) {
		pill.disposed = true;
		pills.delete(javaViewKey(pill.reactionView as NativeJavaValue) ?? '');
		surfaceStates.delete(pill.id);

		const mounted = await settledWithin(pill.mounting, UNMOUNT_WAIT_MS);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, pill.host).catch(() => undefined);
	}

	function describe(pill: Pill, context: ReactionContext, users: Reactor[]) {
		surfaceStates.set(pill.id, {
			guildId: ChannelStore.getChannel(context.channelId)?.guild_id ?? undefined,
			height: HOST_HEIGHT,
			measured: true,
			onWidth: () => undefined,
			totalCount: reactionAvatarSelection(context.reaction, context.reactionType).count,
			users,
			width: reactionAvatarStackWidth(
				reactionAvatarReservedSlotCount(
					reactionAvatarSelection(context.reaction, context.reactionType).count,
				),
			),
		});
	}

	async function addPill(
		messageView: NativeJavaReference,
		reactionView: NativeJavaReference,
		context: ReactionContext,
		users: Reactor[],
	): Promise<Pill> {
		const scale = await displayDensity(java, reactionView);
		const total = reactionAvatarSelection(context.reaction, context.reactionType).count;
		const width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(total));
		const viewContext = javaReference(await java.invokeAsync(reactionView, 'getContext', []));
		const host = java.construct('android.widget.FrameLayout', viewContext ? [viewContext] : []);
		const params = java.construct(LINEAR_PARAMS, [
			javaInt(Math.round(width * scale)),
			javaInt(Math.round(HOST_HEIGHT * scale)),
		]);
		const pill: Pill = {
			id: `reaction-avatars-android-${nextId++}`,
			messageView,
			reactionView,
			host,
			contextKey: context.key,
			mounting: null,
			revision: 0,
			disposed: false,
		};

		java.invoke(params, 'setMargins', [
			javaInt(Math.round(AVATAR_GAP * scale)),
			javaInt(0),
			javaInt(Math.round((Avatar.trailingPadding - Avatar.leadingInset) * scale)),
			javaInt(0),
		]);
		java.setField(params, 'gravity', javaInt(CENTER_VERTICAL));
		describe(pill, context, users);
		pills.set(javaViewKey(reactionView as NativeJavaValue) ?? '', pill);
		await java.invokeAsync(reactionView, 'addView', [host, params]);

		return pill;
	}

	async function mount(pill: Pill) {
		if (pill.disposed || pill.mounting) return;

		pill.mounting = fabric.mountAsync(
			pill.host,
			surfaceName,
			{ surfaceId: pill.id, revision: pill.revision },
			{ reuse: true },
		);
		await pill.mounting.catch((error: unknown) => {
			pill.mounting = null;
			throw error;
		});
	}

	async function refresh(pill: Pill) {
		const mounted = await pill.mounting?.catch(() => null);

		if (mounted && !pill.disposed) {
			pill.revision++;
			await fabric
				.updateAsync(mounted, { surfaceId: pill.id, revision: pill.revision })
				.catch(() => undefined);
		}
	}

	function drawnHosts(views: NativeJavaReference[]): NativeJavaReference[] {
		return views.flatMap((view) => {
			const pill = pills.get(javaViewKey(view as NativeJavaValue) ?? '');

			return pill && !pill.disposed ? [pill.host] : [];
		});
	}

	async function render(messageView: NativeJavaReference, messageId: string): Promise<boolean> {
		const channelId = selectedChannelId();
		const message = channelId ? MessageStore.getMessage(channelId, messageId) : undefined;
		const row = await reactionRow(messageView);
		const views = row ? (await children(row)).filter(isReactionView) : [];
		const visibility = await runOnMain(
			java,
			views.flatMap((view) => readCalls(view, ['getVisibility'])),
		);
		const reactions = message?.reactions ?? [];
		const used = new Set<number>();
		const changed: Pill[] = [];

		for (const [position, reactionView] of views.entries()) {
			const key = javaViewKey(reactionView as NativeJavaValue) ?? '';
			const existing = pills.get(key);
			const shown = javaNumber(visibility[position]) === VISIBLE;
			const field = shown ? emojiField(reactionView) : undefined;
			const emoji = field ? javaText(java.getField(reactionView, field)) : undefined;
			const index = reactions.findIndex(
				(reaction, position) => !used.has(position) && emojiKey(reaction) === emoji,
			);

			if (index >= 0) used.add(index);

			const context =
				channelId && index >= 0
					? reactionContext(channelId, messageId, reactions[index]!)
					: null;

			if (!context) {
				if (existing) {
					await removePill(existing);
					changed.push(existing);
				}

				continue;
			}

			const users = await reactors
				.load(context.key, () => fetchReactors(context))
				.catch(() => [] as Reactor[]);

			if (disposed) return true;

			if (!users.length) {
				if (existing) {
					await removePill(existing);
					changed.push(existing);
				}

				continue;
			}

			if (existing && existing.contextKey === context.key && !existing.disposed) {
				describe(existing, context, users);
				await java.invokeAsync(existing.host, 'setVisibility', [javaInt(VISIBLE)]);
				await refresh(existing);

				continue;
			}

			if (existing) await removePill(existing);

			if (disposed) return true;

			changed.push(await addPill(messageView, reactionView, context, users));
		}

		rows.markDrawn(messageView, messageId, drawnHosts(views));

		// Reactions with no pill matched yet: the row is not laid out, so draw again once it resizes.
		const laidOut = !(reactions.length && !used.size);

		if (!changed.length) return laidOut;

		await java.invokeAsync(messageView, 'requestLayout', []);
		await layoutHostingList(java, messageView);

		for (const pill of changed) await mount(pill);

		await layoutHostingList(java, messageView);

		return laidOut;
	}

	async function clear(messageView: NativeJavaReference) {
		const key = javaViewKey(messageView as NativeJavaValue);
		const drawn = [...pills.values()].filter(
			(pill) => javaViewKey(pill.messageView as NativeJavaValue) === key,
		);

		if (!drawn.length) return;

		await Promise.all(drawn.map(removePill));
		await layoutHostingList(java, messageView);
	}

	const rows = watchMessageRows(native, { draw: render, clear });

	function onReactionChange(event: ReactionChange) {
		const messageId = event.messageId ?? event.message_id;

		if (!messageId) return;

		reactors.invalidateMessage(messageId, event.channelId);
		rows.redraw(messageId);
	}

	for (const action of REACTION_ACTIONS) flux.onAction(action, onReactionChange);

	return {
		async dispose() {
			disposed = true;

			const cleared = rows
				.dispose()
				.then(() => Promise.all([...pills.values()].map(removePill)));

			await settledWithin(cleared, DISPOSE_WAIT_MS);
		},
	};
}

export default { createAndroidReactions };
