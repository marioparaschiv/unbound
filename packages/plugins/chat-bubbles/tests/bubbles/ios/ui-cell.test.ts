import { describe, expect, test } from 'bun:test';

import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { paintCell, resetCell, type CellState, type PaintedCell } from '~/bubbles/ios/ui-cell';

type Rect = { origin: { x: number; y: number }; size: { width: number; height: number } };

type FakeView = {
	className: string;
	tag: number;
	alpha: number;
	hidden: boolean;
	frame: Rect;
	bounds: Rect;
	subviews: FakeView[];
	layer: Record<string, unknown>;
	ivars: Record<string, unknown>;
	image?: string;
};

const rect = (x: number, y: number, width: number, height: number): Rect => ({
	origin: { x, y },
	size: { width, height },
});

function view(className = 'UIView', frame = rect(0, 0, 0, 0)): FakeView {
	return {
		className,
		tag: 0,
		alpha: 1,
		hidden: false,
		frame,
		bounds: rect(0, 0, frame.size.width, frame.size.height),
		subviews: [],
		layer: { cornerRadius: 0 },
		ivars: {},
	};
}

function find(root: FakeView, tag: number): FakeView | null {
	for (const sub of root.subviews) {
		if (sub.tag === tag) return sub;

		const found = find(sub, tag);

		if (found) return found;
	}

	return null;
}

// UNKNOWN: the bridge passes whatever the selector takes.
function send(target: FakeView, selector: string, args: unknown[]): unknown {
	const [arg] = args;
	const setter = (key: string) => {
		Reflect.set(target, key, arg);

		return null;
	};

	switch (selector) {
		case 'new':
			return view(target.className);
		case 'layer':
			return target.layer;
		// The fake's view model and message answer `message` and `id` as plain properties.
		case 'message':
		case 'id':
		case 'contents':
		case 'cornerRadius':
		case 'mask':
			return Reflect.get(target, selector) ?? null;
		case 'setContents:':
		case 'setCornerRadius:':
		case 'setMask:':
		case 'setMasksToBounds:':
			return setter(selector.slice(3, 4).toLowerCase() + selector.slice(4, -1));
		case 'viewWithTag:':
			return find(target, arg as number);
		case 'subviews':
			return target.subviews;
		case 'addSubview:':
			target.subviews.push(arg as FakeView);

			return null;
		case 'bounds':
		case 'frame':
		case 'image':
			return target[selector] ?? null;
		case 'isHidden':
			return target.hidden;
		case 'convertRect:toView:':
			return rect(16, 0, 40, 40);
		case 'setTag:':
		case 'setAlpha:':
		case 'setHidden:':
		case 'setFrame:':
		case 'setBounds:':
		case 'setImage:':
			return setter(selector.slice(3, 4).toLowerCase() + selector.slice(4, -1));
		default:
			return null;
	}
}

function fakeObjC() {
	const bridge = {
		getClass: (name: string) => view(name),
		getIvar: (target: FakeView, name: string) => target.ivars[name] ?? null,
		className: (target: FakeView) => target.className,
		struct: (_name: string, value: unknown) => value,
		array: (list: unknown) => list,
		invoke: (target: FakeView, selector: string, args: unknown[]) =>
			send(target, selector, args),
		call: (target: FakeView, selector: string, ...args: unknown[]) =>
			send(target, selector, args),
	};

	return bridge as unknown as NativeObjCBridge;
}

function cell(id: string, picture?: string): FakeView {
	const row = view('DCDMessageTableViewCell');
	const avatar = view('DCDAvatarView', rect(0, 0, 40, 40));
	const decoration = view('DCDDecorationView', rect(-4, -4, 48, 48));

	avatar.layer = { contents: picture, cornerRadius: 20 };
	decoration.image = picture && `${picture} ring`;
	row.ivars = {
		viewModel: { message: { id } },
		_avatarView: avatar,
		_decorationView: decoration,
		_avatarWrapperView: view(),
		_messageHeaderView: view('UIView', rect(0, 0, 346, 22)),
		_headerView: view(),
	};

	return row;
}

const handle = (fake: unknown) => fake as NativeObjectHandle;
const state = (): CellState => ({ pictures: new Map(), waiting: new Map() });
const none = { x: 0, y: 0 };
const painted = (author: string, start: boolean, end: boolean): PaintedCell => ({
	x: 68,
	y: 0,
	width: 100,
	height: 60,
	paint: { name: { x: 14, y: -10 }, avatar: none, reply: none, picture: { author, start, end } },
});

describe('ui cell', () => {
	test("moves the name's drawing and hides the first row's avatar, then draws it with its decoration by the last bubble", () => {
		const objc = fakeObjC();
		const cells = state();
		const cache = new Map([
			['1', painted('low', true, false)],
			['2', painted('low', false, true)],
		]);
		const first = cell('1', 'picture');
		const last = cell('2');

		paintCell(objc, cells, cache, handle(first), null, cache.get('1')!, '1');
		paintCell(objc, cells, cache, handle(last), null, cache.get('2')!, '2');

		const copy = find(last, 0x0b0b26);

		expect((first.ivars._messageHeaderView as FakeView).bounds.origin).toEqual({
			x: -14,
			y: 10,
		});
		expect((first.ivars._avatarWrapperView as FakeView).alpha).toBe(0);
		expect(copy?.frame).toEqual(rect(16, 20, 40, 40));
		expect(find(last, 0x0b0b27)?.layer).toMatchObject({
			contents: 'picture',
			cornerRadius: 20,
		});
		expect(find(last, 0x0b0b28)).toMatchObject({
			image: 'picture ring',
			frame: rect(-4, -4, 48, 48),
		});
	});

	test("draws a waiting last row once its group's first row shows the picture", () => {
		const objc = fakeObjC();
		const cells = state();
		const cache = new Map([
			['1', painted('low', true, false)],
			['2', painted('low', false, true)],
		]);
		const last = cell('2');

		paintCell(objc, cells, cache, handle(last), null, cache.get('2')!, '2');

		expect(find(last, 0x0b0b26)).toBeNull();

		paintCell(objc, cells, cache, handle(cell('1', 'picture')), null, cache.get('1')!, '1');

		expect(find(last, 0x0b0b26)?.hidden).toBe(false);
	});

	test("gives a reused cell back Discord's layout", () => {
		const objc = fakeObjC();
		const cache = new Map([['1', painted('low', true, true)]]);
		const row = cell('1', 'picture');

		paintCell(objc, state(), cache, handle(row), null, cache.get('1')!, '1');
		resetCell(objc, handle(row));

		expect((row.ivars._messageHeaderView as FakeView).bounds.origin).toEqual(none);
		expect((row.ivars._avatarWrapperView as FakeView).alpha).toBe(1);
		expect(find(row, 0x0b0b26)?.hidden).toBe(true);
	});
});
