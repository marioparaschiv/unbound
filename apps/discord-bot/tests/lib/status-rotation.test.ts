import type { PublicAddon } from '@unbound-app/web/bot';
import { describe, expect, test } from 'bun:test';

import { addonStats, statusLines } from '~/lib/status-rotation';

function addon(type: PublicAddon['type'], listed = true): PublicAddon {
	return {
		id: `${type}-${Math.random()}`,
		type,
		name: type,
		description: '',
		version: '1.0.0',
		authors: [],
		iconSvg: '',
		pageUrl: '',
		installUrl: '',
		gallery: [],
		listed,
	};
}

describe('status rotation', () => {
	test('counts listed addons by kind', () => {
		expect(
			addonStats([addon('plugin'), addon('plugin'), addon('plugin', false), addon('theme')]),
		).toEqual({ plugins: 2, themes: 1, iconPacks: 0 });
	});

	test('writes one line per stat, with plurals and grouped thousands', () => {
		expect(statusLines({ plugins: 1520, themes: 1, iconPacks: 3, members: 12_345 })).toEqual([
			'1,520 plugins on unbound.rip',
			'1 theme and 3 icon packs',
			'Helping 12,345 members',
			'Type /debug for help',
		]);
		expect(statusLines({ plugins: 1, themes: 0, iconPacks: 1 })).toHaveLength(3);
	});
});
