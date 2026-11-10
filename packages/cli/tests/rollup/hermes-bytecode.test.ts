import type { NormalizedOutputOptions, OutputBundle, PluginContext } from 'rollup';
import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';
import { runInThisContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BYTECODE_DIGESTS_FILENAME } from '~/rollup/bytecode-digests-schema';
import { bytecodeSource, hermesBytecode } from '~/rollup/hermes-bytecode';

import { createTempDir } from '../helpers/ubd';

type WriteBundle = (
	this: PluginContext,
	options: Pick<NormalizedOutputOptions, 'dir' | 'file'>,
	bundle: OutputBundle,
) => Promise<void>;

type Factory = (...globals: string[]) => string[];

type OlderClientFactory = (react: string) => [string, boolean, boolean];

test('the bytecode wrapper takes the Addon scope globals in the order the client passes them', () => {
	const factory: Factory = runInThisContext(
		bytecodeSource(`[${ADDON_SCOPE_GLOBALS.join(', ')}]`),
	);

	expect(factory(...ADDON_SCOPE_GLOBALS)).toEqual([...ADDON_SCOPE_GLOBALS]);
});

test('records the digest of each written bundle, with no bytecode when it compiled none', async () => {
	const output = createTempDir({ 'index.js': '({})' });
	const hook = hermesBytecode({ versions: [98], sourceName: 'sample' })
		.writeBundle as WriteBundle;
	const bundle = {
		'index.js': { type: 'chunk', fileName: 'index.js' },
	} as unknown as OutputBundle;

	try {
		await hook.call(
			Object.create(null) as PluginContext,
			{ dir: output.path, file: undefined },
			bundle,
		);

		expect(
			JSON.parse(readFileSync(join(output.path, BYTECODE_DIGESTS_FILENAME), 'utf8')),
		).toEqual({
			'index.js': {
				sha512: createHash('sha512').update('({})').digest('hex'),
				bytecode: {},
			},
		});
	} finally {
		output.remove();
	}
});

test('on a client that passes only React, unbound and the timers resolve to the globals', () => {
	const unbound = { patcher: {} };

	Reflect.set(globalThis, 'unbound', unbound);

	try {
		const factory: OlderClientFactory = runInThisContext(
			bytecodeSource(
				'[React, unbound === globalThis.unbound, setTimeout === globalThis.setTimeout]',
			),
		);

		expect(factory('react')).toEqual(['react', true, true]);
	} finally {
		Reflect.deleteProperty(globalThis, 'unbound');
	}
});
