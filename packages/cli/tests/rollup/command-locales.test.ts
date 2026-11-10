import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';

import { formatDiagnostic } from '~/lib/check/diagnostic';
import { commandLocales } from '~/rollup/command-locales';
import { checkCommandText } from '~/rollup/command-text';

const source = {
	COIN_FLIP: 'Flip a coin',
	COIN_SIDE: 'The side to call',
	COIN_HEADS: 'Heads',
	COIN_TAILS: 'Tails',
	COIN_LONG: 'x'.repeat(101),
};

function problems(code: string, table: Record<string, string> | undefined) {
	return checkCommandText(code, '/plugin/src/index.ts', table).problems.map(
		({ line, column, command, problem, fix }) =>
			formatDiagnostic({
				file: 'src/index.ts',
				line,
				column,
				path: command,
				severity: 'error',
				message: problem,
				fix,
			}),
	);
}

describe('checkCommandText', () => {
	test('passes a tree of keys from en-US, and ignores what it cannot see', () => {
		const code = `
			const side = commands.option.choice({ heads: 'COIN_HEADS', tails: 'COIN_TAILS' } as const);
			commands.register({
				coin: {
					description: 'COIN_FLIP' satisfies string,
					options: { side: commands.option.choice({ heads: 'COIN_HEADS' }, { description: 'COIN_SIDE' }), other: side },
					execute: ({ side }: { side?: string }) => side,
				},
				dynamic: { description: pickKey(), execute: () => 'x' },
			});
			commands.register(buildTree());
		`;

		expect(problems(code, source)).toEqual([]);
		expect(checkCommandText(code, '/plugin/src/index.ts', source).registers).toBe(true);
	});

	test('reports every problem in one run, with file, position, command path and fix', () => {
		const code = [
			"import { option } from '@unbound-app/api/commands';",
			'commands.register({',
			"\tcoin: { description: 'Flip a coin', execute: () => 'x' },",
			'\tgame: {',
			"\t\tdescription: 'COIN_FLIP',",
			'\t\tsubcommands: {',
			'\t\t\tcall: {',
			"\t\t\t\tdescription: 'COIN_CALL',",
			'\t\t\t\toptions: {',
			"\t\t\t\t\tside: option.choice({ heads: 'Heads', edge: 'COIN_EDGE' }, { description: 'Pick a side' }),",
			"\t\t\t\t\tlegacy: option.choice(['heads', 'tails']),",
			"\t\t\t\t\tnote: option.string({ description: 'COIN_LONG' }),",
			'\t\t\t\t},',
			"\t\t\t\texecute: () => 'x',",
			'\t\t\t},',
			'\t\t},',
			'\t},',
			'});',
		].join('\n');

		expect(problems(code, source)).toEqual([
			'src/index.ts:3:23  /coin  description "Flip a coin" is literal text where a message key is required.  Fix: use its key "COIN_FLIP".',
			'src/index.ts:8:18  /game call  description key "COIN_CALL" is missing from i18n/en-US.json.  Fix: add "COIN_CALL": "<en-US text>" to i18n/en-US.json.',
			'src/index.ts:10:35  /game call  option "side" choice "heads" label "Heads" is literal text where a message key is required.  Fix: use its key "COIN_HEADS".',
			'src/index.ts:10:50  /game call  option "side" choice "edge" label key "COIN_EDGE" is missing from i18n/en-US.json.  Fix: add "COIN_EDGE": "<en-US text>" to i18n/en-US.json.',
			'src/index.ts:10:80  /game call  option "side" description "Pick a side" is literal text where a message key is required.  Fix: add "GAME_CALL_SIDE_DESC": "Pick a side" to i18n/en-US.json and use the key.',
			'src/index.ts:11:28  /game call  option "legacy" uses the removed array form of option.choice.  Fix: map each value to a key: option.choice({ value: \'KEY\' }).',
			'src/index.ts:12:41  /game call  option "note" description COIN_LONG is 101 characters in i18n/en-US.json.  Fix: shorten its en-US text to 1-100 characters.',
		]);
	});

	test('reports a plugin that registers commands without an i18n/ folder', () => {
		expect(
			problems(
				"commands.register({ coin: { description: 'COIN_FLIP', execute: () => 'x' } });",
				undefined,
			),
		).toEqual([
			'src/index.ts:1:1  /coin  registers commands, but the plugin has no i18n/ folder.  Fix: add i18n/en-US.json with a key for each command description.',
		]);
	});

	test('finds createCommands handles, unbound.commands and an imported register', () => {
		const code = `
			import { register as add } from '@unbound-app/api/commands';
			const own = commands.createCommands('demo', { section: { name: 'Demo' } });
			own.register({ a: { description: 'A text', execute: () => 'x' } });
			unbound.commands.register({ b: { description: 'B text', execute: () => 'x' } });
			add({ c: { description: 'C text', execute: () => 'x' } });
			other.register({ d: { description: 'D text' } });
		`;

		expect(problems(code, source).map((line) => line.split('  ')[1])).toEqual([
			'/a',
			'/b',
			'/c',
		]);
	});
});

describe('commandLocales', () => {
	let root: string;

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	function plugin(files: Record<string, string>) {
		root = mkdtempSync(join(tmpdir(), 'command-locales-'));

		for (const [path, content] of Object.entries(files)) {
			mkdirSync(join(root, path, '..'), { recursive: true });
			writeFileSync(join(root, path), content);
		}

		return rollup({
			input: join(root, 'src/index.ts'),
			plugins: [commandLocales(root)],
			external: () => false,
			onwarn: () => {},
		});
	}

	test('fails the build with every problem from every module', async () => {
		const build = plugin({
			'i18n/en-US.json': JSON.stringify(source),
			'src/index.ts':
				"import './more.ts';\ncommands.register({ coin: { description: 'Flip it', execute: () => 'x' } });\n",
			'src/more.ts':
				"commands.register({ more: { description: 'MORE', execute: () => 'x' } });\n",
		});

		const error = await build.catch((caught: Error) => caught);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message.split('\n')).toHaveLength(2);
		expect((error as Error).message).toContain(
			'src/index.ts:2:42  /coin  description "Flip it" is literal text',
		);
		expect((error as Error).message).toContain(
			'src/more.ts:1:42  /more  description key "MORE" is missing',
		);
	});

	test('fails a plugin without an i18n/ folder', async () => {
		const error = await plugin({
			'src/index.ts':
				"commands.register({ coin: { description: 'COIN_FLIP', execute: () => 'x' } });\n",
		}).catch((caught: Error) => caught);

		expect((error as Error).message).toContain(
			'/coin  registers commands, but the plugin has no i18n/ folder',
		);
	});

	test("imports the plugin's locale module where it registers commands", async () => {
		const bundle = await plugin({
			'i18n/en-US.json': JSON.stringify(source),
			'src/index.ts':
				"commands.register({ coin: { description: 'COIN_FLIP', execute: () => 'x' } });\n",
		});
		const { output } = await bundle.generate({ format: 'es' });

		expect(output[0].code).toStartWith("import '@unbound-app/i18n';");
	});
});
