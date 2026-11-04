import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
	FIXTURE_DIR,
	assignFiles,
	checkPage,
	examplePages,
	extractExamples,
	parseErrors,
	quoteProblem,
} from './docs-examples';
import { REPO_ROOT } from './paths';

const PAGE = `---
title: 'A page'
---

Some text.

\`\`\`ts src/a.ts
export const a = 1;
\`\`\`

<Steps>
	<Step title='One'>
		\`\`\`tsx src/a.ts partial
		const fragment = <View />;
		\`\`\`
	</Step>
</Steps>

\`\`\`json manifest.json quoted
{}
\`\`\`

\`\`\`ts
const untitled = 1;
\`\`\`
`;

describe('extractExamples', () => {
	test('finds each fence, inside JSX too, and splits the flag from the title', () => {
		const examples = extractExamples(PAGE, 'docs/a.mdx');

		expect(examples.map(({ lang, title, flag }) => ({ lang, title, flag }))).toEqual([
			{ lang: 'ts', title: 'src/a.ts', flag: undefined },
			{ lang: 'tsx', title: 'src/a.ts', flag: 'partial' },
			{ lang: 'json', title: 'manifest.json', flag: 'quoted' },
			{ lang: 'ts', title: undefined, flag: undefined },
		]);
		expect(examples[0]?.line).toBe(7);
	});
});

describe('assignFiles', () => {
	test('gives a repeated title to its last block and moves earlier ones under snippets', () => {
		const [first, second, untitled] = extractExamples(
			'```ts src/a.ts\n1\n```\n\n```ts src/a.ts\n2\n```\n\n```tsx\n3\n```\n',
			'docs/a.mdx',
		);
		const files = assignFiles([first!, second!, untitled!]).map(({ file }) => file);

		expect(files).toEqual(['snippets/00-a.ts', 'src/a.ts', 'snippets/02-example.tsx']);
	});
});

describe('parseErrors', () => {
	test('puts an error on the page line of its block and joins the continuation lines', () => {
		const [example] = extractExamples('text\n\n```ts src/a.ts\nbad\n```\n', 'docs/a.mdx');
		const snippets = assignFiles([example!]);
		const output = "src/a.ts(1,1): error TS2304: Cannot find name 'bad'.\n  More detail.\n";

		expect(parseErrors(output, snippets, 'docs/a.mdx')).toEqual([
			{
				page: 'docs/a.mdx',
				line: 4,
				message: "error TS2304: Cannot find name 'bad'. (src/a.ts)\nMore detail.",
			},
		]);
	});
});

describe('quoteProblem', () => {
	test('accepts a block equal to its file and rejects one that drifted', async () => {
		const file = await Bun.file(
			join(REPO_ROOT, 'packages/plugins/character-counter/settings.ts'),
		).text();
		const quoted = extractExamples(
			`\`\`\`ts settings.ts quoted\n${file}\`\`\`\n`,
			'docs/a.mdx',
		);
		const drifted = extractExamples(
			`\`\`\`ts settings.ts quoted\n${file.replace('true', 'false')}\`\`\`\n`,
			'docs/a.mdx',
		);

		expect(await quoteProblem(quoted[0]!)).toBeUndefined();
		expect(await quoteProblem(drifted[0]!)).toContain('differs from settings.ts');
	});
});

describe('the fixture plugin', () => {
	test('has a generated typing for every message key', async () => {
		const messages = await Bun.file(join(FIXTURE_DIR, 'i18n/en-US.json')).json();
		const typings = await Bun.file(join(FIXTURE_DIR, 'src/unbound-i18n.d.ts')).text();

		for (const key of Object.keys(messages)) {
			expect(typings).toContain(`readonly ${key}: string;`);
		}
	});
});

describe('the developer guide examples', () => {
	for (const page of examplePages()) {
		test(`${page} has no type errors in its ts and tsx blocks`, async () => {
			const source = await Bun.file(join(REPO_ROOT, page)).text();
			const report = await checkPage(source, page);

			expect(report.errors.map(({ line, message }) => `${page}:${line} ${message}`)).toEqual(
				[],
			);
		}, 120_000);
	}
});
