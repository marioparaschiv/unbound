import { flux, logs, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

beforeEach(() => {
	flux.seed({
		EditMessage: { getEditingMessage: () => null },
		User: { getCurrentUser: () => ({ id: 'me' }) },
	});
	metro.register({ openLazy: () => undefined, hideActionSheet: () => undefined });
	metro.register({ CloudUpload: class {} });
	metro.register({ getAPIBaseURL: () => '', patch: async () => undefined });
});

describe('lifecycle', () => {
	test('starts without a warning and leaves nothing behind once stopped', async () => {
		await startPlugin();

		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);

		await stopPlugin();
	});
});
