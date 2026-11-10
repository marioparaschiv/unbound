import { afterEach, describe, expect, test } from 'bun:test';

import { findKeyOnlyErrorToasts, messagesCheck } from '../src/lib/checks/messages';
import { formatDiagnostic } from '../src/rollup/diagnostic';
import { createTempDir, type TempDir } from './helpers/ubd';
import { checkContext, onlyAddon } from './helpers/check';
import { i18nCheck } from '../src/lib/checks/i18n';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

async function run(check: typeof messagesCheck, files: Record<string, string>) {
	const dir = createTempDir({
		'manifest.json': JSON.stringify({ id: 'example.demo', main: 'index.ts' }),
		'package.json': JSON.stringify({ scripts: { build: 'true' } }),
		...files,
	});

	dirs.push(dir);

	const found = await check.run(checkContext(await onlyAddon(dir), false));

	return found.map((item) => formatDiagnostic(item));
}

describe('messages check', () => {
	test('accepts every shorthand call that passes the error second', () => {
		const code = [
			"toasts.success('SAVED');",
			"toasts.error('SAVED', new Error('x'));",
			'toasts.error(error);',
			"unbound.toasts.info('SAVED_N', { count: 1 });",
		].join('\n');

		expect(findKeyOnlyErrorToasts('src/index.ts', code)).toEqual([]);
	});

	test('reports toasts.error given only a key, which would show the key as the error', async () => {
		expect(
			await run(messagesCheck, {
				'src/index.ts': "const a = 1;\nunbound.toasts.error('SAVED');\n",
			}),
		).toEqual([
			'src/index.ts:2:1  toasts.error with one argument shows it as the error, not as a title key.  Fix: pass the error second, as toasts.error(KEY, error).',
		]);
	});
});

describe('the i18n check on shorthand keys', () => {
	test('reports each toast and dialog key en-US lacks', async () => {
		expect(
			await run(i18nCheck, {
				'i18n/en-US.json': JSON.stringify({ SAVED: 'Saved', DELETE: 'Delete' }),
				'src/index.tsx': [
					"import { dialogs, toasts } from '@unbound-app/api';",
					"toasts.success('SAVD');",
					"dialogs.confirm('SAVED', { body: 'NOPE', confirm: 'DELETE' });",
				].join('\n'),
			}),
		).toEqual([
			'src/index.tsx:2:1  SAVD  toasts.success(\'KEY\', vars) names SAVD, which i18n/en-US.json does not have.  Fix: add it: ubd i18n add SAVD "<English text>".',
			'src/index.tsx:3:1  NOPE  dialogs.confirm(\'KEY\', { body, confirm, cancel }) names NOPE, which i18n/en-US.json does not have.  Fix: add it: ubd i18n add NOPE "<English text>".',
		]);
	});

	test('reports every key when the plugin has no en-US file', async () => {
		expect(await run(i18nCheck, { 'src/index.ts': "toasts.warning('SAVED');" })).toEqual([
			'src/index.ts:1:1  SAVED  toasts.success(\'KEY\', vars) names SAVED, but the plugin has no i18n/en-US.json.  Fix: add i18n/en-US.json with the key: ubd i18n add SAVED "<English text>".',
		]);
	});
});
