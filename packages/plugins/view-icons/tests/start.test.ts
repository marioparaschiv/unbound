import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { pluginHolds, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { registerDiscord } from './discord';
import { selfTest } from '~/index';

beforeEach(() => resetHealth());

describe('the plugin on start', () => {
	test('reports both patches in its self-test', async () => {
		registerDiscord();
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});

	test('keeps the action sheet patch when the context menu patch fails', async () => {
		const error = spyOn(console, 'error').mockImplementation(() => {});

		registerDiscord({ brokenContextMenus: true });
		await startPlugin();

		expect(pluginHolds().join()).toContain('openLazy');
		expect(pluginHolds().join()).not.toContain('showContextMenu');
		expect(selfTest()).toMatchObject({ ok: false });
		expect(error).toHaveBeenCalled();

		error.mockRestore();
	});
});
