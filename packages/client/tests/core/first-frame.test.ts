import { beforeEach, describe, expect, test } from 'bun:test';

import { FakeAddons, makeManifest, resetDevice, states } from '../helpers/addons';

const { afterFirstFrame, watchFirstFrame } = await import('~/core/first-frame');

let manager: FakeAddons;

beforeEach(() => {
	resetDevice();

	manager = new FakeAddons();
});

function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred(id: string) {
	states[id] = true;
	manager.load(id, { ...makeManifest(id), startAfterFirstFrame: true });
}

describe('starting after the first frame', () => {
	test('starts flagged plugins one per task in load order, queueing work added while draining', async () => {
		const order: string[] = [];

		states.early = true;
		states.dropped = true;

		manager.load('early', makeManifest('early'));
		deferred('first');
		manager.load('dropped', { ...makeManifest('dropped'), startAfterFirstFrame: true });
		deferred('second');
		deferred('third');
		states.dropped = false;

		afterFirstFrame(() => {
			order.push('outer');
			afterFirstFrame(() => order.push('nested'));
		});

		expect(manager.log).toEqual(['start:early']);

		watchFirstFrame();
		await nextTask();

		expect(manager.log).toEqual(['start:early', 'start:first']);

		await nextTask();
		await nextTask();

		expect(manager.log).toEqual(['start:early', 'start:first', 'start:second']);

		await nextTask();

		expect(manager.log).toEqual(['start:early', 'start:first', 'start:second', 'start:third']);
		expect(order).toEqual([]);

		await nextTask();

		expect(order).toEqual(['outer']);

		await nextTask();

		expect(order).toEqual(['outer', 'nested']);
	});

	test('starts a flagged plugin right away once every deferred start has run', () => {
		states.after = true;

		manager.load('after', { ...makeManifest('after'), startAfterFirstFrame: true });

		expect(manager.log).toEqual(['start:after']);
	});

	test('ignores a second first-frame watch', async () => {
		watchFirstFrame();
		await nextTask();

		const ran: string[] = [];

		afterFirstFrame(() => ran.push('now'));

		expect(ran).toEqual(['now']);
	});
});
