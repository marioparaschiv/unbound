import { describe, expect, test } from 'bun:test';

import {
	debugAltText,
	debugCardSvg,
	layoutDebugCard,
	type CardText,
} from '~/diagnostics/debug-card';

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

describe('debug card', () => {
	test('keeps every text run inside the card', () => {
		const long = { ...info, device: 'A'.repeat(200), appSource: 'B'.repeat(200) };

		for (const card of [layoutDebugCard(info), layoutDebugCard(long)]) {
			for (const run of texts(card)) {
				expect(run.x + run.text.length * run.size * 0.6).toBeLessThanOrEqual(
					card.width - 13,
				);
			}
		}
	});

	test('shows each component on its own aligned row, with the team id highlighted', () => {
		const card = layoutDebugCard(info);
		const labels = texts(card)
			.filter((run) => run.x === 14)
			.map((run) => run.text);

		expect(labels).toEqual([
			'unbound',
			'loader',
			'discord',
			'source',
			'device',
			'system',
			'install',
			'react',
			'hermes',
		]);
		expect(texts(card).find((run) => run.text === 'BZJHJ764K7')?.color).toBe('#a78bfa');
		expect(texts(card).find((run) => run.text.includes('verified'))?.color).toBe('#22c55e');
	});

	test('right-aligns the addon counts in the footer, leaving out kinds with none installed', () => {
		const card = layoutDebugCard(info);
		const summary = texts(card).find((run) => run.text === '12/60 plugins');

		expect(summary && summary.x + summary.text.length * 7.8).toBeCloseTo(card.width - 14, 0);
		expect(JSON.parse(debugAltText(info))).toMatchObject({ plugins: '12/60', themes: '0/0' });
	});

	test('starts the footer state after the ALT badge and stamps the title bar', () => {
		const card = layoutDebugCard(info, new Date('2026-11-12T17:06:30Z'));
		const state = texts(card).filter((run) => run.text.includes('●'));
		const stamp = texts(card).find((run) => run.text === '2026-11-12 17:06 utc');

		expect(state[0]?.x).toBe(66);
		expect(state.every((run) => run.y > card.height - 52)).toBe(true);
		expect(stamp?.y).toBeLessThan(28);
	});

	test('leaves the install row out when the report has none', () => {
		expect(
			texts(layoutDebugCard({ ...info, installDetails: '' })).some((run) =>
				run.text.startsWith('install'),
			),
		).toBe(false);
	});

	test('keeps every row on one line, with the jailbreak in the footer state', () => {
		const card = layoutDebugCard({
			...info,
			jailbreak: 'Dopamine 3.0.9',
			flags: ['Jailbroken', 'unverified build'],
			installDetails: 'Ad Hoc (`BZJHJ764K7`) · expires 2027-09-16 · AltStore/SideStore',
		});
		const baselines = new Set(texts(card).map((run) => run.y));

		expect(baselines.size).toBe(1 + 9 + 1);
		expect(texts(card).some((run) => run.text.includes('…'))).toBe(false);
		expect(texts(card).some((run) => run.text === '12/60 plugins')).toBe(true);
		expect(texts(card).find((run) => run.text.includes('dopamine'))?.text).toBe(
			'● dopamine 3.0.9',
		);
	});

	test('writes escaped SVG with the same size', () => {
		const svg = debugCardSvg(layoutDebugCard({ ...info, device: '<iPad & "mini">' }));

		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="432"')).toBe(true);
		expect(svg).toContain('&#60;iPad &#38; &#34;mini&#34;&#62;');
	});

	test('carries the report as JSON within Discord alt text limits', () => {
		const alt = debugAltText(info);
		const parsed = JSON.parse(alt);

		expect(parsed).toMatchObject({
			unbound: '3.0.0',
			commit: '7e15ee37d',
			install: 'Ad Hoc (BZJHJ764K7) · expires 2027-09-16',
			state: ['Jailed', 'verified build'],
		});
		expect(
			JSON.parse(debugAltText({ ...info, appSource: 'x'.repeat(900) })).source,
		).toBeUndefined();
		expect(debugAltText({ ...info, device: 'y'.repeat(2000) }).length).toBeLessThanOrEqual(
			1024,
		);
	});
	test('colours the Discord support status and lists disabled addons on one row', () => {
		const card = layoutDebugCard({
			...info,
			discordSupport: 'untested',
			disabledAddons: [
				'Chat Bubbles (crashed)',
				'Mention Avatars (froze)',
				'Message Latency (failed to start)',
			],
		});

		expect(texts(card).find((run) => run.text === 'untested')?.color).toBe('#eab308');
		expect(texts(card).find((run) => run.text.startsWith('Chat Bubbles'))?.text).toBe(
			'Chat Bubbles (crashed) · +2 more',
		);
	});

	test('keeps the plugin count when plugins and themes do not both fit', () => {
		const card = layoutDebugCard({ ...info, themes: { enabled: 1, installed: 3 } });

		expect(texts(card).some((run) => run.text === '12/60 plugins')).toBe(true);
	});

	test('stays comfortably readable: 13pt text on a 432pt card that never turns tall', () => {
		const card = layoutDebugCard({
			...info,
			discordSupport: 'unsupported',
			disabledAddons: ['A (crashed)'],
		});

		expect(card.width).toBe(432);
		expect(Math.min(...texts(card).map((run) => run.size))).toBeGreaterThanOrEqual(13);
		expect(card.height / card.width).toBeLessThanOrEqual(0.85);
	});
	test('shows a launch row only when the bundle or the launches before it need attention', () => {
		const quiet = {
			bundle: 'active',
			earlyCloses: 0,
			recovery: false,
			previousExit: 'ended',
		} as const;

		expect(
			texts(layoutDebugCard({ ...info, launch: quiet })).some((run) => run.text === 'launch'),
		).toBe(false);

		const card = layoutDebugCard({
			...info,
			launch: {
				...quiet,
				bundle: 'rolled back',
				earlyCloses: 2,
				lastCrash: 'SIGSEGV in Chat Bubbles',
			},
			disabledAddons: ['Chat Bubbles (crashed)'],
		});

		expect(texts(card).find((run) => run.text.startsWith('crash'))?.text).toBe(
			'crash SIGSEGV in Chat Bubbles · +2 more',
		);
		expect(JSON.parse(debugAltText({ ...info, launch: quiet })).launch).toBeUndefined();
		expect(card.height / card.width).toBeLessThanOrEqual(0.85);
	});
	test('names the Android root manager in place of the generic rooted state', () => {
		const card = layoutDebugCard({
			...info,
			platform: 'Android',
			jailbreak: 'Magisk',
			flags: ['Rooted', 'verified build'],
		});

		expect(texts(card).some((run) => run.text === '● magisk')).toBe(true);
	});
});
