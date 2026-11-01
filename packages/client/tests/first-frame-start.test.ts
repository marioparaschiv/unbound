import { beforeEach, describe, expect, test } from 'bun:test';

import { FakeAddons, makeManifest, resetDevice, states } from './helpers/addons';

const { watchFirstFrame } = await import('~/core/first-frame');

let manager: FakeAddons;

beforeEach(() => {
	resetDevice();

	manager = new FakeAddons();
});

function firstFrame(): Promise<void> {
	watchFirstFrame();

	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('starting after the first frame', () => {
	test('holds flagged plugins until Discord draws, skipping one disabled meanwhile', async () => {
		states.early = true;
		states.late = true;
		states.dropped = true;

		manager.load('early', makeManifest('early'));
		manager.load('late', { ...makeManifest('late'), startAfterFirstFrame: true });
		manager.load('dropped', { ...makeManifest('dropped'), startAfterFirstFrame: true });
		states.dropped = false;

		expect(manager.log).toEqual(['start:early']);

		await firstFrame();

		expect(manager.log).toEqual(['start:early', 'start:late']);
	});

	test('starts a flagged plugin right away once Discord has drawn', () => {
		states.after = true;

		manager.load('after', { ...makeManifest('after'), startAfterFirstFrame: true });

		expect(manager.log).toEqual(['start:after']);
	});
});
