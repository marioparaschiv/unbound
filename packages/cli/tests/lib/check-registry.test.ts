import { afterEach, describe, expect, test } from 'bun:test';

import {
	CHECKS,
	OPT_IN_CHECKS,
	keepSelected,
	listCheckIds,
	selectChecks,
} from '~/lib/check/registry';
import { createCheckCache, type Check } from '~/lib/check/check';
import { hasFailures, runChecks } from '~/lib/check/run';
import { buildChecks } from '~/lib/build-checks';
import { discoverAddons } from '~/lib/discovery';
import { diagnostic } from '~/rollup/diagnostic';

import { createTempDir, type TempDir } from '../helpers/ubd';
import { loadWorkspace } from '../helpers/config';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

async function anAddon() {
	const dir = createTempDir({
		'manifest.json': JSON.stringify({ id: 'example.demo', main: 'index.js' }),
		'index.js': 'module.exports = {};',
	});

	dirs.push(dir);

	const [addon] = await discoverAddons(loadWorkspace(dir.path));

	if (!addon) {
		throw new Error('The fixture addon was not discovered.');
	}

	return addon;
}

function reporting(id: string, file: string, seen: string[]): Check {
	return {
		id,
		async run() {
			seen.push(`start ${id}`);
			await Bun.sleep(5);
			seen.push(`end ${id}`);

			return [diagnostic({ file, severity: 'warning', message: `from ${id}` })];
		},
	};
}

describe('the check registry', () => {
	test('runs every build check, then the registered checks, with types opt-in', () => {
		const selection = selectChecks({});
		const typed = selectChecks({ types: true });

		if ('unknown' in selection || 'unknown' in typed) {
			throw new Error('Unexpected unknown ids.');
		}

		expect(selection.checks).toEqual([...CHECKS, ...buildChecks()]);
		expect(typed.checks).toEqual([...CHECKS, ...buildChecks(), ...OPT_IN_CHECKS]);
	});

	test('runs the declared capabilities check when asked to', () => {
		const selection = selectChecks({ declaredCapabilities: true });

		if ('unknown' in selection) {
			throw new Error('Unexpected unknown ids.');
		}

		expect(selection.checks).toEqual([...CHECKS, ...buildChecks(true)]);
	});

	test('--only narrows to the named checks and rejects unknown ones', () => {
		const selection = selectChecks({ only: ['lint', 'types'] });

		if ('unknown' in selection) {
			throw new Error('Unexpected unknown ids.');
		}

		expect(selection.checks.map((check) => check.id)).toEqual(['lint', 'types']);
		expect(selectChecks({ only: ['lint', 'nope'] })).toEqual({ unknown: ['nope'] });
		expect(listCheckIds()).toContain('capabilities');
	});

	test('keeps only the selected checks’ diagnostics', () => {
		const selection = selectChecks({ only: ['lint'] });

		if ('unknown' in selection) {
			throw new Error('Unexpected unknown ids.');
		}

		const kept = keepSelected(selection, [
			diagnostic({ file: 'a', severity: 'error', message: 'lint', check: 'lint' }),
			diagnostic({ file: 'a', severity: 'error', message: 'naming', check: 'naming' }),
		]);

		expect(kept.map((found) => found.message)).toEqual(['lint']);
	});
});

describe('runChecks', () => {
	test('runs the checks in parallel and tags each diagnostic with its check', async () => {
		const seen: string[] = [];
		const result = await runChecks(
			await anAddon(),
			[reporting('first', 'b.ts', seen), reporting('second', 'a.ts', seen)],
			{ emit: false, cache: createCheckCache() },
		);

		expect(seen).toEqual(['start first', 'start second', 'end first', 'end second']);
		expect(result.diagnostics.map(({ file, check }) => `${file} ${check}`)).toEqual([
			'a.ts second',
			'b.ts first',
		]);
	});

	test('reports a crashing check as an error and still runs the others', async () => {
		const crashing: Check = {
			id: 'crashing',
			run() {
				throw new Error('boom');
			},
		};
		const result = await runChecks(await anAddon(), [crashing, reporting('fine', 'a.ts', [])], {
			emit: false,
			cache: createCheckCache(),
		});

		expect(result.diagnostics.map((found) => found.message)).toEqual([
			'The crashing check crashed: boom',
			'from fine',
		]);
		expect(hasFailures(result.diagnostics)).toBe(true);
	});

	test('warnings fail only a strict run', () => {
		const warnings = [diagnostic({ file: 'a', severity: 'warning', message: 'w' })];

		expect(hasFailures(warnings)).toBe(false);
		expect(hasFailures(warnings, true)).toBe(true);
	});
});
