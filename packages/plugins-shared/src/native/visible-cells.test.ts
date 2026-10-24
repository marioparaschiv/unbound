import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { expect, test } from 'bun:test';

import { findVisibleCells } from './visible-cells';

type View = NativeObjectHandle & { id: string };

function view(id: string): View {
	return Object.assign(Object.create(null) as NativeObjectHandle, { id });
}

function cancelable<T>(value: T) {
	return Object.assign(Promise.resolve(value), { cancel() {} });
}

function bridge(windows: View[], keyWindow: View | null, cells: Record<string, View[]>) {
	const objc: Pick<
		NativeObjCBridge,
		'array' | 'batch' | 'call' | 'className' | 'findViews' | 'getClass' | 'invoke'
	> = {
		getClass: () => view('UIApplication'),
		batch: () => cancelable([null, windows, keyWindow]),
		findViews: (window) => cancelable(cells[(window as View).id] ?? []),
		array: () => [],
		className: () => 'UIView',
		call: (handle) => (handle as View).id,
		invoke: () => null,
	};

	return objc as NativeObjCBridge;
}

test('scans the key window once when it is also in the window list', async () => {
	const main = view('main');
	const objc = bridge([main], view('main'), { main: [view('a'), view('b')] });

	expect((await findVisibleCells(objc, 'Cell')).map((cell) => (cell as View).id)).toEqual([
		'a',
		'b',
	]);
});

test('returns each cell once across windows', async () => {
	const objc = bridge([view('main'), view('sheet')], null, {
		main: [view('a')],
		sheet: [view('a'), view('c')],
	});

	expect((await findVisibleCells(objc, 'Cell')).map((cell) => (cell as View).id)).toEqual([
		'a',
		'c',
	]);
});

test('returns nothing once aborted', async () => {
	const objc = bridge([view('main')], null, { main: [view('a')] });

	expect(await findVisibleCells(objc, 'Cell', AbortSignal.abort())).toEqual([]);
});
