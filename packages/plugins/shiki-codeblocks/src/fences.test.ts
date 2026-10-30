import { describe, expect, test } from 'bun:test';

import { locateCodeBlocks, parseFencedCodeBlocks } from './fences';

describe('parseFencedCodeBlocks', () => {
	test('parses supported blocks and preserves indentation', () => {
		expect(
			parseFencedCodeBlocks(
				'Before\n```ts title=example.ts\nconst answer = 42;\n    return answer;\n```\nAfter',
			),
		).toEqual([{ code: 'const answer = 42;\n    return answer;', language: 'typescript' }]);
	});

	test('normalizes CRLF fences and keeps unsupported blocks as plain', () => {
		expect(
			parseFencedCodeBlocks('```brainfuck\n++++\n```\n~~~js\r\nconsole.log(1);\r\n~~~'),
		).toEqual([
			{ code: '++++', language: 'plain' },
			{ code: 'console.log(1);', language: 'javascript' },
		]);
	});

	test('keeps the original code for copying when blank lines were trimmed', () => {
		const [block] = parseFencedCodeBlocks('```ts\n\nconst answer = 42;\n\n```');

		expect(block.code).toBe('const answer = 42;');
		expect(block.originalCode).toBe('\nconst answer = 42;\n');
		expect(locateCodeBlocks([block], '\nconst answer = 42;\n')).toHaveLength(1);
	});

	test('treats an unlabelled fence as plain', () => {
		expect(parseFencedCodeBlocks('Before\n```\nplain value\n```\nAfter')).toEqual([
			{ code: 'plain value', language: 'plain' },
		]);
	});

	test('keeps a language only Highlight.js knows', () => {
		expect(parseFencedCodeBlocks('```php-template\n<?php echo 1; ?>\n```')).toEqual([
			{ code: '<?php echo 1; ?>', language: 'plain', sourceLanguage: 'php-template' },
		]);
	});

	test('rejects mismatched or too-short fences', () => {
		expect(
			parseFencedCodeBlocks('```ts\nconst value = 1;\n~~\n~~~ts\nconst value = 2;\n~~~'),
		).toEqual([]);
	});

	test('keeps shorter fence lines inside a longer fenced block', () => {
		expect(
			parseFencedCodeBlocks('````ts\nconst text = "```";\n```\nconst after = true;\n````'),
		).toEqual([
			{ code: 'const text = "```";\n```\nconst after = true;', language: 'typescript' },
		]);
	});
});

describe('locateCodeBlocks', () => {
	test('leaves long fences alone when Discord splits their native rendering', () => {
		const blocks = parseFencedCodeBlocks(
			'Long fence parser test.\n\n````ts\nconst fence = "```";\n```\nconst kept = true;\n````\n\nThis sentence must stay below the one card.',
		);
		const rendered =
			'Long fence parser test.\n\n\n`ts\nconst fence = "\n\n";\n\nconst kept = true;\n\n`\n\nThis sentence must stay below the one card.';

		expect(locateCodeBlocks(blocks, rendered)).toEqual([]);
	});

	test('locates a block between ordinary text without covering the text', () => {
		const blocks = parseFencedCodeBlocks(
			'Before the code block.\n\n```ts\nconst answer = 42;\n```\n\nAfter the code block.',
		);
		const rendered =
			'Before the code block.\n\n\nconst answer = 42;\n\n\nAfter the code block.';
		const [placement] = locateCodeBlocks(blocks, rendered);

		expect(placement.block).toBe(blocks[0]);
		expect(rendered.slice(0, placement.start)).toBe('Before the code block.');
		expect(rendered.slice(placement.end)).toBe('After the code block.');
	});

	test('locates multiple blocks in order and leaves the text between them', () => {
		const blocks = parseFencedCodeBlocks(
			'Before\n```ts\nconst value = 1;\n```\nBetween\n```py\nprint(2)\n```\nAfter',
		);
		const rendered = 'Before\n\nconst value = 1;\n\nBetween\n\nprint(2)\n\nAfter';
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toHaveLength(2);
		expect(rendered.slice(placements[0].end, placements[1].start)).toBe('Between');
		expect(rendered.slice(placements[1].end)).toBe('After');
	});

	test('preserves message-link attachment text around a block', () => {
		const blocks = parseFencedCodeBlocks(
			'Before https://discord.com/channels/709061970078335027/709062739581992971/1555962053007769671\n```ts\nconst value = 1;\n```\nAfter',
		);
		const prefix = 'Before \uFFFC\u2068development\u2069';
		const rendered = `${prefix}\nconst value = 1;\nAfter`;
		const [placement] = locateCodeBlocks(blocks, rendered);

		expect(rendered.slice(0, placement.start)).toBe(prefix);
		expect(rendered.slice(placement.end)).toBe('After');
	});

	test('keeps repeated code in separate fences apart', () => {
		const blocks = parseFencedCodeBlocks(
			'```ts\nconst same = true;\n```\nBetween\n```ts\nconst same = true;\n```',
		);
		const rendered = '\nconst same = true;\n\nBetween\n\nconst same = true;\n';
		const placements = locateCodeBlocks(blocks, rendered);

		expect(placements).toHaveLength(2);
		expect(rendered.slice(placements[0].end, placements[1].start)).toBe('Between');
	});

	test('skips code that also occurs outside a block', () => {
		const blocks = parseFencedCodeBlocks('```ts\nconst value = 1;\n```');

		expect(locateCodeBlocks(blocks, 'const value = 1;\nconst value = 1;')).toEqual([]);
		expect(locateCodeBlocks([...blocks, ...blocks], '\nconst value = 1;\n')).toEqual([]);
	});

	test('finds a block whose tabs Discord rendered as spaces', () => {
		const [block] = parseFencedCodeBlocks(
			'```ts\nfunction double(value: number) {\n\treturn value * 2;\n}\n```',
		);
		const rendered = '\n\nfunction double(value: number) {\n    return value * 2;\n}\n\n';
		const placements = locateCodeBlocks([block!], rendered);

		expect(placements).toHaveLength(1);
		expect(placements[0]!.block.code).toContain('\treturn');
		expect(rendered.slice(placements[0]!.start, placements[0]!.end)).toContain('    return');
	});
});
