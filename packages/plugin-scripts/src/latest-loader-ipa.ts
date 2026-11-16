import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { REPO_ROOT } from './paths';

const STABLE_IOS_TAG = /^discord-[\d.]+-ios$/;
const IPA_ASSET = 'Unbound.ipa';

/** A GitHub release as `gh release list --json` lists it. */
export type ReleaseSummary = { tagName: string; isDraft: boolean; isPrerelease: boolean };

/**
 * @description Picks the newest stable iOS release, tagged `discord-<version>-ios`, whose IPA keeps all of Discord's
 * image assets; TestFlight IPAs are thinned. Drafts and pre-releases are skipped; `gh release list` lists newest first.
 * @param releases The repository's releases.
 * @returns The release's tag, or `undefined` when there is none.
 */
export function latestLoaderTag(releases: readonly ReleaseSummary[]): string | undefined {
	return releases.find(
		(release) =>
			STABLE_IOS_TAG.test(release.tagName) && !release.isDraft && !release.isPrerelease,
	)?.tagName;
}

function listReleases(): ReleaseSummary[] {
	return JSON.parse(
		execFileSync(
			'gh',
			['release', 'list', '--limit', '500', '--json', 'tagName,isDraft,isPrerelease'],
			{
				cwd: REPO_ROOT,
				encoding: 'utf8',
			},
		),
	);
}

/**
 * @description Finds the latest loader IPA, downloading it with `gh` from the newest stable iOS release into
 * `~/.cache/unbound/loader-ipa/<tag>` the first time, so icon scripts need no hand-passed path.
 * @param cacheRoot Where downloads are kept.
 * @returns The IPA's path.
 */
export function latestLoaderIpa(
	cacheRoot = join(homedir(), '.cache', 'unbound', 'loader-ipa'),
): string {
	const tag = latestLoaderTag(listReleases());

	if (!tag) {
		throw new Error('No stable iOS release found; pass the IPA path instead.');
	}

	const directory = join(cacheRoot, tag);
	const ipa = join(directory, IPA_ASSET);

	if (!existsSync(ipa)) {
		mkdirSync(directory, { recursive: true });
		console.log(`Downloading ${IPA_ASSET} from ${tag}…`);
		execFileSync(
			'gh',
			['release', 'download', tag, '--pattern', IPA_ASSET, '--dir', directory],
			{
				cwd: REPO_ROOT,
				stdio: 'inherit',
			},
		);
	}

	return ipa;
}

export default { latestLoaderTag, latestLoaderIpa };
