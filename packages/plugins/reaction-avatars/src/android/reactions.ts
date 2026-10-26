import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { layoutHostingList, removeHost } from '@unbound-plugins/shared/native/android/inline-hosts';
import { shapeField } from '@unbound-plugins/shared/native/android/discord-shapes';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
	viewByIdName,
} from '@unbound-plugins/shared/native/android/discord-views';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import { legacyJavaClass } from '@unbound-plugins/shared/native/android/legacy-classes';
import {
	currentDecorView,
	findViewsOfClass,
	STARTUP_SCAN_DELAYS,
} from '@unbound-plugins/shared/native/android/views';
import { metro } from '@unbound-app/api';

import {
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStackWidth,
	type Reactor,
} from '~/avatars';
import { reactionContext, type Reaction, type ReactionContext } from '~/reaction-context';
import { Avatar, REACTION_ACTIONS } from '~/constants';
import { ChannelStore, MessageStore } from '~/modules';
import { selectedChannelId } from '~/selected-channel';
import { surfaceStates } from '~/surface-states';
import ReactionUserCache from '~/reactor-cache';
import { fetchReactors } from '~/reactors';

const REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
const REACTION_ROW = 'com.discord.reactions.ShortcutsFlexbox';
const ADD_REACTION_VIEW = 'com.discord.reactions.AddReactionView';
const LINEAR_PARAMS = 'android.widget.LinearLayout$LayoutParams';
const CENTER_VERTICAL = 16;
const VISIBLE = 0;
const HOST_HEIGHT = 20;
const AVATAR_GAP = 4;
const MAX_SEARCH_DEPTH = 6;
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];
const UNMOUNT_WAIT_MS = 1000;

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
};

type Pill = {
	id: string;
	reactionView: NativeJavaReference;
	host: NativeJavaHandle;
	contextKey: string;
	mounting: Promise<NativeFabricSurface> | null;
	revision: number;
	disposed: boolean;
};

