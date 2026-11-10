import { describe, expect, test } from 'bun:test';

import { RecordingController } from '../helpers/recording-controller';
import { RECORDING_GRACE_MS } from '~/lib/device';
import hookCommand from '~/commands/hook';
import { parse } from '~/lib/schema';

describe('hook command', () => {
	test('lets the device record for the whole duration', async () => {
		const client = new RecordingController();
		const input = parse(hookCommand.schema, {
			className: 'android.widget.TextView',
			method: 'setText',
			duration: 30_000,
		});

		await hookCommand.handler(input, { client });

		expect(client.sent.map((sent) => sent.timeout)).toEqual([30_000 + RECORDING_GRACE_MS]);
	});
});
