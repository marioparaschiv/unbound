import { describe, expect, test } from 'bun:test';

import { runnableBlocks } from '~/lib/code-blocks';
import { readRun } from '~/lib/compiler-explorer';

describe('runnableBlocks', () => {
	test('finds fenced blocks in languages Compiler Explorer runs', () => {
		const content =
			'try:\n```py\nprint(2)\n```\nand ```cpp\nint main(){}\n```\n```text\nnope\n```';

		expect(runnableBlocks(content)).toEqual([
			{ language: 'python', code: 'print(2)\n' },
			{ language: 'c++', code: 'int main(){}\n' },
		]);
	});

	test('skips blocks without a language or code', () => {
		expect(runnableBlocks('```\nprint(1)\n```\n```js\n\n```')).toEqual([]);
	});
});

describe('readRun', () => {
	test('reads the output and exit code of a program that ran', () => {
		expect(
			readRun({ code: 3, didExecute: true, stdout: [{ text: 'hi' }], stderr: [] }),
		).toEqual({
			output: 'hi',
			exitCode: 3,
		});
	});

	test('shows the build errors without colours when it did not build', () => {
		expect(
			readRun({
				code: -1,
				didExecute: false,
				buildResult: {
					code: 1,
					stderr: [{ text: '\u001b[01;31merror:\u001b[m x not declared' }],
				},
			}),
		).toEqual({ output: 'error: x not declared', exitCode: -1 });
	});
});
