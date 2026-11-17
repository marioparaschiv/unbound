import { describe, expect, test } from 'bun:test';

import { layoutDebugCard, type CardText } from '~/lib/debug-card/layout';

const info = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.2.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit 1.1.3',
	jailbreak: '',
	discord: '353.0',
	discordChannel: 'Beta',
	discordBuild: '122208',
	appSource: 'Sideloaded (TestFlight build)',
	installDetails: 'Ad Hoc (`BZJHJ764K7`) · expires 2027-09-16',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '27.3 (24C5037i)',
	device: 'iPad mini (A20 Pro)',
	flags: ['Jailed', 'verified build'],
	plugins: { enabled: 12, installed: 60 },
	themes: { enabled: 0, installed: 0 },
};

function texts(card: ReturnType<typeof layoutDebugCard>): CardText[] {
	return card.ops.filter((op): op is CardText => op.kind === 'text');
}

describe('debug card lists', () => {
	test('breaks an extension name longer than a line instead of cutting it', () => {
		const card = layoutDebugCard(
			{ ...info, isolatedExtensions: ['A'.repeat(60), 'B'.repeat(50)] },
			new Date(),
		);
		const runs = texts(card).map((run) => run.text);

		expect(runs.join('').replaceAll(' · ', '')).toContain('A'.repeat(42));
		expect(runs.filter((text) => /^[AB]+$/.test(text)).join('')).toBe(
			'A'.repeat(60) + 'B'.repeat(50),
		);
		expect(runs.some((text) => text.includes('…') || text.includes('more'))).toBe(false);
	});

	test('lists every extension, wrapping between them', () => {
		const card = layoutDebugCard(
			{
				...info,
				missingExtensions: ['Share', 'Safari'],
				isolatedExtensions: ['NotificationService', 'BroadcastUpload', 'LockscreenWidget'],
			},
			new Date(),
		);
		const runs = texts(card).map((run) => run.text);

		expect(runs).toContain('Share · Safari · NotificationService');
		expect(runs).toContain('BroadcastUpload · LockscreenWidget');
	});
});
