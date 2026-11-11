import type {
	ListFirstPartyAddonsResponse,
	PublishFirstPartyRequest,
	PublishFirstPartyResponse,
} from '@unbound-app/contracts/publish';
import { sql } from 'drizzle-orm';

import { isSameRepository, publish } from '~/lib/publish-version';
import { readAddonSource } from '~/lib/addon-source';
import { requirePermission } from '~/lib/api/caller';
import { connectGitHubIfLinked } from '~/lib/github';
import { VERSION_SOURCE } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';

/** CI tags each build commit under this prefix; no other branch or tag of the repository is first-party. */
const BUILD_TAG_PREFIX = 'plugin-builds/';

function requireFirstPartyRepository(ctx: AppContext, caller: Caller): string {
	if (caller.via !== 'api-key') {
		throw new ApiError('forbidden', 'First-party addons are published with an API key.');
	}

	requirePermission(caller, { firstParty: ['publish'] });

	const repository = ctx.env.FIRST_PARTY_REPOSITORY;

	if (!repository) {
		throw new ApiError('forbidden', 'First-party publishing is not configured.');
	}

	return repository;
}

/**
 * @description Publishes a first-party addon from a build commit of `FIRST_PARTY_REPOSITORY` without
 * review, read from GitHub exactly as a submission is. Only an API key with `firstParty: ['publish']` may.
 * @param ctx The application context.
 * @param caller The caller; must use an API key.
 * @param request The repository, addon path, build tag and its commit.
 * @returns `published`, `replaced` for a rebuild of a live version, or `unchanged` with the live
 * bundle's SHA-256 when the version already exists.
 */
export async function publishFirstParty(
	ctx: AppContext,
	caller: Caller,
	request: PublishFirstPartyRequest,
): Promise<PublishFirstPartyResponse> {
	const repository = requireFirstPartyRepository(ctx, caller);

	if (!isSameRepository(request.repository, repository)) {
		throw new ApiError('forbidden', `Only ${repository} publishes first-party addons.`);
	}

	if (!request.ref.startsWith(BUILD_TAG_PREFIX)) {
		throw new ApiError(
			'forbidden',
			`First-party addons are published from ${BUILD_TAG_PREFIX}* tags.`,
		);
	}

	// CI has no push-capable GitHub link; the API key and the repository check are the trust.
	const github = await connectGitHubIfLinked(ctx, caller.user.id);
	const source = await readAddonSource(ctx, github, request, false);
	const { manifest, pin } = source;

	if (!isSameRepository(pin.repository, repository)) {
		throw new ApiError('forbidden', `${pin.repository} is not ${repository}.`);
	}

	const { status, sha256 } = await publish(ctx, {
		mode: 'first-party',
		source,
		caller,
		repository,
	});

	return { status, addonId: manifest.id, version: manifest.version, sha256 };
}

/**
 * @description Lists every addon of `FIRST_PARTY_REPOSITORY`, delisted ones included, at its newest
 * published version, so CI never rebuilds a version the server would answer `unchanged` for.
 * @param ctx The application context.
 * @param caller The caller; must use an API key with `firstParty: ['publish']`.
 * @returns The addons, ordered by id.
 */
export async function listFirstPartyAddons(
	ctx: AppContext,
	caller: Caller,
): Promise<ListFirstPartyAddonsResponse> {
	const repository = requireFirstPartyRepository(ctx, caller);
	const rows = await ctx.db.query.addon.findMany({
		where: { RAW: (table) => sql`lower(${table.repository}) = lower(${repository}::text)` },
		columns: { id: true },
		with: {
			versions: {
				columns: { version: true, sha256: true, manifest: true },
				orderBy: { versionKey: 'desc' },
				limit: 1,
				with: VERSION_SOURCE,
			},
		},
		orderBy: { id: 'asc' },
	});

	const addons = rows.flatMap(({ id, versions: [newest] }) =>
		newest
			? [
					{
						id,
						version: newest.version,
						commitSha: newest.submission?.source?.commitSha ?? null,
						sha256: newest.sha256,
						...(newest.manifest.bytecode ? { bytecode: newest.manifest.bytecode } : {}),
					},
				]
			: [],
	);

	return { addons };
}

export default { publishFirstParty, listFirstPartyAddons };
