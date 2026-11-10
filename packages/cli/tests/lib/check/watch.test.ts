import { afterEach, describe, expect, test } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { watchChecks, type CheckWatcher, type WatchUpdate } from '../src/lib/check/watch';
import { checkAddons } from '../src/lib/check/check-addons';
import { createTempDir, type TempDir } from './helpers/ubd';
import { createCheckCache } from '../src/lib/check/check';
import { selectChecks } from '../src/lib/check/registry';
import { onlyAddon } from './helpers/check';

const dirs: TempDir[] = [];
const watchers: CheckWatcher[] = [];

afterEach(() => {
	for (const watcher of watchers.splice(0)) watcher.stop();

	for (const dir of dirs.splice(0)) dir.remove();
});

function messages(update: WatchUpdate, side: 'added' | 'removed'): string[] {
	return update[side].flatMap(({ diagnostics }) =>
		diagnostics.map((found) => `${found.file} ${found.message}`),
	);
}

describe('watchChecks', () => {
	test('re-checks on a save and reports only what changed', async () => {
		const dir = createTempDir({
			'manifest.json': JSON.stringify({ id: 'example.demo', main: 'src/index.tsx' }),
			'package.json': JSON.stringify({ scripts: { build: 'true' } }),
			'src/index.tsx': 'export default {};',
		});

		dirs.push(dir);

		const addon = await onlyAddon(dir);
		const selection = selectChecks({ only: ['layout'] });

		if ('unknown' in selection) {
			throw new Error('Unexpected unknown ids.');
		}

		const cache = createCheckCache();
		const updates: WatchUpdate[] = [];
		let notify = () => {};
		const next = () =>
			new Promise<WatchUpdate>((done) => {
				const seen = updates.length;

				notify = () => {
					const update = updates[seen];

					if (update) {
						done(update);
					}
				};
			});

		watchers.push(
			await watchChecks({
				addons: [addon],
				check: (targets) => checkAddons(targets, selection, cache),
				onUpdate(update) {
					updates.push(update);
					notify();
				},
				debounceMs: 20,
			}),
		);

		expect(updates[0]?.initial).toBe(true);
		expect(messages(updates[0]!, 'added')).toEqual([]);

		const added = next();

		writeFileSync(join(dir.path, 'src', 'extra.ts'), 'export {};');

		const first = await added;

		expect(first.initial).toBe(false);
		expect(messages(first, 'added')).toEqual(['src/extra.ts is not a standard root file']);
		expect(messages(first, 'removed')).toEqual([]);

		const removed = next();

		rmSync(join(dir.path, 'src', 'extra.ts'));

		const second = await removed;

		expect(messages(second, 'added')).toEqual([]);
		expect(messages(second, 'removed')).toEqual(['src/extra.ts is not a standard root file']);
	});
});
