import { describe, expect, test } from 'bun:test';

import traceCommand from '~/commands/debug/trace';
import { RECORDING_GRACE_MS } from '~/lib/device';
import { parse } from '~/lib/schema';

import { RecordingController } from '../../helpers/recording-controller';

describe('trace command', () => {
	test('lets the device record for the whole duration', async () => {
		const client = new RecordingController();
		const input = parse(traceCommand.schema, {
			props: ['generateMessageRowData'],
			duration: 30_000,
		});

		await traceCommand.handler(input, { client });

		expect(client.sent.map((sent) => sent.timeout)).toEqual([30_000 + RECORDING_GRACE_MS]);
	});
});
