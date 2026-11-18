import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { MessageTextSize } from '~/native/text-size';

const LAYOUT_CLASS = 'YYTextLayout';
const LAYOUT_SELECTOR = '+layoutWithContainer:text:';
const RANGE_BYTES = 16;
const LENGTH_OFFSET = 8;
const SAME_SCALE = 0.001;

type ObjC = NativeBridge['objc'];
type FFI = NonNullable<NativeBridge['ffi']>;

function scaledText(
	objc: ObjC,
	ffi: FFI,
	range: ReturnType<FFI['alloc']>,
	text: NativeObjectHandle,
	scale: number,
): NativeObjectHandle {
	const copy = objc.call(text, 'mutableCopy') as NativeObjectHandle;
	const length = Number(objc.call(copy, 'length'));

	for (let index = 0; index < length;) {
		const font = objc.call(
			copy,
			'attribute:atIndex:effectiveRange:',
			'NSFont',
			index,
			range,
		) as NativeObjectHandle | null;
		const location = Number(ffi.read(range, 'u64', 0));
		const runLength = Math.max(1, Number(ffi.read(range, 'u64', LENGTH_OFFSET)));

		if (font) {
			const size = Number(objc.call(font, 'pointSize'));

			objc.call(
				copy,
				'addAttribute:value:range:',
				'NSFont',
				objc.call(font, 'fontWithSize:', size * scale),
				objc.struct('NSRange', { location, length: runLength }),
			);
		}

		index = Math.max(index + 1, location + runLength);
	}

	return copy;
}

/**
 * @description Scales message text on iOS. Discord lays out each message's text with YYText's
 * `+[YYTextLayout layoutWithContainer:text:]` off the main thread, so the hook swaps in a copy of the text with every
 * font scaled before the layout is measured, and the row grows or shrinks with it.
 * @param native The plugin's native bridge.
 * @param scale The factor to start with.
 * @returns `update`, which changes the factor for rows laid out from then on, and `dispose`, which removes the hook.
 */
export function messageTextSizeIOS(native: NativeBridge, scale: number): MessageTextSize {
	const { objc, ffi } = native;
	let current = scale;

	if (!ffi || !objc.getClass(LAYOUT_CLASS)) {
		logger.warn('Message text size skipped: Discord no longer lays out messages with YYText.');

		return { update: () => undefined, dispose: () => undefined };
	}

	const range = ffi.alloc(RANGE_BYTES);
	const hook = objc.hook(LAYOUT_CLASS, LAYOUT_SELECTOR, {
		before: (context) => {
			const text = context.args[1] as NativeObjectHandle | null;

			if (!text || Math.abs(current - 1) < SAME_SCALE) return;

			try {
				context.replaceObjectArgument(1, scaledText(objc, ffi, range, text, current));
			} catch (error) {
				logger.error('Failed to scale a message layout:', error);
			}
		},
	});

	return {
		update(next: number) {
			current = next;
		},
		dispose() {
			hook.remove();
			ffi.free(range);
		},
	};
}

export default messageTextSizeIOS;
