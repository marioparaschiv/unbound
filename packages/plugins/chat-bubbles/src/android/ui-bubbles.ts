import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const STATE_KEY = '__unboundChatBubblesAndroid';
const MAX_CACHED = 400;
const WIDTH_TOLERANCE = 1;

export type BindGuard = {
	messageView: string;
	bindName: string;
	bindParameters: string[];
	messageIdGetter: string;
	layerId: number;
	ours: NativeJavaAssociationKey;
	original: NativeJavaAssociationKey;
	drawnFor: NativeJavaAssociationKey;
};

export type CachedBubble = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	radius: number;
	color: number;
	rowWidth: number;
};

type BindEvent = {
	self?: NativeJavaValue;
	args?: NativeJavaValue[];
};

type BubbleState = {
	cache: Map<string, CachedBubble>;
};

type StateHolder = Record<typeof STATE_KEY, BubbleState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function boundMessageId(
	java: NativeJavaBridge,
	event: BindEvent,
	getter: string,
): string | undefined {
	'worklet';
	const message = event.args ? javaReference(event.args[0]) : null;

	return message ? javaText(java.invoke(message, getter, [])) : undefined;
}

function drawCached(
	java: NativeJavaBridge,
	guard: BindGuard,
	row: NativeJavaReference,
	messageId: string,
	cached: CachedBubble,
) {
	'worklet';
	const shape = java.construct('android.graphics.drawable.GradientDrawable', []);

	java.invoke(shape, 'setCornerRadius', [javaFloat(cached.radius)]);
	java.invoke(shape, 'setColor', [javaInt(cached.color)]);

	const bubble = java.construct('android.graphics.drawable.LayerDrawable', [
		{ type: 'array', componentType: 'android.graphics.drawable.Drawable', value: [shape] },
	]);

	java.invoke(bubble, 'setId', [javaInt(0), javaInt(guard.layerId)]);
	java.invoke(bubble, 'setLayerInset', [
		javaInt(0),
		javaInt(cached.left),
		javaInt(cached.top),
		javaInt(cached.right),
		javaInt(cached.bottom),
	]);
	java.invoke(bubble, 'setPadding', [javaInt(0), javaInt(0), javaInt(0), javaInt(0)]);

	if (!javaReference(java.getAssociatedObject(row, guard.ours))) {
		java.setAssociatedObject(row, guard.original, java.invoke(row, 'getBackground', []));
	}

	java.setAssociatedObject(row, guard.ours, bubble);
	java.setAssociatedObject(row, guard.drawnFor, javaString(messageId));
	java.invoke(row, 'setBackground', [bubble]);
}

function restore(java: NativeJavaBridge, guard: BindGuard, row: NativeJavaReference) {
	'worklet';
	const background = javaReference(java.getAssociatedObject(row, guard.original));

	java.setAssociatedObject(row, guard.ours, { type: 'null' });
	java.invoke(row, 'setBackground', [
		background ?? { type: 'null', class: 'android.graphics.drawable.Drawable' },
	]);
}

/**
 * @description Handles each row right after Discord binds it, from a hook that runs on the UI thread: a message whose bubble was already measured gets it at once, and a row moved to a message without a known bubble gets its own background back, so neither an old bubble nor a missing one is ever drawn.
 * @param scope The plugin's UI scope.
 * @param guard The message view class, its bind method, the bound message's id getter, the bubble's layer id, and the keys the bubble, the row's own background and the bubble's message are kept under.
 */
export function installBindGuard(scope: NativeUIScope, guard: BindGuard) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: BubbleState = { cache: new Map() };

	holder()[STATE_KEY] = current;

	hooks.hook(
		guard.messageView,
		guard.bindName,
		guard.bindParameters,
		{ notify: 'after' },
		(event: BindEvent) => {
			const row = javaReference(event.self);

			if (!row) {
				return;
			}

			try {
				const shown = boundMessageId(java, event, guard.messageIdGetter);
				const drawn = javaReference(java.getAssociatedObject(row, guard.ours));
				const drawnFor = javaText(java.getAssociatedObject(row, guard.drawnFor));

				if (drawn && shown && shown === drawnFor) {
					return;
				}

				const cached = shown ? current.cache.get(shown) : undefined;
				const width = javaNumber(java.invoke(row, 'getWidth', []));

				if (
					shown &&
					cached &&
					width !== undefined &&
					Math.abs(width - cached.rowWidth) <= WIDTH_TOLERANCE
				) {
					drawCached(java, guard, row, shown, cached);

					return;
				}

				if (drawn) {
					restore(java, guard, row);
				}
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

/**
 * @description Remembers a message's measured bubble, so the next bind of that message draws it at once.
 * @param messageId The message.
 * @param bubble The bubble's insets, corner radius and color in pixels, and the row width it was measured at.
 */
export function rememberBubble(messageId: string, bubble: CachedBubble) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	current.cache.delete(messageId);
	current.cache.set(messageId, bubble);

	if (current.cache.size > MAX_CACHED) {
		current.cache.delete(current.cache.keys().next().value as string);
	}
}

/**
 * @description Forgets every remembered bubble, after the appearance changes.
 */
export function forgetBubbles() {
	'worklet';
	holder()[STATE_KEY]?.cache.clear();
}

export default { installBindGuard, rememberBubble, forgetBubbles };
