import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { debugCardSvg, layoutDebugCard, type CardText } from '~/lib/debug-card/layout';
import { renderDebugCard } from '~/lib/debug-card/render';

const PREVIEW_DIRECTORY = join(import.meta.dirname, '..', '.previews');
const NOW = new Date('2026-11-12T19:00:00Z');
const HOUR = 3_600_000;

const busiest: DebugCardRequest = {
	client: 'v3.1.0',
	commit: 'fdbe58da2',
	loader: '1.3.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit 1.2',
	jailbreak: '',
	discord: '355.0',
	discordChannel: 'Beta',
	discordBuild: '122874',
	discordSupport: 'untested',
	appSource: 'Sideloaded (TestFlight build)',
	installDetails: 'Ad Hoc (`BZJHJ764K7`) · expires 2027-09-16 · AltStore/SideStore',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.1 (23B85)',
	device: 'iPad Pro 13-inch (M4) (Wi-Fi + Cellular)',
	flags: ['Jailed', 'verified build', 'simulator', 'system app'],
	plugins: { enabled: 12, installed: 60 },
	themes: { enabled: 1, installed: 3 },
	disabledAddons: ['Chat Bubbles (crashed)', 'Mention Avatars (froze)'],
	errors: [{ at: NOW.getTime(), message: 'undefined is not a function', addon: 'chat-bubbles' }],
	launch: {
		bundle: 'rolled back',
		earlyCloses: 2,
		recovery: true,
		previousExit: 'crashed',
		firstRenderMs: 9_669,
		source: 'pr',
		pullRequest: 1175,
		crashes: [
			{ at: NOW.getTime() - 2 * HOUR, crash: 'SIGSEGV in Chat Bubbles' },
			{ at: NOW.getTime() - HOUR, crash: 'SIGSEGV in Chat Bubbles' },
		],
	},
	memory: { availableMB: 180, memoryWarnings: 2, thermal: 'serious' },
	storage: { freeMB: 320, unboundMB: 41 },
};

const context = {
	compat: { broken: 2, fallbacks: 3 },
	loaderUpdate: '1.4.0',
	clientUpdate: '85af3ea15',
};

function texts(card: ReturnType<typeof layoutDebugCard>): CardText[] {
	return card.ops.filter((op): op is CardText => op.kind === 'text');
}

describe('debug card preview', () => {
	test('the busiest realistic card stays whole, readable and short', async () => {
		const card = layoutDebugCard(busiest, NOW, context);
		const runs = texts(card);

		expect(card.width).toBe(432);
		expect(Math.min(...runs.map((run) => run.size))).toBeGreaterThanOrEqual(13);
		expect(card.height / card.width).toBeLessThanOrEqual(0.85);
		expect(runs.filter((run) => run.text.includes('…')).map((run) => run.text)).toEqual([]);

		for (const run of runs) {
			expect(run.x + run.text.length * run.size * 0.6).toBeLessThanOrEqual(card.width - 13);
		}

		const rendered = renderDebugCard(busiest, NOW, context);

		await Bun.write(
			join(PREVIEW_DIRECTORY, 'busiest.png'),
			Buffer.from(rendered.image, 'base64'),
		);
		await Bun.write(join(PREVIEW_DIRECTORY, 'busiest.svg'), debugCardSvg(card));
	});
});
