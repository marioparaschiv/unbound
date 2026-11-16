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
	test('shortens an extension note that does not fit instead of counting addons', () => {
		const card = layoutDebugCard(
			{ ...info, isolatedExtensions: ['A'.repeat(60), 'B'.repeat(50)] },
			new Date(),
		);
		const runs = texts(card).map((run) => run.text);

		expect(runs.some((text) => text.includes('addons'))).toBe(false);
		expect(runs.some((text) => text.endsWith('+1 more') && text.includes('…'))).toBe(true);
	});

	test('fits every extension that fits on the line before counting the rest', () => {
		const card = layoutDebugCard(
			{
				...info,
				missingExtensions: ['Share', 'Safari'],
				isolatedExtensions: ['NotificationService', 'BroadcastUpload', 'LockscreenWidget'],
			},
			new Date(),
		);
		const row = texts(card).find((run) => run.text.includes('Share')) as CardText;

		expect(row.text).toBe('Share · Safari · BroadcastUpload · +2 more');
	});

	test('skips an extension too long for the line and keeps the shorter ones after it', () => {
		const card = layoutDebugCard(
			{ ...info, isolatedExtensions: ['Share', 'NotificationServiceExtension', 'Safari'] },
			new Date(),
		);
		const row = texts(card).find((run) => run.text.includes('+1 more')) as CardText;

		expect(row.text).toBe('Share · Safari · +1 more');
	});
});
