import { resolve } from 'node:path';

import { FLUENT_COMMIT, FLUENT_REPOSITORY } from '../src/lib/sources';

const NOTO_ANIMATED_INDEX = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json';
const SKIN_TONE = /1f3f[b-f]/g;
const output = resolve(import.meta.dir, '../src/lib/coverage.json');

type Tree = { tree: { path: string; type: string }[] };
type NotoIndex = { icons: { codepoint: string }[] };

function shortKey(points: string[]): string {
	return points
		.map((point) => point.replace(/^0+/, ''))
		.join('-')
		.replace(/-200d-/g, '+')
		.replace(/-fe0f/g, '!');
}

function folded(keys: Set<string>): string {
	const byTemplate = new Map<string, string[]>();

	for (const key of keys) {
		const template = key.replace(SKIN_TONE, 'T');
		byTemplate.set(template, [...(byTemplate.get(template) ?? []), key]);
	}

	const listed: string[] = [];

	for (const [template, members] of byTemplate) {
		const tones = template.split('T').length - 1;

		if (tones > 0 && members.length === 5 ** tones) listed.push(template);
		else listed.push(...members);
	}

	return listed.sort().join(' ');
}

async function fluentFolder(folder: string): Promise<Set<string>> {
	const response = await fetch(
		`https://api.github.com/repos/${FLUENT_REPOSITORY}/git/trees/${FLUENT_COMMIT}:${folder}`,
	);
	if (!response.ok) throw new Error(`Failed to list Fluent ${folder}: ${response.status}`);
	const { tree } = (await response.json()) as Tree;

	return new Set(
		tree
			.filter(({ path, type }) => type === 'blob' && path.endsWith('.png'))
			.map(({ path }) => shortKey(path.slice(0, -4).split('-'))),
	);
}

async function notoAnimated(): Promise<Set<string>> {
	const response = await fetch(NOTO_ANIMATED_INDEX);
	if (!response.ok) throw new Error(`Failed to list animated Noto: ${response.status}`);
	const { icons } = (await response.json()) as NotoIndex;

	return new Set(icons.map(({ codepoint }) => shortKey(codepoint.split('_'))));
}

const animated = await fluentFolder('animated-static');
const still = await fluentFolder('static');

await Bun.write(
	output,
	`${JSON.stringify(
		{
			fluentAnimated: folded(animated),
			fluentStill: folded(new Set([...still].filter((key) => !animated.has(key)))),
			notoAnimated: folded(await notoAnimated()),
		},
		null,
		'\t',
	)}\n`,
);
