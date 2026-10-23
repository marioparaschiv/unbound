import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import type { Submission } from '@unbound-app/contracts/publish';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { readFileSync, existsSync, openAsBlob } from 'node:fs';
import { publishArtifact } from '@unbound-app/web/publish';
import { join } from 'node:path';
import { z } from 'zod';

import type { DiscoveredAddon } from '~/lib/discovery';
import { createClient } from '~/lib/api-client';
import type { Env } from '~/lib/env';

export type PublishOptions = {
	env: Env;
	addon: DiscoveredAddon;
	/** The GitHub `owner/name` the addon is built from, verified against the linked GitHub account. */
	repository?: string;
	changelog?: string;
};

type Artifact = {
	manifest: PublishedManifest;
	bundlePath: string;
};

// The bundle is served next to the manifest, so the published `main` names the built bundle.
function readArtifact(addon: DiscoveredAddon): Artifact {
	const path = join(addon.dir, 'manifest.json');
	const parsed = addonManifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));

	if (!parsed.success) {
		throw new Error(`Invalid ${path}:\n${z.prettifyError(parsed.error)}`);
	}

	const main = getBundleName(addon.static, parsed.data.main);

	return { manifest: { ...parsed.data, main }, bundlePath: join(addon.output, main) };
}

/**
 * @description Publishes a built addon for review: opens a submission (the server refuses it, before
 * anything is uploaded, when the bundle is over its size limit or a spam gate applies), uploads the
 * bundle to the presigned URL and finalizes the submission.
 * @param options The environment, the addon and the submission details.
 * @returns The submission, pending review.
 */
export async function publish({
	env,
	addon,
	repository,
	changelog,
}: PublishOptions): Promise<Submission> {
	const { manifest, bundlePath } = readArtifact(addon);

	if (!existsSync(bundlePath)) {
		throw new Error(`Built bundle not found at ${bundlePath}. Build ${addon.id} first.`);
	}

	const bundle = await openAsBlob(bundlePath);

	return publishArtifact(createClient(env), { manifest, bundle, repository, changelog });
}

export default publish;
