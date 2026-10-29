import type { NativeObjectHandle } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import {
	ATTACHMENT_CHARACTER,
	attributeRun,
	imageAttachment,
	isAttachmentRun,
	isTappableRun,
	isTextBoundary,
	placeAttachedViews,
	removeAttachedViews,
	textEngine,
	viewAttachment,
	type TextAttachmentArgument,
	type TextAttachmentBridge,
} from './text-attachments';

type Call = { target: NativeObjectHandle; selector: string; args: TextAttachmentArgument[] };

type BridgeOptions = {
	textView?: boolean;
	classes?: string[];
	runs?: boolean[];
	superview?: NativeObjectHandle;
	emptyRect?: boolean;
};

type Named = { name?: string };

const CODE = 'ContentNodeAttribute:DrawingDataLayers';

const FONT_METRICS: Record<string, number> = { capHeight: 10, ascender: 12, descender: -4 };

function handle(name: string): NativeObjectHandle {
	return Object.assign(Object.create(null), { name });
}

function isNamed(value: unknown): value is Named {
	return typeof value === 'object' && value !== null && 'name' in value;
}

function nameOf(value: NativeObjectHandle | null | undefined): string | undefined {
	return isNamed(value) ? value.name : undefined;
}

function createBridge(options: BridgeOptions = {}) {
	const calls: Call[] = [];
	const asyncCalls: Call[] = [];
	const runs = options.runs ?? [];
	const available = new Set(
		options.classes ?? ['NSTextAttachment', 'YYTextAttachment', 'YYTextRunDelegate'],
	);
	const textViewClass = handle('UITextView');
	const bridge: TextAttachmentBridge = {
		call(target, selector, ...args) {
			calls.push({ target, selector, args });

			if (selector === 'isKindOfClass:') {
				return options.textView === true && args[0] === textViewClass;
			}

			if (selector in FONT_METRICS) {
				return FONT_METRICS[selector];
			}

			if (selector === 'CTRunDelegate') {
				return handle('CTRunDelegateRef');
			}

			if (selector === 'length') {
				return runs.length;
			}

			if (selector === 'attributesAtIndex:effectiveRange:') {
				return runs[Number(args[0])] ? { [CODE]: handle('layers') } : {};
			}

			if (selector === 'layoutManager' || selector === 'textContainer') {
				return handle(selector);
			}

			if (selector === 'glyphIndexForCharacterAtIndex:') {
				return Number(args[0]) + 100;
			}

			if (selector === 'boundingRectForGlyphRange:inTextContainer:') {
				return options.emptyRect === true
					? { value: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } }
					: { value: { origin: { x: 0, y: 29 }, size: { width: 279, height: 90 } } };
			}

			if (selector === 'textContainerInset') {
				return { value: { top: 4, left: 2, bottom: 0, right: 0 } };
			}

			if (selector === 'superview') {
				return options.superview ?? null;
			}

			return undefined;
		},
		getClass(name) {
			if (name === 'UITextView') {
				return textViewClass;
			}

			return available.has(name) ? handle(name) : null;
		},
		alloc(classOrName) {
			const name = typeof classOrName === 'string' ? classOrName : nameOf(classOrName);

			return handle(`instance:${name}`);
		},
		struct(name, value) {
			return Object.assign(Object.create(null), { struct: name, value });
		},
		callAsync(target, selector, ...args) {
			asyncCalls.push({ target, selector, args });

			return Promise.resolve(null);
		},
	};

	return { bridge, calls, asyncCalls };
}

function selectorsOn(calls: Call[], name: string): string[] {
	return calls.filter((call) => nameOf(call.target) === name).map((call) => call.selector);
}

describe('message text engines', () => {
	test('treats a UITextView subclass as TextKit', () => {
		const { bridge } = createBridge({ textView: true });

		expect(textEngine(bridge, handle('DCDAttributedTextView'))).toBe('textkit');
	});

	test('treats any other text view as YYText', () => {
		const { bridge } = createBridge({ textView: false });

		expect(textEngine(bridge, handle('DCDReusableYYLabel'))).toBe('yytext');
	});

	test('recognises a tappable run from either engine', () => {
		expect(isTappableRun({ YYTextHighlight: handle('h') })).toBe(true);
		expect(isTappableRun({ 'ContentNodeAttribute:TappableHighlight': handle('h') })).toBe(true);
		expect(isTappableRun({ NSFont: handle('f') })).toBe(false);
		expect(isTappableRun(null)).toBe(false);
	});

	test('recognises an attachment run from either engine', () => {
		expect(isAttachmentRun({ YYTextAttachment: handle('a') })).toBe(true);
		expect(isAttachmentRun({ NSAttachment: handle('a') })).toBe(true);
		expect(isAttachmentRun({ NSFont: handle('f') })).toBe(false);
		expect(isAttachmentRun(undefined)).toBe(false);
	});
});

describe('text boundaries', () => {
	test("ends a run at whitespace, the end of the text, or Discord's invisible formatting", () => {
		for (const character of [
			undefined,
			'',
			' ',
			'\n',
			'\u2060',
			'\u2068',
			'\u2069',
			'\u200B',
			'\uFEFF',
		]) {
			expect(isTextBoundary(character)).toBe(true);
		}
	});

	test('does not end a run at a visible character', () => {
		for (const character of ['a', '@', '.', 'á', '1']) {
			expect(isTextBoundary(character)).toBe(false);
		}
	});
});

