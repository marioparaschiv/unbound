import type {
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHandleValue,
	NativeJavaValue,
} from '@unbound-app/types';
import type { ViewDetails, ViewSection } from '@unbound-app/debugger-protocol';

import {
	argbToHex,
	colorProperty,
	enumName,
	layoutSize,
	property,
	round,
	section,
} from '~/debugger/view-properties.dev';
import {
	byName,
	calls,
	handle,
	isTrue,
	number,
	onMain,
	primitive,
	string,
} from '~/debugger/java-values.dev';

const VIEW_CALLS = [
	'getMeasuredWidth',
	'getMeasuredHeight',
	'getPaddingLeft',
	'getPaddingTop',
	'getPaddingRight',
	'getPaddingBottom',
	'getMinimumWidth',
	'getMinimumHeight',
	'getScrollX',
	'getScrollY',
	'getLayoutParams',
	'getTranslationX',
	'getTranslationY',
	'getTranslationZ',
	'getElevation',
	'getRotation',
	'getRotationX',
	'getRotationY',
	'getScaleX',
	'getScaleY',
	'getPivotX',
	'getPivotY',
	'isEnabled',
	'isClickable',
	'isLongClickable',
	'hasOnClickListeners',
	'isFocusable',
	'isFocused',
	'isSelected',
	'isPressed',
	'isActivated',
	'isShown',
	'isAttachedToWindow',
	'isLaidOut',
	'isLayoutRequested',
	'getBackground',
	'getForeground',
	'getLayerType',
	'getClipToOutline',
	'isOpaque',
	'willNotDraw',
	'isHardwareAccelerated',
	'getId',
	'getTag',
	'getContentDescription',
	'getImportantForAccessibility',
] as const;
const GROUP_CALLS = [
	'getChildCount',
	'getClipChildren',
	'getClipToPadding',
	'getDescendantFocusability',
] as const;
const TEXT_CALLS = [
	'getTextSize',
	'getCurrentTextColor',
	'getLineCount',
	'getMaxLines',
	'getLineHeight',
	'getGravity',
	'getEllipsize',
	'getTypeface',
	'getHint',
] as const;
const IMAGE_CALLS = [
	'getScaleType',
	'getDrawable',
	'getImageAlpha',
	'getAdjustViewBounds',
	'getCropToPadding',
] as const;

const LAYER_TYPES = { 0: 'none', 1: 'software', 2: 'hardware' };
const IMPORTANCE = { 0: 'auto', 1: 'yes', 2: 'no', 4: 'noHideDescendants' };
const FOCUSABILITY = {
	0x20000: 'beforeDescendants',
	0x40000: 'afterDescendants',
	0x60000: 'blocksDescendants',
};
const TYPEFACE_STYLES = { 0: 'normal', 1: 'bold', 2: 'italic', 3: 'boldItalic' };
const MAX_CLASS_CHAIN = 24;
const INT_MAX = 2_147_483_647;

/**
 * @description Reads an Android view's class chain and properties: views on the main thread in batches, and the
 * objects they return, such as layout params and drawables, on the JavaScript thread.
 * @param java The loader's unscoped Java bridge.
 * @param view The view.
 * @param density The display's pixels per dp.
 * @returns The view's details.
 */
