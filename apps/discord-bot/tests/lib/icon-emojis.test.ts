import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { REST } from 'discord.js';

import { syncIconEmojis, type IconEmojiSpec } from '~/lib/icon-emojis';

type Emoji = { id: string; name: string };

const APP = '42';
const SPECS: Record<'ban' | 'warn', IconEmojiSpec> = {
	ban: { icon: 'IconGavel', colour: 0xff_00_00 },
	warn: { icon: 'IconTriangleWarning', colour: 0xf0_b2_32 },
};

describe('syncIconEmojis', () => {
	let emojis: Emoji[];
	let uploads: string[];
	let server: ReturnType<typeof Bun.serve>;
	let rest: REST;

	beforeEach(() => {
		emojis = [{ id: '9', name: 'mb_plug' }];
		uploads = [];
		server = Bun.serve({
			port: 0,
			async fetch(request) {
				const { pathname } = new URL(request.url);
				const route = `/api/v10/applications/${APP}/emojis`;

				if (request.method === 'GET' && pathname === route) {
					return Response.json({ items: emojis });
				}

				if (request.method === 'POST' && pathname === route) {
					const { name } = (await request.json()) as { name: string };
					const created = { id: String(100 + uploads.length), name };

					uploads.push(name);
					emojis.push(created);

					return Response.json(created);
				}

				if (request.method === 'DELETE' && pathname.startsWith(`${route}/`)) {
					const id = pathname.slice(route.length + 1);

					emojis = emojis.filter((emoji) => emoji.id !== id);

					return new Response(null, { status: 204 });
				}

				return new Response(null, { status: 404 });
			},
		});
		rest = new REST({ api: `http://localhost:${server.port}/api` }).setToken('fake');
	});

	afterEach(() => {
		void server.stop(true);
	});

	test('uploads each icon once, named by its design', async () => {
		const first = await syncIconEmojis(rest, APP, 'mb_case_', SPECS);
		const second = await syncIconEmojis(rest, APP, 'mb_case_', SPECS);

		expect(uploads).toHaveLength(2);
		expect(first.get('ban')?.name).toMatch(/^mb_case_ban_[\da-f]{6}$/);
		expect([...second]).toEqual([...first]);
	});

	test("replaces a changed design and deletes the old one, leaving others' emojis alone", async () => {
		const before = await syncIconEmojis(rest, APP, 'mb_case_', SPECS);
		const after = await syncIconEmojis(rest, APP, 'mb_case_', {
			...SPECS,
			ban: { icon: 'IconGavel', colour: 0x00_ff_00 },
		});

		expect(after.get('ban')?.name).not.toBe(before.get('ban')?.name);
		expect(after.get('warn')).toEqual(before.get('warn'));
		expect(emojis.map(({ name }) => name).sort()).toEqual(
			['mb_plug', after.get('ban')?.name ?? '', after.get('warn')?.name ?? ''].sort(),
		);
	});
});
