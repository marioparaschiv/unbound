import { expect, test } from 'bun:test';
import { native } from '@unbound-app/api/testing';
import type {
	NativeFabricBatchMutation,
	NativeFabricBridge,
	NativeFabricSize,
} from '@unbound-app/api/native';

import { layoutTooltipSurface } from '~/latency-indicator/ios/tooltip-surface';

test('sizes and positions the tooltip surface in one frame batch', async () => {
	const calls: NativeFabricBatchMutation[][] = [];
	const fabric = {
		batchAsync(mutations: NativeFabricBatchMutation[]) {
			calls.push(mutations);

			return Promise.resolve() as ReturnType<NativeFabricBridge['batchAsync']>;
		},
	} satisfies Pick<NativeFabricBridge, 'batchAsync'>;
	const surface = native.objc.create('UIView');
	const size: NativeFabricSize = { width: 128, height: 64 };

	await layoutTooltipSurface(fabric, surface, size);

	expect(calls).toEqual([
		[
			{
				surface,
				size: { minimum: size, maximum: size },
				frame: { x: 0, y: 0, width: 128, height: 64 },
			},
		],
	]);
});
