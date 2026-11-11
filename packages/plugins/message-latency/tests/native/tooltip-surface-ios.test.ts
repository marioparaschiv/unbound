import { expect, test } from 'bun:test';
import { native } from '@unbound-app/api/testing';
import type { NativeFabricSize } from '@unbound-app/api/native';

import { layoutTooltipSurface } from '~/native/tooltip-surface-ios';

// `batchAsync` is always present in a plugin's scope; a loader without it gets a stand-in that throws.
function fakeFabric() {
	const calls: [name: string, ...args: unknown[]][] = [];
	const record =
		(name: string) =>
		(...args: unknown[]) => {
			calls.push([name, ...args]);

			return Promise.resolve();
		};
	const fabric = {
		setSizeAsync: record('setSize'),
		setFrameAsync: record('setFrame'),
		batchAsync: record('batch'),
	};

	return { calls, fabric: fabric as never };
}

const size: NativeFabricSize = { width: 128, height: 64 };

test('sizes and positions the tooltip surface in one frame batch on a loader with frame batches', async () => {
	const { calls, fabric } = fakeFabric();
	const surface = native.objc.create('UIView');

	await layoutTooltipSurface(fabric, surface, size);

	expect(calls).toEqual([
		[
			'batch',
			[
				{
					surface,
					size: { minimum: size, maximum: size },
					frame: { x: 0, y: 0, width: 128, height: 64 },
				},
			],
		],
	]);
});

test('sizes then positions the tooltip surface on a loader without frame batches', async () => {
	const { calls, fabric } = fakeFabric();
	const surface = native.objc.create('UIView');

	native.setUnsupportedMethods(['fabric.batchAsync']);
	await layoutTooltipSurface(fabric, surface, size);

	expect(calls).toEqual([
		['setSize', surface, size, size],
		['setFrame', surface, { x: 0, y: 0, width: 128, height: 64 }],
	]);
});
