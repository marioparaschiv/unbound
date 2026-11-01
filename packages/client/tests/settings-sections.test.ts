import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { SettingsEntry } from '@unbound-app/types/settings';
import enUS from '@i18n/en-US.json';

import type { SectionEntry } from '~/settings/section';

await import('./helpers/addons');

Object.assign(globalThis, { window: globalThis, modules: new Map(), $$DEV$$: false });

type RendererConfig = { SETTING_RENDERER_CONFIG: Record<string, Pick<SettingsEntry, 'key'>> };

const renderer: RendererConfig = {
	SETTING_RENDERER_CONFIG: { DISCORD_ACCOUNT: { key: 'DISCORD_ACCOUNT' } },
};

const Page = () => null;

mock.module('~/metro/wait', () => ({
	onModuleLoaded(
		filter: (mdl: RendererConfig) => boolean,
		onLoad: (mdl: RendererConfig) => void,
	) {
		if (filter(renderer)) {
			onLoad(renderer);
		}

		return () => void 0;
	},
}));

mock.module('~/metro/cache', () => ({
	default: {
		state: { moduleFlags: {} },
		moduleIds: [],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
	},
	ModuleFlags: { BLACKLISTED: 1 },
}));
mock.module('~/assets/api', () => ({ getIdByName: () => 1 }));
mock.module('~/metro/components', () => ({ Discord: { TableRowIcon: Page } }));
mock.module('~/ui/settings/general', () => ({ default: Page }));
mock.module('~/ui/settings/developer', () => ({ default: Page }));
mock.module('~/ui/settings/custom', () => ({ default: Page }));

const { createSettings } = await import('~/settings/builtin');
const { registerSection, removeSection } = await import('~/settings/api');

function section(key: string, titleKey: SectionEntry['titleKey'], hidden?: boolean): SectionEntry {
	return { key, titleKey, component: Page, icon: hidden ? undefined : 'Icon', hidden };
}

function config(): Record<string, SettingsEntry> {
	return renderer.SETTING_RENDERER_CONFIG as Record<string, SettingsEntry>;
}

describe('settings sections', () => {
	const settings = createSettings([
		section('B', 'UNBOUND_PLUGINS'),
		section('A', 'UNBOUND_ASSET_BROWSER', true),
		section('C', 'UNBOUND_UPDATES'),
	]);

	afterEach(() => {
		settings.stop?.();
		removeSection('PLUGIN');
	});

	test('adds the given sections after Discord routes, in the order given', () => {
		settings.start?.();

		expect(Object.keys(config())).toEqual(['DISCORD_ACCOUNT', 'B', 'A', 'C']);
	});

	test('lists registered sections after the built-in ones', () => {
		settings.start?.();
		registerSection({ ...config().B, key: 'PLUGIN' });

		expect(Object.keys(config())).toEqual(['DISCORD_ACCOUNT', 'B', 'A', 'C', 'PLUGIN']);
	});

	test('builds a route that hides hidden sections from the overview', () => {
		settings.start?.();

		const { B, A } = config();

		expect(B.useTitle()).toBe(enUS.UNBOUND_PLUGINS);
		expect(B.screen).toMatchObject({ route: 'B' });
		expect(B.screen.getComponent()).toBe(Page);
		expect(B.section).toBe('Unbound');
		expect(B.excludeFromDisplay).toBeUndefined();
		expect(B.IconComponent).toBeDefined();
		expect(A.section).toBeUndefined();
		expect(A.excludeFromDisplay).toBe(true);
		expect(A.IconComponent).toBeUndefined();
	});

	test('restores Discord routes on stop', () => {
		settings.start?.();
		settings.stop?.();

		expect(Object.keys(config())).toEqual(['DISCORD_ACCOUNT']);
	});
});