type Message = {
	reactions?: Reaction[];
};

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

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
export function createAndroidReactions({ java, hooks, fabric }: Native, surfaceName: string) {
	const reactors = new ReactionUserCache<Reactor>();
	const pills = new Map<string, Pill>();
	const bound = new Map<string, { messageView: NativeJavaReference; messageId: string }>();
	const queues = new Map<string, Promise<void>>();
	const awaitingSize = new Map<string, { messageView: NativeJavaReference; messageId: string }>();
	let nextId = 0;
	let disposed = false;

	function isA(className: string, view: NativeJavaReference): boolean {
		return javaFlag(java.invoke(java.getClass(className), 'isInstance', [view]));
	}

	function children(view: NativeJavaReference): NativeJavaReference[] {
		const count = javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0;

		return Array.from({ length: count }, (_, index) =>
			javaReference(java.invoke(view, 'getChildAt', [javaInt(index)])),
		).filter((child): child is NativeJavaReference => child !== null);
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

	function reactionRow(messageView: NativeJavaReference): NativeJavaReference | null {
		const accessories = viewByIdName(java, messageView, 'accessories_view');
		let level = accessories ? [accessories] : [];

		for (let depth = 0; depth < MAX_SEARCH_DEPTH && level.length; depth++) {
			const row = level.find((view) => isA(REACTION_ROW, view));

			if (row) return row;

			level = level
				.filter((view) => isA('android.view.ViewGroup', view))
				.flatMap((view) => children(view));
		}

		return null;
	}

	function density(view: NativeJavaReference): number {
		const resources = javaReference(java.invoke(view, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	async function removePill(pill: Pill) {
		pill.disposed = true;
		pills.delete(viewKey(pill.reactionView as NativeJavaValue) ?? '');
		surfaceStates.delete(pill.id);

		const mounted = await settledWithin(pill.mounting, UNMOUNT_WAIT_MS);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, pill.host).catch(() => undefined);
	}

	function describe(pill: Pill, context: ReactionContext, users: Reactor[]) {
		surfaceStates.set(pill.id, {
			guildId: ChannelStore.getChannel(context.channelId)?.guild_id,
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
		reactionView: NativeJavaReference,
		context: ReactionContext,
		users: Reactor[],
	): Promise<Pill> {
		const scale = density(reactionView);
		const total = reactionAvatarSelection(context.reaction, context.reactionType).count;
		const width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(total));
		const viewContext = javaReference(java.invoke(reactionView, 'getContext', []));
		const host = java.construct('android.widget.FrameLayout', viewContext ? [viewContext] : []);
		const params = java.construct(LINEAR_PARAMS, [
			javaInt(Math.round(width * scale)),
			javaInt(Math.round(HOST_HEIGHT * scale)),
		]);
		const pill: Pill = {
			id: `reaction-avatars-android-${nextId++}`,
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
		pills.set(viewKey(reactionView as NativeJavaValue) ?? '', pill);
		await java.invokeAsync(reactionView, 'addView', [host, params]);

		return pill;
	}

	async function mount(pill: Pill) {
		if (pill.disposed || pill.mounting) return;

		pill.mounting = fabric.mountAsync(pill.host, surfaceName, {
			surfaceId: pill.id,
			revision: pill.revision,
		});
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

	async function render(messageView: NativeJavaReference, messageId: string) {
		const channelId = selectedChannelId();
		const message: Message | undefined = channelId
			? MessageStore.getMessage(channelId, messageId)
			: undefined;
		const row = reactionRow(messageView);
		const views = row ? children(row).filter(isReactionView) : [];
		const reactions = message?.reactions ?? [];
		const used = new Set<number>();
		const changed: Pill[] = [];

		for (const reactionView of views) {
			const key = viewKey(reactionView as NativeJavaValue) ?? '';
			const existing = pills.get(key);
			const shown = javaNumber(java.invoke(reactionView, 'getVisibility', [])) === VISIBLE;
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

			if (disposed) return;

			if (!users.length) {
				if (existing) {
					await removePill(existing);
					changed.push(existing);
				}

				continue;
			}

			if (existing && existing.contextKey === context.key && !existing.disposed) {
				describe(existing, context, users);
				await refresh(existing);

				continue;
			}

			if (existing) await removePill(existing);

			if (disposed) return;

			changed.push(await addPill(reactionView, context, users));
		}

		const messageKey = viewKey(messageView as NativeJavaValue) ?? '';

		if (reactions.length && !used.size) {
			awaitingSize.set(messageKey, { messageView, messageId });
		} else {
			awaitingSize.delete(messageKey);
		}

		if (!changed.length) return;

		await java.invokeAsync(messageView, 'requestLayout', []);
		await layoutHostingList(java, messageView);

		for (const pill of changed) await mount(pill);

		await layoutHostingList(java, messageView);
	}

	function schedule(messageView: NativeJavaReference, messageId: string) {
		const key = viewKey(messageView as NativeJavaValue);

		if (!key || disposed) return;

		bound.set(key, { messageView, messageId });

		const next = (queues.get(key) ?? Promise.resolve())
			.then(() =>
				bound.get(key)?.messageId === messageId
					? render(messageView, messageId)
					: undefined,
			)
			.catch((error) => {
				console.error('[Reaction Avatars] Failed to draw Android reactors:', error);
			})
			.finally(() => {
				if (queues.get(key) === next) queues.delete(key);
			});

		queues.set(key, next);
	}

	const bindMessage = messageBindMethod(java);
	const idField = messageIdField(java);
	const token = hooks.hook(
		MESSAGE_VIEW,
		bindMessage.name,
		bindMessage.parameters,
		{ notify: true },
		({ self, args }) => {
			const messageView = javaReference(self);
			const message = javaReference(args[0]);
			const messageId = message
				? javaText(java.invoke(message, 'getId-3Eiw7ao', []))
				: undefined;

			if (messageView && messageId) setTimeout(() => schedule(messageView, messageId), 0);
		},
	);

	const sizeToken = hooks.hook(
		MESSAGE_VIEW,
		'onSizeChanged',
		SIZE_PARAMETERS,
		{ notify: true },
		({ self }) => {
			const key = viewKey(self);
			const pending = key ? awaitingSize.get(key) : undefined;

			if (!key || !pending) return;

			awaitingSize.delete(key);
			schedule(pending.messageView, pending.messageId);
		},
	);

	function onReactionChange(event: {
		messageId?: string;
		message_id?: string;
		channelId?: string;
	}) {
		const messageId = event.messageId ?? event.message_id;

		if (!messageId) return;

		reactors.invalidateMessage(messageId, event.channelId);

		for (const entry of bound.values()) {
			if (entry.messageId === messageId) {
				setTimeout(() => schedule(entry.messageView, messageId), 0);
			}
		}
	}

	for (const action of REACTION_ACTIONS) {
		metro.common.Dispatcher.subscribe(action, onReactionChange);
	}

	function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const messageView of findViewsOfClass(java, decor, MESSAGE_VIEW)) {
			const messageId = javaText(java.getField(messageView, idField));

			if (messageId) schedule(messageView, messageId);
		}
	}

	const scans = STARTUP_SCAN_DELAYS.map((delay) => setTimeout(scanVisible, delay));

	return {
		async dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			hooks.remove(sizeToken);
			awaitingSize.clear();

			for (const action of REACTION_ACTIONS) {
				metro.common.Dispatcher.unsubscribe(action, onReactionChange);
			}

			const views = [...bound.values()];

			await Promise.all([...pills.values()].map(removePill));

			const [first] = views;

			if (first) await layoutHostingList(java, first.messageView).catch(() => undefined);

			bound.clear();
		},
	};
}

export default { createAndroidReactions };