export async function readAndroidDetails(
	java: NativeJavaBridge,
	view: NativeJavaHandleValue,
	density: number,
): Promise<ViewDetails> {
	const borrowed: (NativeJavaHandleValue | NativeJavaHandle)[] = [];
	const classes = new Map<string, NativeJavaHandle>();

	// `isInstance` reads the class, not the object, so it stays on the JavaScript thread.
	function isA(value: NativeJavaValue | undefined, name: string): boolean {
		const object = handle(value);

		if (!object) {
			return false;
		}

		let type = classes.get(name);

		if (!type) {
			type = java.getClass(name);
			classes.set(name, type);
			borrowed.push(type);
		}

		return isTrue(java.invoke(type, 'isInstance', [object]));
	}

	const kinds = {
		group: isA(view, 'android.view.ViewGroup'),
		text: isA(view, 'android.widget.TextView'),
		image: isA(view, 'android.widget.ImageView'),
	};
	const names = [
		...VIEW_CALLS,
		...(kinds.group ? GROUP_CALLS : []),
		...(kinds.text ? TEXT_CALLS : []),
		...(kinds.image ? IMAGE_CALLS : []),
	];
	const read = byName(names, await onMain(java, calls(view, names)));

	for (const value of read.values()) {
		const object = handle(value);

		if (object) {
			borrowed.push(object);
		}
	}

	// Each call below reads an object a view returned, never the view, so it is safe off the main thread.
	function call(target: NativeJavaValue | undefined, name: string): NativeJavaValue | undefined {
		const object = handle(target);

		if (!object) {
			return undefined;
		}

		try {
			const result = java.invoke(object, name, []);
			const returned = handle(result);

			if (returned) {
				borrowed.push(returned);
			}

			return result;
		} catch {
			// An object can refuse a call, such as a drawable without a colour; read it as unset.
			return undefined;
		}
	}

	function text(value: NativeJavaValue | undefined): string | null {
		if (value?.type === 'string') {
			return value.value;
		}

		return handle(value) ? string(call(value, 'toString')) : null;
	}

	function className(value: NativeJavaValue | undefined): string | null {
		const object = handle(value);

		return object ? string(java.className(object)) || null : null;
	}

	const dp = (name: string) => round(number(read.get(name)), density);
	const flag = (name: string) => isTrue(read.get(name));

	function classChain(): string[] {
		const chain: string[] = [];
		let current = call(view, 'getClass');

		while (handle(current) && chain.length < MAX_CLASS_CHAIN) {
			const name = string(call(current, 'getName'));

			if (!name || name === 'java.lang.Object') {
				break;
			}

			chain.push(name);
			current = call(current, 'getSuperclass');
		}

		return chain;
	}

	function edges(left: string, top: string, right: string, bottom: string): string {
		return [left, top, right, bottom].map((name) => dp(name)).join(' ');
	}

	function layout() {
		const params = read.get('getLayoutParams');

		function field(name: string) {
			const object = handle(params);

			return object ? number(java.getField(object, name)) : 0;
		}
		const margins = isA(params, 'android.view.ViewGroup$MarginLayoutParams')
			? [field('leftMargin'), field('topMargin'), field('rightMargin'), field('bottomMargin')]
					.map((value) => round(value, density))
					.join(' ')
			: undefined;

		return section('Layout', [
			property('measuredWidth', dp('getMeasuredWidth'), 'dp'),
			property('measuredHeight', dp('getMeasuredHeight'), 'dp'),
			property(
				'padding',
				edges('getPaddingLeft', 'getPaddingTop', 'getPaddingRight', 'getPaddingBottom'),
				'dp',
			),
			margins === undefined ? undefined : property('margin', margins, 'dp'),
			handle(params)
				? property('layoutWidth', layoutSize(field('width'), density))
				: undefined,
			handle(params)
				? property('layoutHeight', layoutSize(field('height'), density))
				: undefined,
			property('layoutParams', className(params)),
			property('minimumWidth', dp('getMinimumWidth'), 'dp'),
			property('minimumHeight', dp('getMinimumHeight'), 'dp'),
			property('scrollX', dp('getScrollX'), 'dp'),
			property('scrollY', dp('getScrollY'), 'dp'),
		]);
	}

	function transform() {
		const plain = (name: string) => round(number(read.get(name)), 1);

		return section('Transform', [
			property('translationX', dp('getTranslationX'), 'dp'),
			property('translationY', dp('getTranslationY'), 'dp'),
			property('translationZ', dp('getTranslationZ'), 'dp'),
			property('elevation', dp('getElevation'), 'dp'),
			property('rotation', plain('getRotation'), '°'),
			property('rotationX', plain('getRotationX'), '°'),
			property('rotationY', plain('getRotationY'), '°'),
			property('scaleX', plain('getScaleX')),
			property('scaleY', plain('getScaleY')),
			property('pivotX', dp('getPivotX'), 'dp'),
			property('pivotY', dp('getPivotY'), 'dp'),
		]);
	}

	function state() {
		return section('State', [
			property('enabled', flag('isEnabled')),
			property('clickable', flag('isClickable')),
			property('longClickable', flag('isLongClickable')),
			property('hasClickListener', flag('hasOnClickListeners')),
			property('focusable', flag('isFocusable')),
			property('focused', flag('isFocused')),
			property('selected', flag('isSelected')),
			property('pressed', flag('isPressed')),
			property('activated', flag('isActivated')),
			property('shown', flag('isShown')),
			property('attached', flag('isAttachedToWindow')),
			property('laidOut', flag('isLaidOut')),
			property('layoutRequested', flag('isLayoutRequested')),
		]);
	}

	function drawable(key: string, value: NativeJavaValue | undefined) {
		if (isA(value, 'android.graphics.drawable.ColorDrawable')) {
			return colorProperty(key, argbToHex(number(call(value, 'getColor'))));
		}

		return property(key, className(value));
	}

	function drawing() {
		return section('Drawing', [
			drawable('background', read.get('getBackground')),
			drawable('foreground', read.get('getForeground')),
			property('layerType', enumName(LAYER_TYPES, number(read.get('getLayerType')))),
			property('clipToOutline', flag('getClipToOutline')),
			property('opaque', flag('isOpaque')),
			property('willNotDraw', flag('willNotDraw')),
			property('hardwareAccelerated', flag('isHardwareAccelerated')),
		]);
	}

	function accessibility() {
		return section('Accessibility', [
			property('id', primitive(read.get('getId'))),
			property('contentDescription', text(read.get('getContentDescription'))),
			property(
				'importantForAccessibility',
				enumName(IMPORTANCE, number(read.get('getImportantForAccessibility'))),
			),
			property('tag', text(read.get('getTag'))),
		]);
	}

	function group() {
		return section('ViewGroup', [
			property('childCount', number(read.get('getChildCount'))),
			property('clipChildren', flag('getClipChildren')),
			property('clipToPadding', flag('getClipToPadding')),
			property(
				'descendantFocusability',
				enumName(FOCUSABILITY, number(read.get('getDescendantFocusability'))),
			),
		]);
	}

	function textView() {
		const maxLines = number(read.get('getMaxLines'));
		const typeface = read.get('getTypeface');

		return section('Text', [
			property('textSize', dp('getTextSize'), 'dp'),
			colorProperty('textColor', argbToHex(number(read.get('getCurrentTextColor')))),
			property('lineCount', number(read.get('getLineCount'))),
			property('maxLines', maxLines === INT_MAX ? 'none' : maxLines),
			property('lineHeight', dp('getLineHeight'), 'dp'),
			property('gravity', `0x${number(read.get('getGravity')).toString(16)}`),
			property('ellipsize', text(read.get('getEllipsize'))),
			property(
				'typeface',
				handle(typeface)
					? enumName(TYPEFACE_STYLES, number(call(typeface, 'getStyle')))
					: null,
			),
			property('hint', text(read.get('getHint'))),
		]);
	}

	function imageView() {
		return section('Image', [
			property('scaleType', text(read.get('getScaleType'))),
			property('drawable', className(read.get('getDrawable'))),
			property('imageAlpha', number(read.get('getImageAlpha'))),
			property('adjustViewBounds', flag('getAdjustViewBounds')),
			property('cropToPadding', flag('getCropToPadding')),
		]);
	}

	try {
		const sections = [
			layout(),
			transform(),
			state(),
			drawing(),
			accessibility(),
			kinds.group ? group() : undefined,
			kinds.text ? textView() : undefined,
			kinds.image ? imageView() : undefined,
		].filter((value): value is ViewSection => value !== undefined);

		return { classChain: classChain(), sections };
	} finally {
		for (const object of borrowed) {
			try {
				java.release(object);
			} catch {
				// The loader already freed it with its activity.
			}
		}
	}
}

export default { readAndroidDetails };
