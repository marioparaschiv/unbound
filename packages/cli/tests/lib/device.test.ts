import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import type { DevicePrelude } from '~/lib/device-prelude';
import { toDeviceCode } from '~/lib/device';

type Limits = { max: number };

describe('toDeviceCode', () => {
	test('calls the probe with the prelude built from unbound, then its JSON arguments', () => {
		function probe(device: DevicePrelude, name: string, limits: Limits) {
			return {
				marker: Reflect.get(device.unbound, 'marker'),
				bridge: device.nativeBridge('ios', ['native.objc.snapshot'])?.id ?? null,
				name,
				max: limits.max,
			};
		}
		const unbound = {
			marker: 'fake',
			plugins: {
				entities: new Map([
					[
						'shiki',
						{
							id: 'shiki',
							started: true,
							context: {
								id: 'shiki',
								platform: 'ios',
								capabilities: ['native.objc.snapshot'],
							},
						},
					],
				]),
			},
		};

		expect(runInNewContext(toDeviceCode(probe, 'views', { max: 3 }), { unbound })).toEqual({
			marker: 'fake',
			bridge: 'shiki',
			name: 'views',
			max: 3,
		});
	});

	test('calls a probe that takes no arguments', () => {
		const probe = (device: DevicePrelude) => device.plugins === undefined;

		expect(runInNewContext(toDeviceCode(probe), { unbound: {} })).toBe(true);
	});
});
