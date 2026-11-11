import { describe, expect, test } from 'bun:test';

import reloadCommand from '~/commands/debug/reload';
import { parse } from '~/lib/schema';

import { RecordingController } from '../../helpers/recording-controller';

describe('reload command', () => {
	test('lowers every eval for Hermes, including the freshness probe', async () => {
		const client = new RecordingController((code) =>
			code.includes('reload()') ? 'reloading' : 'fresh',
		);

		const output = await reloadCommand.handler(parse(reloadCommand.schema, {}), { client });

		expect(output.ok).toBe(true);
		expect(client.sent).toHaveLength(2);

		for (const { code } of client.sent) {
			expect(code).not.toMatch(/\b(const|let)\b/);
		}
	});
});
