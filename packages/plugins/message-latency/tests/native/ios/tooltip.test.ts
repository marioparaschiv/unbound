import { afterEach, describe, expect, test } from 'bun:test';
import { metro, native } from '@unbound-app/api/testing';
import type { NativeFabricSize } from '@unbound-app/api/native';

import { createTooltips, type TooltipController } from '~/native/ios/tooltip';

const POLL_MS = 5;
const GIVE_UP_MS = 2000;

type FabricCall = { name: string; args: unknown[] };

const open: TooltipController[] = [];

afterEach(async () => {
	await Promise.all(open.splice(0).map((tooltips) => tooltips.dispose()));
});

// Waits until the fake Fabric bridge saw `count` calls, the last step a shown tooltip takes.
async function settle(calls: FabricCall[], count: number) {
	const deadline = Date.now() + GIVE_UP_MS;

	while (calls.length < count && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

function registerViews() {
	const window = native.objc.create('UIWindow');
	const rect = (x: number, y: number, width: number, height: number) => ({
		origin: { x, y },
		size: { width, height },
	});

	native.objc.registerClass('UIWindow', {
		methods: { bounds: () => rect(0, 0, 400, 800), 'addSubview:': () => undefined },
	});
	native.objc.registerClass('UIView', {
		methods: {
			window: () => window,
			'convertRect:toView:': () => rect(100, 100, 16, 16),
			'setUserInteractionEnabled:': () => undefined,
			'setAccessibilityIdentifier:': () => undefined,
			'setFrame:': () => undefined,
			removeFromSuperview: () => undefined,
		},
	});
	native.objc.registerClass('UILabel', {
		methods: {
			'setText:': () => undefined,
			'setNumberOfLines:': () => undefined,
			'setFont:': () => undefined,
			'sizeThatFits:': () => ({ width: 80, height: 20 }),
		},
	});
	native.objc.registerClass('UIFont', {
		classMethods: { 'systemFontOfSize:': () => native.objc.create('UIFont') },
	});
	metro.register({ TooltipArrowDirections: {}, TooltipArrowPositions: {} });

	return native.objc.create('UIView');
}

// `batchAsync` is always present in a plugin's scope; a loader without it gets a stand-in that throws.
function fakeFabric(batches: boolean) {
	const calls: FabricCall[] = [];
	const surface = native.objc.create('UIView');
	const record =
		(name: string, result?: unknown) =>
		(...args: unknown[]) => {
			calls.push({ name, args });

			return Promise.resolve(result);
		};
	const fabric = {
		mountAsync: record('mount', surface),
		setSizeAsync: record('setSize'),
		setFrameAsync: record('setFrame'),
		unmountAsync: record('unmount'),
		batchAsync: batches
			? record('batch')
			: () => Promise.reject(new Error('Frame-batched Fabric updates are unavailable.')),
	};

	return { calls, fabric, surface };
}

function show(batches: boolean) {
	const icon = registerViews();
	const { calls, fabric, surface } = fakeFabric(batches);
	if (!batches) native.setUnsupportedMethods(['fabric.batchAsync']);

	const tooltips = createTooltips({
		objc: native.objc.bridge,
		fabric: fabric as never,
	});

	if (!tooltips) throw new Error('Failed to create the tooltips: Discord tooltip missing.');

	open.push(tooltips);
	tooltips.show({ cellKey: 'cell', icon, tooltip: 'Took 5s' }, () => true);

	return { calls, surface };
}

describe('the iOS latency tooltip', () => {
	test('sizes and positions the surface one call at a time on a loader without frame batches', async () => {
		const { calls, surface } = show(false);

		await settle(calls, 3);

		const size = calls[1]?.args[1] as NativeFabricSize;

		expect(calls.map((call) => call.name)).toEqual(['mount', 'setSize', 'setFrame']);
		expect(calls[1]?.args).toEqual([surface, size, size]);
		expect(calls[2]?.args).toEqual([surface, { x: 0, y: 0, ...size }]);
	});

	test('sizes and positions the surface in one frame batch on a loader with frame batches', async () => {
		const { calls, surface } = show(true);

		await settle(calls, 2);

		expect(calls.map((call) => call.name)).toEqual(['mount', 'batch']);
		expect(calls[1]?.args).toEqual([
			[
				{
					surface,
					size: { minimum: expect.any(Object), maximum: expect.any(Object) },
					frame: expect.objectContaining({ x: 0, y: 0 }),
				},
			],
		]);
	});
});
