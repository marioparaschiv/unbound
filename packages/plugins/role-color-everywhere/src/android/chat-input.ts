import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import { currentGuildId, guildAliases, type GuildAliases } from '~/composer-aliases';
import { composerMentions } from '~/composer-mentions';
import { GuildMemberStore } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

const CHAT_INPUT = 'com.discord.chat.input.views.DCDChatInput';
const MENTION_SPAN = 'com.discord.chat.input.spans.DCDColorSpan';
const COLOR_FIELD = 'mColor';
const PAINT_DELAYS_MS = [0, 50, 150, 300, 800, 1500];

type Native = { java: NativeJavaBridge; hooks: NativeJavaHooksBridge };

type Recolored = { span: NativeJavaReference; original: number };

type InputState = {
	view: NativeJavaReference;
	timers: ReturnType<typeof setTimeout>[];
};

function keyOf(view: NativeJavaReference): string {
	return 'value' in view ? String(view.value) : '';
}

/**
 * @description Converts a `#rrggbb` color to the signed ARGB `int` Android text spans take.
 * @param hex The color.
 * @returns The opaque color as a signed 32-bit integer.
 */
export function androidColor(hex: string): number {
	return 0xff000000 | Number.parseInt(hex.slice(1, 7), 16) | 0;
}

/**
 * @description Paints mentions typed in Discord's native Android chat input with the mentioned member's role color, by recoloring the mention span Discord puts on each `@name`.
 * @param native The Java and hooks bridges from `context.native`.
 * @returns A function that removes the hook and gives every recolored span its color back.
 */
export function colorAndroidChatInputMentions({ java, hooks }: Native): () => Promise<void> {
	const mentionSpan = java.getClass(MENTION_SPAN);
	const reflectArray = java.getClass('java.lang.reflect.Array');

	if (!mentionSpan || !reflectArray) {
		console.error(
			`[${PLUGIN_NAME}: composer mentions] Skipped, the mention span was not found.`,
		);

		return async () => {};
	}

	const inputs = new Map<string, InputState>();
	const aliases = new Map<string, GuildAliases>();
	const recolored = new Map<string, Recolored>();
	let stopped = false;

	function aliasesFor(guildId: string): GuildAliases {
		const cached = aliases.get(guildId) ?? guildAliases(guildId);

		aliases.set(guildId, cached);

		return cached;
	}

	function spansIn(editable: NativeJavaReference, start: number, end: number) {
		const array = javaReference(
			java.invoke(editable, 'getSpans', [javaInt(start), javaInt(end), mentionSpan!]),
		);
		const length = array
			? (javaNumber(java.invoke(reflectArray!, 'getLength', [array])) ?? 0)
			: 0;
		const spans: NativeJavaReference[] = [];

		for (let index = 0; index < length; index++) {
			const span = javaReference(java.invoke(reflectArray!, 'get', [array!, javaInt(index)]));

			if (span && javaNumber(java.invoke(editable, 'getSpanStart', [span])) === start) {
				spans.push(span);
			}
		}

		return spans;
	}

	function recolor(span: NativeJavaReference, color: number): boolean {
		const current = javaNumber(java.getField(span, COLOR_FIELD));

		if (current === undefined || current === color) return false;

		const key = keyOf(span);

		if (!recolored.has(key)) recolored.set(key, { span, original: current });

		java.setField(span, COLOR_FIELD, javaInt(color));

		return true;
	}

	// The input caches its drawn text, so a span only redraws once it is set again.
	async function refresh(editable: NativeJavaReference, span: NativeJavaReference) {
		const start = java.invoke(editable, 'getSpanStart', [span]);
		const end = java.invoke(editable, 'getSpanEnd', [span]);
		const flags = java.invoke(editable, 'getSpanFlags', [span]);

		if ((javaNumber(start) ?? -1) < 0) return;

		await java.invokeAsync(editable, 'setSpan', [span, start, end, flags]);
	}

	async function paint(view: NativeJavaReference) {
		const guildId = currentGuildId();
		const editable = javaReference(java.invoke(view, 'getText', []));
		const text = editable ? javaText(java.invoke(editable, 'toString', [])) : undefined;

		if (!guildId || !editable || !text?.includes('@') || stopped) return;

		for (const mention of composerMentions(text, aliasesFor(guildId))) {
			const member = GuildMemberStore.getMember(guildId, mention.userId);
			const [hex] = getRoleColorAppearance(member?.colorStrings, member?.colorString).colors;

			if (!hex) continue;

			for (const span of spansIn(editable, mention.start, mention.end)) {
				if (recolor(span, androidColor(hex)) && !stopped) await refresh(editable, span);
			}
		}
	}

	function schedule(view: NativeJavaReference) {
		const key = keyOf(view);
		const state = inputs.get(key) ?? { view, timers: [] };

		inputs.set(key, state);

		for (const timer of state.timers) clearTimeout(timer);

		state.timers = PAINT_DELAYS_MS.map((delay) =>
			setTimeout(() => {
				paint(view).catch((error) => {
					console.error(`[${PLUGIN_NAME}: composer mentions] Failed to paint:`, error);
				});
			}, delay),
		);
	}

	const token = hooks.hook(
		CHAT_INPUT,
		'onSelectionChanged',
		['int', 'int'],
		{ notify: true },
		({ self }) => {
			const view = javaReference(self);

			if (view && !stopped) schedule(view);
		},
	);

	return async () => {
		stopped = true;
		hooks.remove(token);

		for (const state of inputs.values()) {
			for (const timer of state.timers) clearTimeout(timer);
		}

		for (const { span, original } of recolored.values()) {
			try {
				java.setField(span, COLOR_FIELD, javaInt(original));
			} catch (error) {
				console.warn(
					`[${PLUGIN_NAME}: composer mentions] Could not restore a mention:`,
					error,
				);
			}
		}

		for (const state of inputs.values()) {
			const editable = javaReference(java.invoke(state.view, 'getText', []));

			for (const { span } of recolored.values()) {
				if (editable) await refresh(editable, span).catch(() => undefined);
			}
		}

		inputs.clear();
		aliases.clear();
		recolored.clear();
	};
}

export default colorAndroidChatInputMentions;
