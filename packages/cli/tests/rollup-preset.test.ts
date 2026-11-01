import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildBundle } from './helpers/rollup';

type ScopedPlugin = { start: () => string[] };

let pluginRoot = '';

const entryModule = `
import { patcher } from '@unbound-app/api';
import { Moment } from '@unbound-app/api/metro/common';
import { createElement } from 'react';
import { View } from 'react-native';
import moment from 'moment';

export default {
	start() { return [patcher.name, Moment.name, createElement.name, View.name, moment.name]; },
};
`;

beforeAll(async () => {
	pluginRoot = await mkdtemp(join(tmpdir(), 'rollup-preset-'));
	await mkdir(join(pluginRoot, 'src'));
	await writeFile(
		join(pluginRoot, 'manifest.json'),
		'{"id":"preset.test","main":"src/index.ts"}',
	);
	await writeFile(join(pluginRoot, 'src', 'index.ts'), entryModule);
});

afterAll(async () => {
	await rm(pluginRoot, { recursive: true, force: true });
});

test('reads the client API, React and shared libraries from bare globals', async () => {
	const code = await buildBundle(pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href);
	const moment = { name: 'moment' };
	const unbound = {
		patcher: { name: 'patcher' },
		metro: { common: { Moment: moment } },
		shims: { moment: { default: moment } },
	};
	const React = { createElement: { name: 'createElement' } };
	const ReactNative = { View: { name: 'View' } };
	const plugin: ScopedPlugin = runInNewContext(`(${code})`, { unbound, React, ReactNative });

	expect(code).not.toContain('window.');
	expect(plugin.start()).toEqual(['patcher', 'moment', 'createElement', 'View', 'moment']);
});
