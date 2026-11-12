import type {
	LoaderObjCBridge,
	NativeBatchStep,
	NativeObjCResult,
	NativeObjectHandle,
	NativeStructField,
} from '@unbound-app/types';
import type { ViewDetails, ViewSection } from '@unbound-app/debugger-protocol';

import { asFlag, asNumber, asObject, asStruct, asText } from '~/debugger/objc-values.dev';
import {
	bitNames,
	colorProperty,
	enumName,
	property,
	round,
	section,
	uiColorToHex,
	type PropertyDraft,
} from '~/debugger/view-properties.dev';

const VIEW_SELECTORS = [
	'frame',
	'bounds',
	'center',
	'transform',
	'alpha',
	'isHidden',
	'isOpaque',
	'clipsToBounds',
	'isUserInteractionEnabled',
	'isMultipleTouchEnabled',
	'isExclusiveTouch',
	'tag',
	'contentMode',
	'translatesAutoresizingMaskIntoConstraints',
	'isFirstResponder',
	'safeAreaInsets',
	'layoutMargins',
	'intrinsicContentSize',
	'accessibilityLabel',
	'accessibilityIdentifier',
	'isAccessibilityElement',
	'accessibilityTraits',
	'backgroundColor',
	'tintColor',
	'gestureRecognizers',
	'traitCollection',
	'layer',
] as const;
const LAYER_SELECTORS = [
	'cornerRadius',
	'borderWidth',
	'masksToBounds',
	'opacity',
	'zPosition',
	'shadowOpacity',
	'shadowRadius',
	'shadowOffset',
] as const;
const TEXT_SELECTORS = ['font', 'textColor', 'numberOfLines', 'textAlignment', 'lineBreakMode'];
const SCROLL_SELECTORS = [
	'contentOffset',
	'contentSize',
	'contentInset',
	'adjustedContentInset',
	'isScrollEnabled',
	'isPagingEnabled',
	'bounces',
	'zoomScale',
	'isDragging',
	'isDecelerating',
];
const REACT_SELECTORS = ['reactTag', 'nativeId'];

const CONTENT_MODES = [
	'scaleToFill',
	'scaleAspectFit',
	'scaleAspectFill',
	'redraw',
	'center',
	'top',
	'bottom',
	'left',
	'right',
	'topLeft',
	'topRight',
	'bottomLeft',
	'bottomRight',
];
const ALIGNMENTS = ['left', 'center', 'right', 'justified', 'natural'];
const LINE_BREAKS = [
	'wordWrap',
	'charWrap',
	'clip',
	'truncateHead',
	'truncateTail',
	'truncateMiddle',
];
const TRAITS: Record<number, string> = {
	[1 << 0]: 'button',
	[1 << 1]: 'link',
	[1 << 2]: 'image',
	[1 << 3]: 'selected',
	[1 << 4]: 'playsSound',
	[1 << 5]: 'keyboardKey',
	[1 << 6]: 'staticText',
	[1 << 7]: 'summary',
	[1 << 8]: 'notEnabled',
	[1 << 9]: 'updatesFrequently',
	[1 << 10]: 'searchField',
	[1 << 11]: 'startsMedia',
	[1 << 12]: 'adjustable',
	[1 << 13]: 'allowsDirectInteraction',
	[1 << 14]: 'causesPageTurn',
	[1 << 16]: 'header',
};
const MAX_CLASS_CHAIN = 24;
const MAX_RESPONDERS = 32;

type Read = (selector: string) => NativeObjCResult;

function field(fields: NativeStructField | undefined, name: string): number {
	return typeof fields === 'object' && fields !== null && name in fields
		? Number((fields as Record<string, NativeStructField>)[name])
		: 0;
}

/** Formats a struct's numeric fields in order, rounded, such as a `CGRect` as `x y width height`. */
function structText(value: NativeObjCResult, paths: string[][]): string | null {
	const fields = asStruct(value);

	if (!fields) return null;

	return paths
		.map((path) => {
			const parent = path.length > 1 ? fields[path[0] ?? ''] : fields;

			return round(field(parent, path.at(-1) ?? ''));
		})
		.join(' ');
}

const RECT = [
	['origin', 'x'],
	['origin', 'y'],
	['size', 'width'],
	['size', 'height'],
];
const SIZE = [['width'], ['height']];
const POINT = [['x'], ['y']];
const INSETS = [['top'], ['left'], ['bottom'], ['right']];
const TRANSFORM = [['a'], ['b'], ['c'], ['d'], ['tx'], ['ty']];

