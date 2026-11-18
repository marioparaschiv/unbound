import { describe, expect, test } from 'bun:test';

import {
	mapPluginFrames,
	parsePluginCrash,
	pluginSymbolsComment,
} from '../symbolicate-plugin-issue';

const body = [
	'Opened automatically from a crash report sent by a user who turned crash reporting on.',
	'',
	'| | |',
	'| --- | --- |',
	'| Kind | render |',
	'| Addon | unbound.character-counter 1.0.6 (first-party) |',
	'',
	'### Stack',
	'',
	'```text',
	'TypeError: undefined is not a function',
	'    at rgbChannels (:1:11)',
	'    at renderWithHooks (/ci/build/index.android.bundle:142:49958)',
	'```',
].join('\n');

const map = JSON.stringify({
	version: 3,
	sources: ['../../plugins-shared/src/colors.ts'],
	names: [],
	mappings: 'AAAA,UAAU',
});

describe('plugin crash issues', () => {
	test('finds the plugin, its version and the stack', () => {
		expect(parsePluginCrash(body)).toMatchObject({
			id: 'unbound.character-counter',
			version: '1.0.6',
		});
	});

	test('skips issues without plugin frames or already answered', () => {
		expect(parsePluginCrash(body.replace('(:1:11)', '(<anonymous>)'))).toBeUndefined();
		expect(parsePluginCrash(`${body}\n<!-- unbound-plugin-symbolicated -->`)).toBeUndefined();
	});

	test('maps the plugin frames and leaves Discord frames alone', () => {
		const crash = parsePluginCrash(body);
		const mapped = mapPluginFrames(crash?.stack ?? '', map);

		expect(mapped).toContain('at rgbChannels (plugins-shared/src/colors.ts:1:11)');
		expect(mapped).toContain('index.android.bundle:142:49958');
	});

	test('writes a marked comment', () => {
		const crash = { id: 'unbound.x', version: '1.0.0', stack: '' };

		expect(pluginSymbolsComment(crash, 'abcdef1234567', 'at f (src/a.ts:1:1)')).toStartWith(
			'<!-- unbound-plugin-symbolicated -->\n`unbound.x` 1.0.0 frames, mapped with a rebuild at `abcdef123`',
		);
	});
});
