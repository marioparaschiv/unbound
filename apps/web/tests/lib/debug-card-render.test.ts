import { describe, expect, test } from 'bun:test';

import { renderDebugCard } from '~/lib/debug-card/render';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const info = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.3.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit 1.2',
	jailbreak: 'Dopamine 3.0.9',
	discord: '352.1',
	discordChannel: 'Stable',
	discordBuild: '120918',
	discordSupport: 'supported' as const,
	appSource: 'App Store',
	installDetails: 'Distribution (`53Q6R32WPB`)',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1 (23A355)',
	device: 'iPhone SE (2nd generation)',
	flags: ['Jailbroken', 'unverified build'],
	plugins: { enabled: 1, installed: 60 },
};

describe('renderDebugCard', () => {
	test('renders the card as a PNG at three times its size, with the report as alt text', () => {
		const card = renderDebugCard(info, new Date('2026-11-12T17:53:00Z'));
		const png = Buffer.from(card.image, 'base64');

		expect([...png.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
		expect(card.width).toBe(432 * 3);
		expect(card.height).toBeGreaterThan(card.width / 2);
		expect(JSON.parse(card.altText)).toMatchObject({ loader: '1.3.0', support: 'supported' });
	});
});