/**
 * @description Reads a UIView's class chain and properties: the view and its layer on the main thread in one batch,
 * then its class's extras, and the fonts and colours it returns on the JavaScript thread.
 * @param objc The loader's unscoped Objective-C bridge.
 * @param view The view.
 * @returns The view's details.
 */
export async function readIosDetails(
	objc: LoaderObjCBridge,
	view: NativeObjectHandle,
): Promise<ViewDetails> {
	const layerIndex = VIEW_SELECTORS.indexOf('layer');
	const steps: NativeBatchStep[] = [
		...VIEW_SELECTORS.map((selector) => ({ target: view, selector, args: [] })),
		...LAYER_SELECTORS.map((selector) => ({
			target: { $nativeBatchResult: layerIndex },
			selector,
			args: [],
		})),
	];
	const results = await objc.batch(steps);
	const values = new Map<string, NativeObjCResult>(
		[...VIEW_SELECTORS, ...LAYER_SELECTORS].map((selector, index) => [
			selector,
			results[index],
		]),
	);
	const read: Read = (selector) => values.get(selector);
	const responds = (selectors: string[]) =>
		selectors.filter((selector) => objc.respondsTo(view, selector));
	const isKind = (name: string) => {
		const type = objc.getClass(name);

		return Boolean(type) && asFlag(objc.call(view, 'isKindOfClass:', type));
	};
	const extras = [
		...(responds(TEXT_SELECTORS.slice(0, 2)).length === 2 ? responds(TEXT_SELECTORS) : []),
		...(isKind('UIScrollView') ? SCROLL_SELECTORS : []),
		...(isKind('UIImageView') ? ['image'] : []),
		...responds(REACT_SELECTORS),
	];
	const extraResults = extras.length
		? await objc.batch(extras.map((selector) => ({ target: view, selector, args: [] })))
		: [];

	extras.forEach((selector, index) => values.set(selector, extraResults[index]));

	const traits = asObject(read('traitCollection'));

	// UIColor and UIFont are immutable, so they are read on the JavaScript thread.
	function color(key: string, value: NativeObjCResult) {
		const object = asObject(value);

		if (!object) return colorProperty(key, null);

		const resolved = traits
			? asObject(objc.invoke(object, 'resolvedColorWithTraitCollection:', [traits]))
			: undefined;
		const description = asText(objc.call(resolved ?? object, 'description'));

		const hex = uiColorToHex(description);

		return hex ? colorProperty(key, hex) : property(key, description);
	}

	const number = (selector: string) => round(asNumber(read(selector)) ?? 0);
	const flag = (selector: string) => asFlag(read(selector));
	const has = (selector: string) => values.has(selector);

	function classChain(): string[] {
		const chain: string[] = [];
		let current = asObject(objc.getClass(objc.className(view) ?? ''));

		while (current && chain.length < MAX_CLASS_CHAIN) {
			const name = objc.className(current) ?? '';

			if (!name || name === 'NSObject') break;

			chain.push(name);
			current = asObject(objc.call(current, 'superclass'));
		}

		return chain;
	}

	function viewController(): string | null {
		const controller = objc.getClass('UIViewController');
		let responder = asObject(objc.call(view, 'nextResponder'));

		for (let depth = 0; responder && controller && depth < MAX_RESPONDERS; depth++) {
			if (asFlag(objc.call(responder, 'isKindOfClass:', controller))) {
				return objc.className(responder) ?? null;
			}

			responder = asObject(objc.call(responder, 'nextResponder'));
		}

		return null;
	}

	function layout() {
		const transform = structText(read('transform'), TRANSFORM);

		return section('Layout', [
			property('frame', structText(read('frame'), RECT), 'pt'),
			property('bounds', structText(read('bounds'), RECT), 'pt'),
			property('center', structText(read('center'), POINT), 'pt'),
			property('transform', transform === '1 0 0 1 0 0' ? 'identity' : transform),
			property('intrinsicContentSize', structText(read('intrinsicContentSize'), SIZE), 'pt'),
			property('safeAreaInsets', structText(read('safeAreaInsets'), INSETS), 'pt'),
			property('layoutMargins', structText(read('layoutMargins'), INSETS), 'pt'),
			property('autoresizingConstraints', flag('translatesAutoresizingMaskIntoConstraints')),
		]);
	}

	function state() {
		const recognizers = asObject(read('gestureRecognizers'));
		const names = (recognizers ? objc.array(recognizers) : []).flatMap((item) => {
			const recognizer = asObject(item);

			return recognizer ? (objc.className(recognizer) ?? []) : [];
		});

		return section('State', [
			property('hidden', flag('isHidden')),
			property('alpha', number('alpha')),
			property('userInteractionEnabled', flag('isUserInteractionEnabled')),
			property('multipleTouchEnabled', flag('isMultipleTouchEnabled')),
			property('exclusiveTouch', flag('isExclusiveTouch')),
			property('firstResponder', flag('isFirstResponder')),
			property('gestureRecognizers', names.join(', ') || 'none'),
			property('viewController', viewController()),
			property('tag', number('tag')),
		]);
	}

	function drawing() {
		return section('Drawing', [
			color('backgroundColor', read('backgroundColor')),
			color('tintColor', read('tintColor')),
			property('opaque', flag('isOpaque')),
			property('clipsToBounds', flag('clipsToBounds')),
			property('contentMode', enumName({ ...CONTENT_MODES }, number('contentMode'))),
		]);
	}

	function layer() {
		return section('Layer', [
			property('cornerRadius', number('cornerRadius'), 'pt'),
			property('borderWidth', number('borderWidth'), 'pt'),
			property('masksToBounds', flag('masksToBounds')),
			property('opacity', number('opacity')),
			property('zPosition', number('zPosition')),
			property('shadowOpacity', number('shadowOpacity')),
			property('shadowRadius', number('shadowRadius'), 'pt'),
			property('shadowOffset', structText(read('shadowOffset'), SIZE), 'pt'),
		]);
	}

	function accessibility() {
		return section('Accessibility', [
			property('identifier', asText(read('accessibilityIdentifier')) || null),
			property('label', asText(read('accessibilityLabel')) || null),
			property('element', flag('isAccessibilityElement')),
			property('traits', bitNames(TRAITS, asNumber(read('accessibilityTraits')) ?? 0)),
		]);
	}

	function text() {
		if (!has('font')) return undefined;

		const font = asObject(read('font'));
		const drafts: PropertyDraft[] = [
			property('font', font ? asText(objc.call(font, 'fontName')) : null),
			font
				? property('pointSize', round(asNumber(objc.call(font, 'pointSize')) ?? 0), 'pt')
				: undefined,
			color('textColor', read('textColor')),
			has('numberOfLines') ? property('numberOfLines', number('numberOfLines')) : undefined,
			has('textAlignment')
				? property('textAlignment', enumName({ ...ALIGNMENTS }, number('textAlignment')))
				: undefined,
			has('lineBreakMode')
				? property('lineBreakMode', enumName({ ...LINE_BREAKS }, number('lineBreakMode')))
				: undefined,
		];

		return section('Text', drafts);
	}

	function scroll() {
		if (!has('contentOffset')) return undefined;

		return section('Scroll', [
			property('contentOffset', structText(read('contentOffset'), POINT), 'pt'),
			property('contentSize', structText(read('contentSize'), SIZE), 'pt'),
			property('contentInset', structText(read('contentInset'), INSETS), 'pt'),
			property(
				'adjustedContentInset',
				structText(read('adjustedContentInset'), INSETS),
				'pt',
			),
			property('scrollEnabled', flag('isScrollEnabled')),
			property('pagingEnabled', flag('isPagingEnabled')),
			property('bounces', flag('bounces')),
			property('zoomScale', number('zoomScale')),
			property('dragging', flag('isDragging')),
			property('decelerating', flag('isDecelerating')),
		]);
	}

	function image() {
		if (!has('image')) return undefined;

		const object = asObject(read('image'));

		return section('Image', [
			property('image', object ? (objc.className(object) ?? null) : null),
			object
				? property('size', structText(objc.call(object, 'size'), SIZE), 'pt')
				: undefined,
		]);
	}

	function react() {
		return section('React Native', [
			has('reactTag') ? property('reactTag', asNumber(read('reactTag')) ?? null) : undefined,
			has('nativeId') ? property('nativeID', asText(read('nativeId')) || null) : undefined,
		]);
	}

	const sections = [
		layout(),
		state(),
		drawing(),
		layer(),
		accessibility(),
		text(),
		scroll(),
		image(),
		react(),
	];

	return {
		classChain: classChain(),
		sections: sections.filter((value): value is ViewSection => value !== undefined),
	};
}

export default { readIosDetails };
