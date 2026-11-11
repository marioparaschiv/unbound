import { metro, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { startReviewdb } from './helpers/start-reviewdb';
const opened: string[] = [];

// Imported after the plugin starts, so it shares the modules the plugin found.
let actions: typeof import('~/actions');

beforeEach(async () => {
	opened.length = 0;
	metro.register({
		openURL: async (url: string) => void opened.push(url),
		openSettings: () => {},
	});
	await startReviewdb();
	actions = await import('~/actions');
});

afterEach(stopPlugin);

describe('the settings links', () => {
	test('the website opens in the browser', async () => {
		await actions.openWebsite();

		expect(opened).toEqual(['https://reviewdb.mantikafasi.dev']);
	});

	test('the support server opens its invite', async () => {
		await actions.openSupportServer();

		expect(opened).toEqual(['https://discord.gg/eWPBSbvznt']);
	});
});
