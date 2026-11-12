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
		expect(texts(card).find((run) => run.text.includes('verified build'))?.color).toBe(
			'#22c55e',
		);
	});

	test('right-aligns the addon counts in the footer, leaving out kinds with none installed', () => {
		const card = layoutDebugCard(info);
		const summary = texts(card).find((run) => run.text === '12/60 plugins');

		expect(summary && summary.x + summary.text.length * 7.2).toBeCloseTo(card.width - 14, 0);
		expect(JSON.parse(debugAltText(info))).toMatchObject({ plugins: '12/60', themes: '0/0' });
	});

	test('starts the footer state after the ALT badge and stamps the title bar', () => {
		const card = layoutDebugCard(info, new Date('2026-11-12T17:06:30Z'));
		const state = texts(card).filter((run) => run.text.includes('●'));
		const stamp = texts(card).find((run) => run.text === '2026-11-12 17:06 utc');

		expect(state[0]?.x).toBe(76);
		expect(state.every((run) => run.y > card.height - 46)).toBe(true);
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
		expect(texts(card).find((run) => run.text.includes('dopamine'))?.text).toBe(
			'● jailbroken · dopamine 3.0.9',
		);
	});

	test('writes escaped SVG with the same size', () => {
		const svg = debugCardSvg(layoutDebugCard({ ...info, device: '<iPad & "mini">' }));

		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="496"')).toBe(true);
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
});
