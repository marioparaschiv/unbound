import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as deviceScripts from './device-scripts';
import * as leakCheck from './leak-check';
import * as selfTest from './loader-self-test';

const modules = [
	{ file: 'device-scripts.ts', exports: deviceScripts },
	{ file: 'leak-check.ts', exports: leakCheck },
	{ file: 'loader-self-test.ts', exports: selfTest },
];

const SAMPLE_ARGUMENTS: Record<string, unknown[]> = {
	cycleScript: ['unbound.demo'],
	fixtureScript: ['1', '2'],
	developerModeScript: [true],
	settingsScreenScript: ['unbound.demo'],
	toastDurationScript: [300],
	fixturesPresentScript: ['2'],
	restoreScript: ['unbound.demo'],
	scrollFillerScript: ['2'],
};

function topLevelNames(source: string): string[] {
	return [...source.matchAll(/^(?:export )?(?:const|let|function|async function) (\w+)/gm)].map(
		(match) => match[1]!,
	);
}

describe('device scripts', () => {
	for (const { file, exports } of modules) {
		const names = topLevelNames(readFileSync(join(import.meta.dir, file), 'utf8'));

		for (const [name, value] of Object.entries(exports)) {
			if (!name.endsWith('Script') || typeof value !== 'function') continue;

			test(`${name} is valid JavaScript that needs nothing from ${file}`, () => {
				const script = (value as (...args: unknown[]) => string)(
					...(SAMPLE_ARGUMENTS[name] ?? []),
				);
				const called = /^\((\w+|async function \w+|function \w+)/.exec(script);
				const own = /^\((?:async )?function (\w+)/.exec(script)?.[1];
				const leaked = names.filter(
					(candidate) =>
						candidate !== own &&
						candidate !== name &&
						new RegExp(`\\b${candidate}\\b`).test(script),
				);

				expect(called).not.toBeNull();
				expect(() => new Function(`return ${script}`)).not.toThrow();
				expect(leaked).toEqual([]);
			});
		}
	}
});
