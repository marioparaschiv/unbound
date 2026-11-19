import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findUnscopedCleanup } from '~/lib/checks/scoped-cleanup';
import { findOffMainUiCalls } from '~/lib/checks/main-thread-ui';
import { parseFile } from '~/lib/check/parse-cache';

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function parsed(source: string) {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-check-'));
	const path = join(dir, 'index.ts');

	dirs.push(dir);
	writeFileSync(path, source);

	return parseFile(new Map(), path);
}

test('flags UIKit selectors called on the JavaScript thread', () => {
	const found = findOffMainUiCalls(
		parsed(
			[
				"objc.invoke(view, 'setHidden:', [true]);",
				"objc.call(view, 'superview');",
				"objc.invoke(view, 'setAlpha:', [1], { thread: 'main' });",
				"objc.invoke(view, 'description', []);",
				"function paint() {\n\t'worklet';\n\tobjc.invoke(view, 'setFrame:', [frame]);\n}",
			].join('\n'),
		),
		'index.ts',
	);

	expect(found.map(({ line, message }) => [line, message])).toEqual([
		[1, 'objc setHidden: touches UIKit from the JavaScript thread'],
		[2, 'objc superview touches UIKit from the JavaScript thread'],
	]);
});

test('flags globals the scope cannot clean up', () => {
	const found = findUnscopedCleanup(
		parsed(
			[
				'globalThis.setInterval(tick, 1000);',
				'window.unbound.plugins.get(id);',
				"Keyboard.addListener('keyboardDidShow', show);",
				'setTimeout(tick, 10);',
			].join('\n'),
		),
		'index.ts',
	);

	expect(found.map(({ line }) => line)).toEqual([1, 2, 3]);
});

test('accepts subscriptions a file removes', () => {
	const found = findUnscopedCleanup(
		parsed(
			"const sub = Keyboard.addListener('keyboardDidShow', show);\nexport function stop() { sub.remove(); }",
		),
		'index.ts',
	);

	expect(found).toEqual([]);
});
