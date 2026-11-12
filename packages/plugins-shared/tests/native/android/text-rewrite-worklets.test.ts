import { describe, expect, test } from 'bun:test';

const source = await Bun.file(
	new URL('../../../src/native/android/text-rewrite-worklets.ts', import.meta.url),
).text();

function worklets(): { name: string; body: string }[] {
	return [...source.matchAll(/^(?:export )?function (\w+)\([\s\S]*?^}/gm)].map((match) => ({
		name: match[1]!,
		body: match[0],
	}));
}

describe('text rewrite worklets', () => {
	test('are all worklets', () => {
		for (const { name, body } of worklets()) {
			expect({ name, worklet: body.includes("'worklet';") }).toEqual({ name, worklet: true });
		}
	});

	test('call only worklets defined above them, since a worklet captures its closure where it is defined', () => {
		const defined = worklets().map((worklet) => worklet.name);

		for (const [index, { name, body }] of worklets().entries()) {
			const later = defined
				.slice(index + 1)
				.filter((other) => new RegExp(`\\b${other}\\(`).test(body));

			expect({ name, later }).toEqual({ name, later: [] });
		}
	});
});
