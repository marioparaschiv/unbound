import { formatChangelogIssues, parseChangelog } from '@unbound-app/contracts/changelog';
import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { Submission } from '@unbound-app/contracts/publish';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GitSource, GitSourceOverrides } from '~/lib/git';
import type { DiscoveredAddon } from '~/lib/discovery';
import { createClient } from '~/lib/api-client';
import { readManifest } from '~/lib/manifest';
import { readGitSource } from '~/lib/git';
import type { Env } from '~/lib/env';

export type PublishOptions = GitSourceOverrides & {
	env: Env;
	addon: DiscoveredAddon;
};

function checkChangelog(addon: DiscoveredAddon, source: GitSource) {
	const file = join(addon.dir, 'CHANGELOG.md');

	if (!existsSync(file)) return;

	const path = source.path ? `${source.path}/CHANGELOG.md` : 'CHANGELOG.md';
	const parsed = parseChangelog(readFileSync(file, 'utf8'));

	if (parsed.issues.length > 0) {
		throw new Error(formatChangelogIssues(parsed.issues, path));
	}

	const { version } = readManifest(addon.dir);

	if (!parsed.releases.has(version)) {
		throw new Error(`${path} has no entry for ${version}.`);
	}
}

/**
 * @description Submits an addon for review from the commit checked out in its directory. The server
 * reads the manifest, the committed bundle, ADDON.md and CHANGELOG.md from GitHub at that commit, so
 * nothing is built or uploaded. Uncommitted changes and an invalid CHANGELOG.md are refused first.
 * @param options The environment, the addon and the repository and ref to name instead of git's.
 * @returns The submission, pending review.
 */
export async function publish({ env, addon, ...overrides }: PublishOptions): Promise<Submission> {
	const source = readGitSource(addon.dir, overrides);

	checkChangelog(addon, source);

	const { submission } = await createClient(env)('POST /api/v1/submissions', {
		body: source,
		response: createSubmissionResponseSchema,
	});

	return submission;
}

export default publish;
