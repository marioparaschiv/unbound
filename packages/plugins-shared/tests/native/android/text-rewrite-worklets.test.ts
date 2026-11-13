import { describe, expect, test } from 'bun:test';

const FILES = [
	'text-rewrite-state.ts',
	'text-rewrite-spans.ts',
	'text-rewrite-hosts.ts',
	'text-rewrite-worklets.ts',
];

type Worklet = { name: string; body: string };

async function worklets(file: string): Promise<Worklet[]> {
	const source = await Bun.file(
		new URL(`../../../src/native/android/${file}`, import.meta.url),
	).text();

	return [...source.matchAll(/^(?:export )?function (\w+)\([\s\S]*?^}/gm)].map((match) => ({
		name: match[1],
		body: match[0],
	}));
}

describe.each(FILES)('text rewrite worklets in %s', (file) => {
	test('are all worklets', async () => {
		for (const { name, body } of await worklets(file)) {
			expect({ name, worklet: body.includes("'worklet';") }).toEqual({ name, worklet: true });
		}
	});

	test('call only worklets defined above them, since a worklet captures its closure where it is defined', async () => {
		const found = await worklets(file);
		const defined = found.map((worklet) => worklet.name);

		for (const [index, { name, body }] of found.entries()) {
			const later = defined
				.slice(index + 1)
				.filter((other) => new RegExp(`\\b${other}\\(`).test(body));

			expect({ name, later }).toEqual({ name, later: [] });
		}
	});
});
