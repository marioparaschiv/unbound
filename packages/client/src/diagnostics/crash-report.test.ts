import { describe, expect, test } from 'bun:test';

import type { CrashEnvironment } from './crash-report';

import { buildCrashReport, crashLogExcerpt, scrubLogLine } from './crash-report';

const environment: CrashEnvironment = {
	platform: 'ios',
	clientVersion: '1.0.0',
	loaderVersion: '1.0.0',
	discordVersion: '350.0',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
};

describe('crash reports', () => {
	test('carry only the event and the app, loader and device details', () => {
		const report = buildCrashReport(
			{
				kind: 'freeze',
				phase: 'frozen',
				seconds: 7,
				addon: { id: 'unbound.example', version: '1.0.0', trust: 'unsigned' },
			},
			environment,
		);

		expect(report).toMatchObject({ kind: 'freeze', ...environment });
		expect(Object.keys(report ?? {}).sort()).toEqual(
			[
				'addon',
				'clientVersion',
				'deviceModel',
				'discordVersion',
				'kind',
				'loaderVersion',
				'osVersion',
				'phase',
				'platform',
				'seconds',
			].sort(),
		);
	});

	test('trim long messages, stacks and device details to the limits', () => {
		const report = buildCrashReport(
			{ kind: 'start-failure', message: 'm'.repeat(5_000), stack: 's'.repeat(40_000) },
			{ ...environment, deviceModel: 'd'.repeat(100) },
		);

		expect(report?.message?.length).toBe(2_000);
		expect(report?.stack?.length).toBe(16_000);
		expect(report?.deviceModel.length).toBe(64);
	});

	test('refuse events the API would reject', () => {
		expect(
			buildCrashReport(
				{ kind: 'crash', addon: { id: 'not a valid id!', version: '1', trust: 'signed' } },
				environment,
			),
		).toBeUndefined();
	});
});

describe('crash report logs', () => {
	const token = `${'M'.repeat(26)}.${'G'.repeat(6)}.${'x'.repeat(38)}`;

	test('scrub tokens, credentials and email addresses', () => {
		expect(scrubLogLine(`I [console] got ${token}`)).toBe('I [console] got [redacted]');
		expect(scrubLogLine(`mfa.${'a'.repeat(84)} left`)).toBe('[redacted] left');
		expect(scrubLogLine('fetch with Bearer abc.def-123')).toBe('fetch with [redacted]');
		expect(scrubLogLine('{"token":"abc123","password": hunter2}')).toBe(
			'{"token":"[redacted]","password": [redacted]}',
		);
		expect(scrubLogLine('mail me at someone@example.com')).toBe('mail me at [redacted]');
		expect(scrubLogLine('I [plugins] Loaded 32 plugins.')).toBe(
			'I [plugins] Loaded 32 plugins.',
		);
	});

	test('keep the newest lines that fit, oldest first', () => {
		const lines = Array.from({ length: 200 }, (_, index) => `${index} ${'y'.repeat(150)}`);
		const excerpt = crashLogExcerpt(`${lines.join('\n')}\n`) ?? '';
		const kept = excerpt.split('\n');

		expect(excerpt.length).toBeLessThanOrEqual(16_000);
		expect(kept.at(-1)).toStartWith('199 ');
		expect(Number(kept[0]?.split(' ')[0])).toBeGreaterThan(0);
		expect(crashLogExcerpt('\n\n')).toBeUndefined();
	});

	test('travel in the report scrubbed', () => {
		const report = buildCrashReport(
			{ kind: 'crash' },
			environment,
			`E [plugins] boom ${token}\n`,
		);

		expect(report?.log).toBe('E [plugins] boom [redacted]');
		expect(buildCrashReport({ kind: 'crash' }, environment)?.log).toBeUndefined();
	});
});
