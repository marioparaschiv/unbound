// Real `GET /api/v1/catalog` endpoint over a seeded throwaway Postgres database, plus a CDN for the
// seeded files. The database is dropped on SIGINT or SIGTERM.
import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import {
	createTestContext,
	manifest,
	seedVersion,
	signInWithDiscord,
} from '../../../../apps/web/tests/helpers/index';
import getCatalogEndpoint from '../../../../apps/web/src/endpoints/get-catalog';
import { resolveDevHost } from '../../../../packages/client/scripts/dev-host';
import { eq } from '../../../../apps/web/node_modules/drizzle-orm/index.js';
import { addon, addonMaintainer } from '../../../../apps/web/src/db/schema';
import { toAddonSummary } from '../../../../apps/web/src/lib/addons';

const PORT = Number(process.env.PORT ?? 3200);
const ORIGIN = `http://${resolveDevHost()}:${PORT}`;

const { ctx, close } = await createTestContext({ CDN_URL: `${ORIGIN}/cdn/` });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => void close().finally(() => process.exit(0)));
}

const { userId } = await signInWithDiscord(ctx, {
	id: '80351110224679003',
	name: 'Seeder',
	email: 's@example.com',
});

function bundleFor(type: string, id: string, version: string): string {
	if (type === 'theme') {
		return JSON.stringify({ id, name: id, semantic: {}, raw: {} });
	}

	return `({ start() { console.log('marketplace ${id} ${version} started'); }, stop() {} })`;
}

const sha = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex');

async function approve(id: string, version: string, overrides: Partial<PublishedManifest>) {
	const published = manifest(id, version, overrides);
	const type = overrides.type ?? 'plugin';
	const exists = await ctx.db.query.addon.findFirst({ where: { id } });

	if (!exists) {
		await ctx.db
			.insert(addon)
			.values({ id, createdAt: ctx.now(), ...toAddonSummary(published, ctx.now()) });
		await ctx.db.insert(addonMaintainer).values({ addonId: id, userId, role: 'owner' });
	}

	await seedVersion(ctx, userId, published, sha(bundleFor(type, id, version)));
}

const seeds: [string, string, Partial<PublishedManifest>][] = [
	[
		'mp.quiet-reactions',
		'1.0.0',
		{
			name: 'Quiet Reactions',
			description: 'Collapses reaction rows until you tap them.',
			authors: [{ name: 'Ari', id: '1234567890' }],
		},
	],
	[
		'mp.message-timestamps',
		'2.3.1',
		{
			name: 'Message Timestamps',
			description: 'Shows exact send times next to every message, in your locale.',
			authors: [{ name: 'Noelle', id: '1234567891' }],
		},
	],
	[
		'mp.clean-embeds',
		'1.4.0',
		{
			name: 'Clean Embeds',
			description: 'Strips tracking parameters from links before embeds load.',
			authors: [{ name: 'Mika', id: '1234567892' }],
		},
	],
	[
		'mp.midnight',
		'1.0.0',
		{
			name: 'Midnight',
			description: 'A deep blue dark theme with softer contrast.',
			type: 'theme',
			main: 'theme.json',
			authors: [{ name: 'Ari', id: '1234567890' }],
		},
	],
	[
		'mp.paper',
		'0.9.0',
		{
			name: 'Paper',
			description: 'Warm off-white surfaces for daytime reading.',
			type: 'theme',
			main: 'theme.json',
			authors: [{ name: 'Noelle', id: '1234567891' }],
		},
	],
	[
		'mp.outline-icons',
		'1.2.0',
		{
			name: 'Outline Icons',
			description: 'Thin outline replacements for the tab bar icons.',
			type: 'icon-pack',
			main: 'pack.json',
			authors: [{ name: 'Mika', id: '1234567892' }],
		},
	],
	[
		'mp.inter',
		'4.0.0',
		{
			name: 'Inter',
			description: 'The Inter typeface for every text style.',
			type: 'font',
			main: 'Inter.ttf',
			authors: [{ name: 'Rasmus', id: '1234567893' }],
		},
	],
];

for (const [id, version, overrides] of seeds) await approve(id, version, overrides);

const typeOf = new Map(seeds.map(([id, , o]) => [id, (o.type as string) ?? 'plugin']));

Bun.serve({
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url);
		let response: Response;

		if (url.pathname === '/api/v1/catalog') {
			response = await getCatalogEndpoint.handle(ctx, request);
		} else if (url.pathname.startsWith('/cdn/addons/')) {
			const [, , , id = '', version = '', file = ''] = url.pathname.split('/');
			const row = await ctx.db.query.addonVersion.findFirst({
				where: { addonId: id, version },
			});

			response = !row
				? new Response('missing', { status: 404 })
				: file === 'manifest.json'
					? Response.json(row.manifest)
					: new Response(bundleFor(typeOf.get(id) ?? 'plugin', id, version));
		} else if (url.pathname === '/__approve' && request.method === 'POST') {
			const id = url.searchParams.get('id') ?? '';
			const version = url.searchParams.get('version') ?? '';
			const current = await ctx.db.query.addonVersion.findFirst({
				where: { addonId: id },
				orderBy: { versionKey: 'desc' },
			});

			await approve(id, version, { ...current?.manifest, version });
			response = new Response(`approved ${id}@${version}\n`);
		} else if (url.pathname === '/__delist' && request.method === 'POST') {
			const id = url.searchParams.get('id') ?? '';

			await ctx.db.update(addon).set({ delistedAt: ctx.now() }).where(eq(addon.id, id));
			response = new Response(`delisted ${id}\n`);
		} else {
			response = new Response('not found', { status: 404 });
		}

		const inm = request.headers.get('if-none-match');

		console.log(
			`${new Date().toISOString()} ${request.method} ${url.pathname} -> ${response.status}${inm ? ` (If-None-Match ${inm})` : ''}${response.headers.get('etag') ? ` ETag ${response.headers.get('etag')}` : ''}`,
		);

		return response;
	},
});

console.log(`catalog server on ${ORIGIN}`);
