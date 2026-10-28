// Usage: bun seed.ts <sessions.json>, run by launch.sh from apps/web with the instance env loaded.
// Seeds a user per role (session, linked GitHub), an approved addon and a pending submission.
import {
	browserSessionHeaders,
	linkGitHub,
	manifest,
	seedSubmission,
	seedVersion,
	signInWithDiscord,
} from '../../../../apps/web/tests/helpers';
import { addon, addonMaintainer } from '../../../../apps/web/src/db/schema';
import { getArtifactKeys } from '../../../../apps/web/src/lib/artifacts';
import { createAppContext } from '../../../../apps/web/src/lib/context';
import { createDatabase } from '../../../../apps/web/src/db/database';
import { toAddonSummary } from '../../../../apps/web/src/lib/addons';
import { parseEnv } from '../../../../apps/web/src/lib/env';
import { discordIdOf, ROLES } from './team';

type SeededSession = {
	userId: string;
	name: string;
	token: string;
	cookie: string;
};

// seedSubmission records 1024-byte bundles, so the staged and published bytes match that size.
const BUNDLE = new TextEncoder().encode(`console.log('verify-web');\n`.padEnd(1024, ' '));
const SHA256 = new Bun.CryptoHasher('sha256').update(BUNDLE).digest('hex');

const output = process.argv[2];

if (!output) {
	throw new Error('Pass the path to write the seeded sessions to.');
}

const env = parseEnv();
const ctx = createAppContext(env, createDatabase(env.DATABASE_URL));
const s3 = process.env.VERIFY_WEB_S3 === '1';
// The fake GitHub launch.sh starts accepts this token and lets it push to verify/addons.
const githubToken = process.env.VERIFY_WEB_GITHUB_TOKEN;
const sessions: Record<string, SeededSession> = {};

for (const role of ROLES) {
	const name = `Verify ${role[0]?.toUpperCase()}${role.slice(1)}`;
	const signedIn = await signInWithDiscord(ctx, {
		id: discordIdOf(role),
		name,
		email: `${role}@verify-web.local`,
	});
	const { internalAdapter } = await ctx.auth.$context;

	await internalAdapter.updateUser(signedIn.userId, { role });

	if (githubToken) {
		await linkGitHub(ctx, signedIn.userId, githubToken);
	}

	const cookie = (await browserSessionHeaders(ctx, signedIn.token)).get('cookie') ?? '';

	sessions[role] = { userId: signedIn.userId, name, token: signedIn.token, cookie };
}

const developer = sessions.developer;
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
	sessions.user.userId,
	manifest('verify.pending', '0.1.0', {
		name: 'Verify Pending',
		description: 'Seeded by verify-web, waiting for review.',
		type: 'plugin',
	}),
	{ sha256: SHA256 },
	{ repository: 'verify/addons', path: 'plugins/verify.pending' },
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
await ctx.db.$client.end();

console.log(`seeded ${ROLES.join(', ')}; addon verify.hello; pending submission ${pending.id}`);
