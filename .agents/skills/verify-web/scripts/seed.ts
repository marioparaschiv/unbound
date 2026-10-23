// Usage: bun seed.ts <sessions.json>, run by launch.sh with apps/web as cwd and the instance env loaded.
// Seeds one user per role with a live session, an approved addon and a pending submission.
import {
	browserSessionHeaders,
	manifest,
	seedSubmission,
	seedVersion,
	signInWithDiscord,
	snowflakeAt,
} from '../../../../apps/web/tests/helpers';
import { addon, addonMaintainer } from '../../../../apps/web/src/db/schema';
import { getArtifactKeys } from '../../../../apps/web/src/lib/artifacts';
import { createAppContext } from '../../../../apps/web/src/lib/context';
import { createDatabase } from '../../../../apps/web/src/db/database';
import { toAddonSummary } from '../../../../apps/web/src/lib/addons';
import { parseEnv } from '../../../../apps/web/src/lib/env';

type SeededSession = {
	userId: string;
	name: string;
	token: string;
	cookie: string;
};

const ROLES = ['user', 'developer', 'moderator', 'admin'] as const;
// seedSubmission records 1024-byte bundles, so the staged and published bytes match that size.
const BUNDLE = new TextEncoder().encode(`console.log('verify-web');\n`.padEnd(1024, ' '));
const SHA256 = new Bun.CryptoHasher('sha256').update(BUNDLE).digest('hex');
const ACCOUNT_CREATED = new Date('2020-01-01T00:00:00Z');

const output = process.argv[2];

if (!output) {
	throw new Error('Pass the path to write the seeded sessions to.');
}

const env = parseEnv();
const ctx = createAppContext(env, createDatabase(env.DATABASE_PATH));
const s3 = process.env.VERIFY_WEB_S3 === '1';
const sessions: Record<string, SeededSession> = {};

for (const [index, role] of ROLES.entries()) {
	const name = `Verify ${role[0]?.toUpperCase()}${role.slice(1)}`;
	const signedIn = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date(ACCOUNT_CREATED.getTime() + index)),
		name,
		email: `${role}@verify-web.local`,
	});
	const { internalAdapter } = await ctx.auth.$context;

	await internalAdapter.updateUser(signedIn.userId, { role });

	const cookie = (await browserSessionHeaders(ctx, signedIn.token)).get('cookie') ?? '';

	sessions[role] = { userId: signedIn.userId, name, token: signedIn.token, cookie };
}

const developer = sessions.developer!;
const approved = manifest('verify.hello', '1.0.0', {
	name: 'Verify Hello',
	description: 'Seeded by verify-web.',
	type: 'plugin',
	authors: [{ name: developer.name, id: '1234567890' }],
});

await ctx.db.insert(addon).values({
	id: approved.id,
	createdAt: ctx.now(),
	...toAddonSummary(approved, ctx.now()),
});
await ctx.db
	.insert(addonMaintainer)
	.values({ addonId: approved.id, userId: developer.userId, role: 'owner' });
await seedVersion(ctx, developer.userId, approved, SHA256);

const pending = await seedSubmission(
	ctx,
	sessions.user!.userId,
	manifest('verify.pending', '0.1.0', {
		name: 'Verify Pending',
		description: 'Seeded by verify-web, waiting for review.',
		type: 'plugin',
	}),
	{ sha256: SHA256 },
);

if (s3) {
	const keys = getArtifactKeys(approved.id, approved.version, approved.main);

	await Promise.all([
		ctx.storage.staging.write(pending.stagingKey, BUNDLE),
		ctx.storage.public.write(keys.bundle, BUNDLE),
		ctx.storage.public.write(keys.manifest, JSON.stringify(approved), {
			type: 'application/json',
		}),
	]);
}

await Bun.write(output, JSON.stringify(sessions, null, '\t'));
ctx.db.$client.close();

console.log(`seeded ${ROLES.join(', ')}; addon verify.hello; pending submission ${pending.id}`);
