// Usage: bun seed-tags.ts <sessions.json>, run by launch.sh --tags after seed.ts, from apps/web with the instance env loaded.
// Seeds tags and enough tagged plugins and themes, by enough authors, to filter and page the author menu.
import { addon, addonMaintainer, addonTag, tag } from '../../../../apps/web/src/db/schema';
import type { DiscordId } from '../../../../apps/web/src/lib/authors/discord-users';
import { manifest, seedVersion } from '../../../../apps/web/tests/helpers';
import { createAppContext } from '../../../../apps/web/src/lib/context';
import { createDatabase } from '../../../../apps/web/src/db/database';
import { toAddonSummary } from '../../../../apps/web/src/lib/addons';
import { parseEnv } from '../../../../apps/web/src/lib/env';

type Seed = [id: string, name: string, tags: string[], authors: number[], daysAgo: number];

const TAGS = [
	{ id: 'appearance', label: 'Appearance', color: '#8b5cf6' },
	{ id: 'messages', label: 'Messages', color: '#0ea5e9' },
	{ id: 'privacy', label: 'Privacy', color: '#10b981' },
	{ id: 'utility', label: 'Utility', color: '#94a3b8' },
	{ id: 'voice', label: 'Voice', color: '#f97316' },
	{ id: 'media', label: 'Media', color: '#ec4899' },
	{ id: 'accessibility', label: 'Accessibility', color: '#14b8a6' },
	{ id: 'fun', label: 'Fun', color: '#f43f5e' },
];

const AUTHORS = [
	'Mira',
	'Ansel',
	'Kiwi',
	'Rosie',
	'Theo',
	'Juno',
	'Bea',
	'Cass',
	'Dex',
	'Fern',
	'Gus',
	'Hana',
	'Ivo',
	'Lumi',
	'Otto',
	'Wren',
];

const PLUGINS: Seed[] = [
	['tags.logger', 'Message Logger', ['messages', 'privacy'], [0], 2],
	['tags.folders', 'Better Folders', ['appearance', 'utility'], [1], 12],
	['tags.silent', 'Silent Typing', ['privacy', 'messages'], [2], 40],
	['tags.boost', 'Voice Volume Boost', ['voice', 'accessibility'], [3, 0], 5],
	['tags.zoom', 'Image Zoom', ['media', 'utility'], [4], 80],
	['tags.translate', 'Translate', ['messages', 'accessibility'], [5], 20],
	['tags.quiet', 'Quiet Hours', ['utility'], [6], 150],
	['tags.spotify', 'Spotify Controls', ['media', 'voice'], [7], 220],
	['tags.party', 'Party Mode', ['fun', 'appearance'], [8], 400],
	['tags.spoilers', 'Reveal Spoilers', ['messages', 'accessibility'], [9, 0], 33],
	['tags.soundboard', 'Soundboard Plus', ['voice', 'fun'], [10], 48],
	['tags.blocked', 'Hide Blocked', ['privacy', 'messages'], [11], 27],
	['tags.motion', 'Reduced Motion', ['accessibility', 'appearance'], [12], 110],
	['tags.untagged', 'Plain Plugin', [], [13], 3],
];

const THEMES: Seed[] = [
	['tags.midnight', 'Midnight', ['appearance'], [14], 6],
	['tags.sakura', 'Sakura', ['appearance', 'fun'], [15, 0], 45],
	['tags.contrast', 'High Contrast', ['accessibility', 'appearance'], [1], 200],
	['tags.retro', 'Retro Terminal', ['fun'], [4], 9],
];

const DAY_MS = 24 * 60 * 60 * 1000;

const output = process.argv[2];

if (!output) {
	throw new Error('Pass the path seed.ts wrote the seeded sessions to.');
}

const sessions = await Bun.file(output).json();
const ownerId: string = sessions.developer.userId;
const env = parseEnv();
const ctx = createAppContext(env, createDatabase(env.DATABASE_URL));

function authorId(index: number): DiscordId {
	return `${100_000_000_000_000_100n + BigInt(index)}`;
}

await ctx.db.insert(tag).values(TAGS.map((entry, position) => ({ ...entry, position })));

for (const [seeds, type] of [
	[PLUGINS, 'plugin'],
	[THEMES, 'theme'],
] as const) {
	for (const [id, name, tags, authors, daysAgo] of seeds) {
		const at = new Date(ctx.now().getTime() - daysAgo * DAY_MS);
		const published = manifest(id, '1.0.0', {
			name,
			description: `${name}, seeded by verify-web for the listing filters.`,
			type,
			authors: authors.map((index) => ({
				name: AUTHORS[index] ?? 'Unknown',
				id: authorId(index),
			})),
		});

		await ctx.db.insert(addon).values({ id, createdAt: at, ...toAddonSummary(published, at) });
		await ctx.db
			.insert(addonMaintainer)
			.values({ addonId: id, userId: ownerId, role: 'owner' });
		await seedVersion({ ...ctx, now: () => at }, ownerId, published);

		if (tags.length > 0) {
			await ctx.db.insert(addonTag).values(tags.map((tagId) => ({ addonId: id, tagId })));
		}
	}
}

await ctx.db.$client.end();

console.log(
	`seeded ${TAGS.length} tags, ${PLUGINS.length} plugins and ${THEMES.length} themes by ${AUTHORS.length} authors`,
);