describe('image attachments', () => {
	const font = handle('font');
	const image = handle('image');

	test('builds a TextKit attachment sized and centred on the cap height', () => {
		const { bridge, calls } = createBridge();
		const result = imageAttachment(bridge, 'textkit', {
			attributes: { NSFont: font },
			image,
			size: 16,
			trailing: 4,
		});

		expect(result).not.toBeNull();
		expect(selectorsOn(calls, 'instance:NSTextAttachment')).toEqual([
			'init',
			'setImage:',
			'setBounds:',
		]);

		const bounds = calls.find((call) => call.selector === 'setBounds:')?.args[0] as {
			value: { origin: { y: number }; size: { width: number; height: number } };
		};

		expect(bounds.value.size).toEqual({ width: 16, height: 16 });
		expect(bounds.value.origin.y).toBe(-3);

		const string = calls.find((call) => call.selector === 'initWithString:attributes:');

		expect(string?.args[0]).toBe(ATTACHMENT_CHARACTER);

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['NSAttachment', 'NSKern']);
	});

	test('omits spacing on TextKit when no trailing gap is asked for', () => {
		const { bridge, calls } = createBridge();

		imageAttachment(bridge, 'textkit', { attributes: { NSFont: font }, image, size: 16 });

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['NSAttachment']);
	});

	test('builds a YYText attachment with a run delegate reserving its width', () => {
		const { bridge, calls } = createBridge();
		const result = imageAttachment(bridge, 'yytext', {
			attributes: { NSFont: font },
			image,
			leading: 2,
			size: 16,
			trailing: 4,
		});

		expect(result).not.toBeNull();

		const values = calls
			.filter((call) => call.selector === 'setValue:forKey:')
			.map((call) => call.args[1]);

		expect(values).toContain('content');
		expect(values).toContain('width');

		const width = calls.find(
			(call) => call.selector === 'setValue:forKey:' && call.args[1] === 'width',
		);

		expect(width?.args[0]).toBe(22);

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['YYTextAttachment', 'CTRunDelegate']);
	});

	test('returns null when the engine has no attachment class', () => {
		const { bridge } = createBridge({ classes: [] });

		expect(imageAttachment(bridge, 'textkit', { attributes: {}, image, size: 16 })).toBeNull();
		expect(imageAttachment(bridge, 'yytext', { attributes: {}, image, size: 16 })).toBeNull();
	});

	test('centres on a zero cap height when the attributes carry no font', () => {
		const { bridge, calls } = createBridge();

		imageAttachment(bridge, 'textkit', { attributes: {}, image, size: 16 });

		const bounds = calls.find((call) => call.selector === 'setBounds:')?.args[0] as {
			value: { origin: { y: number } };
		};

		expect(bounds.value.origin.y).toBe(-8);
	});
});

describe('view attachments', () => {
	const view = handle('view');

	test('reserves room on TextKit with a blank image of the view size', () => {
		const { bridge, calls } = createBridge();
		const result = viewAttachment(bridge, 'textkit', {
			attributes: {},
			view,
			width: 279,
			height: 90,
		});

		expect(result).not.toBeNull();
		expect(selectorsOn(calls, 'instance:NSTextAttachment')).toEqual([
			'init',
			'setImage:',
			'setBounds:',
		]);

		const bounds = calls.find((call) => call.selector === 'setBounds:')?.args[0] as {
			value: { size: { width: number; height: number } };
		};

		expect(bounds.value.size).toEqual({ width: 279, height: 90 });
		expect(calls.some((call) => call.args.includes(view))).toBe(false);
	});

	test('hosts the view itself on YYText', () => {
		const { bridge, calls } = createBridge();

		viewAttachment(bridge, 'yytext', { attributes: {}, view, width: 279, height: 90 });

		const content = calls.find(
			(call) => call.selector === 'setValue:forKey:' && call.args[1] === 'content',
		);

		expect(content?.args[0]).toBe(view);

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['YYTextAttachment', 'CTRunDelegate']);
	});
});

describe('attribute runs', () => {
	const text = handle('text');

	test('widens a range to the whole run carrying the attribute', () => {
		const { bridge } = createBridge({
			runs: [false, true, true, true, true, true, false],
		});

		expect(attributeRun(bridge, text, { start: 2, end: 4 }, CODE)).toEqual({
			start: 1,
			end: 6,
		});
	});

	test('keeps a range whose start lacks the attribute', () => {
		const { bridge } = createBridge({ runs: [false, false, true] });

		expect(attributeRun(bridge, text, { start: 0, end: 2 }, CODE)).toEqual({
			start: 0,
			end: 2,
		});
	});
});

describe('attached view placement', () => {
	const textView = handle('textView');
	const view = handle('card');

	test('frames the view over its glyph, offset by the container inset, and adds it', async () => {
		const { bridge, asyncCalls } = createBridge();

		await placeAttachedViews(bridge, textView, [{ view, index: 21 }]);

		expect(asyncCalls.map((call) => call.selector)).toEqual(['setFrame:', 'addSubview:']);

		const frame = asyncCalls[0]?.args[0] as {
			value: { origin: { x: number; y: number }; size: { width: number; height: number } };
		};

		expect(frame.value).toEqual({ origin: { x: 2, y: 33 }, size: { width: 279, height: 90 } });
	});

	test('leaves a view alone while its attachment is not laid out', async () => {
		const { bridge, asyncCalls } = createBridge({ emptyRect: true });

		await placeAttachedViews(bridge, textView, [{ view, index: 21 }]);

		expect(asyncCalls).toEqual([]);
	});

	test('only reframes a view already inside the text view', async () => {
		const { bridge, asyncCalls } = createBridge({ superview: textView });

		await placeAttachedViews(bridge, textView, [{ view, index: 21 }]);

		expect(asyncCalls.map((call) => call.selector)).toEqual(['setFrame:']);
	});

	test('removes views from their superview', async () => {
		const { bridge, asyncCalls } = createBridge();

		await removeAttachedViews(bridge, [view]);

		expect(asyncCalls.map((call) => call.selector)).toEqual(['removeFromSuperview']);
	});
});
