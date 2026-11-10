import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { HermesContext } from '~/index';
import hermes from '~/index';

const FAKE_HERMESC = `#!/bin/sh
echo "$@" > "$(dirname "$0")/args"
out=""
map=0
while [ $# -gt 0 ]; do
	case "$1" in
		--out) out="$2"; shift ;;
		-output-source-map) map=1 ;;
	esac
	shift
done
printf 'bytecode' > "$out"
if [ $map = 1 ] && [ -z "$FAKE_SKIP_MAP" ]; then
	printf '{"version":3,"sources":["/tmp/hermesc/123.js"],"names":[],"mappings":"AAAA"}' > "$out.map"
fi
`;

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'rph-compile-'));
	mkdirSync(join(dir, process.platform));

	const binary = join(dir, process.platform, 'hermesc');

	writeFileSync(binary, FAKE_HERMESC);
	chmodSync(binary, 0o755);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

async function build(flags?: string[]) {
	const plugin = hermes({ hermesc: dir, flags });
	const emitted: Record<string, string | Uint8Array> = {};

	const ctx: HermesContext = {
		info: () => {},
		warn: () => {},
		debug: () => {},
		error: (message) => {
			throw new Error(message);
		},
		emitFile: (file) => {
			emitted[file.fileName] = file.source;

			return file.fileName;
		},
	};

	await plugin.generateBundle.call(
		ctx,
		{ file: 'dist/unbound.js' },
		{ 'unbound.js': { type: 'chunk', code: 'throw 1;' } },
		true,
	);
	await plugin.buildEnd.call(ctx);

	const args = readFileSync(join(dir, process.platform, 'args'), 'utf-8')
		.trim()
		.split(' ');

	return { emitted, args };
}

function text(source: string | Uint8Array | undefined): string {
	return typeof source === 'string' ? source : new TextDecoder().decode(source);
}

describe('rollup-plugin-hermes compile', () => {
	test('passes flags to hermesc before the input file', async () => {
		const { args } = await build(['-O', '-g0', '-output-source-map']);

		expect(args.slice(-4, -1)).toEqual(['-O', '-g0', '-output-source-map']);
		expect(args.at(-1)).toMatch(/\.js$/);
	});

	test('emits the source map beside the bundle with the chunk as its source', async () => {
		const { emitted } = await build(['-output-source-map']);
		const map = JSON.parse(text(emitted['unbound.bundle.map']));

		expect(text(emitted['unbound.bundle'])).toBe('bytecode');
		expect(map.sources).toEqual(['unbound.js']);
		expect(map.mappings).toBe('AAAA');
	});

	test('fails when -output-source-map was passed but hermesc wrote no map', async () => {
		process.env.FAKE_SKIP_MAP = '1';

		try {
			const error = await build(['-output-source-map']).then(
				() => undefined,
				(error: Error) => error,
			);

			expect(error?.message).toMatch(/wrote no map/);
		} finally {
			delete process.env.FAKE_SKIP_MAP;
		}
	});

	test('emits no source map without -output-source-map', async () => {
		const { emitted, args } = await build();

		expect(Object.keys(emitted)).toEqual(['unbound.bundle']);
		expect(args).not.toContain('-output-source-map');
	});
});
