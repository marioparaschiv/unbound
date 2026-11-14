import { javaInt, javaNumber } from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';

import { scaleMeasureSpec } from '~/lib/scale';

const STICKER_VIEW = 'com.discord.sticker.StickerView';
const STATE_KEY = '__unboundStickerSizes';

type MeasureEvent = { args: NativeJavaValue[] };

function state(): { scale: number } {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, { scale: number } | undefined>;

	return (holder[STATE_KEY] ??= { scale: 1 });
}

/**
 * @description Measures stickers at the chosen scale. Hooks `StickerView.onMeasure` and runs it with both specs scaled to
 * exact sizes, so the sticker and the row it sits in lay out at the new size.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param scale The factor to start with.
 */
export function installStickerScale(scope: NativeUIScope, scale: number) {
	'worklet';
	const hooks = scope.hooks as NativeJavaHooksBridge;

	state().scale = scale;

	hooks.hook(
		STICKER_VIEW,
		'onMeasure',
		['int', 'int'],
		{ rewriteArguments: true, waitForClass: true },
		(event: MeasureEvent) => {
			const { scale: current } = state();
			const width = javaNumber(event.args[0]);
			const height = javaNumber(event.args[1]);

			if (current === 1 || width === undefined || height === undefined) return;

			return {
				arguments: [
					javaInt(scaleMeasureSpec(width, current)),
					javaInt(scaleMeasureSpec(height, current)),
				],
			};
		},
	);
}

/**
 * @description Sets the scale the next layout uses.
 * @param scale The factor.
 */
export function setStickerScale(scale: number) {
	'worklet';
	state().scale = scale;
}
