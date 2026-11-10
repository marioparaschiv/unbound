import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { openDevice } from './device';
import { runDevice } from './device-run';
import { readMatrixConfig } from './matrix-config';

const USAGE =
	'Usage: bun packages/plugin-scripts/src/collect-device-matrix.ts --out <dir> [--port 9090] [--serial <adb serial> | --udid <iPhone UDID>] [--only <id,id>] [--device <name>] [--baseline <results.json>] [--channel <guild id>/<channel id>] [--lenient] [--leak-cycles <n>] [--full-leak-check] [--clear-staged]';

/** Runs the matrix on one device given on the command line; `run-device-matrix.ts` runs every configured device. */
async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			port: { type: 'string', default: '9090' },
			out: { type: 'string' },
			serial: { type: 'string' },
			ios: { type: 'boolean' },
			udid: { type: 'string' },
			only: { type: 'string' },
			channel: { type: 'string' },
			device: { type: 'string' },
			baseline: { type: 'string' },
			lenient: { type: 'boolean' },
			'leak-cycles': { type: 'string' },
			'full-leak-check': { type: 'boolean' },
			'clear-staged': { type: 'boolean' },
		},
	});

	if (!values.out) throw new Error(USAGE);

	if (values.ios && !values.udid) throw new Error('Pass --udid with --ios.');

	const out = resolve(values.out);
	const device = openDevice({
		name: values.device ?? (values.udid ? 'iOS' : 'Android'),
		port: Number(values.port),
		serial: values.serial,
		udid: values.udid,
	});

	try {
		const run = await runDevice(device, {
			out,
			channel: values.channel ?? readMatrixConfig()?.channel,
			only: values.only?.split(','),
			baseline: values.baseline ? resolve(values.baseline) : undefined,
			lenient: values.lenient,
			leakCycles: Number(values['leak-cycles'] ?? 0),
			fullLeakCheck: values['full-leak-check'],
			clearStaged: values['clear-staged'],
			log: (line) => console.error(line),
		});

		if (run.error) process.exitCode = 1;
		else console.log(resolve(out, 'matrix.md'));
	} finally {
		device.close();
	}
}

if (import.meta.main) await main();
