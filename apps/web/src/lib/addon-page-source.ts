import {
	MEASURED_PAGE_FILENAME,
	addonPageSchema,
	parseAddonPage,
	type AddonPage,
} from '@unbound-app/contracts/addon-page';
import { listPageMediaPaths } from '@unbound-app/contracts/addon-page-media';
import { isPostgresSafe } from '@unbound-app/contracts/text';
import { z } from 'zod';

import type { GitHubClient, GitTree, TreeEntry } from '~/lib/github';
import { matchesMediaFormat } from '~/lib/media-format';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** Where one addon's page and media sit at one commit. */
export type PageLocation = {
	repository: string;
	tree: GitTree;
	commitSha: string;
	/** The addon's directory, which ADDON.md's `media/` paths are relative to. */
	addonDir: string;
	/** The build output directory `ubd build` writes `page.json` to. */
	outputDir: string;
	/** ADDON.md at the commit, or `null` when the addon has none. */
	addonMd: string | null;
};

type CommittedMedia = {
	path: string;
	entry: TreeEntry;
};

/** How many media blobs one page check downloads at once, to stay under GitHub's concurrency limit. */
export const MEDIA_READ_CONCURRENCY = 4;

function inDir(dir: string, name: string): string {
	return dir === '' ? name : `${dir}/${name}`;
}

function rebuild(path: string, problem: string): ApiError {
	return new ApiError(
		'artifact_mismatch',
		`${path} ${problem}. Run ubd build and commit the output.`,
	);
}

function parsePage(path: string, text: string): AddonPage {
	let json: unknown;

	try {
		json = JSON.parse(text);
	} catch {
		throw new ApiError('invalid_request', `${path} is not valid JSON.`);
	}

	if (!isPostgresSafe(json)) {
		throw new ApiError(
			'invalid_request',
			`${path} must not contain NUL (U+0000) or an unpaired surrogate.`,
		);
	}

	const parsed = addonPageSchema.safeParse(json);

	if (!parsed.success) {
		throw new ApiError(
			'invalid_request',
			`${path} is not a valid page:\n${z.prettifyError(parsed.error)}`,
		);
	}

	return parsed.data;
}

function findMedia(env: Env, location: PageLocation, page: AddonPage): CommittedMedia[] {
	const { tree, commitSha, addonDir } = location;
	const committed: CommittedMedia[] = [];

	for (const media of page.media) {
		const path = inDir(addonDir, media.path);
		const entry = tree.get(path);

		if (!entry) {
			throw new ApiError(
				'artifact_missing',
				`${path} is not committed at ${commitSha.slice(0, 7)}, but ${MEASURED_PAGE_FILENAME} shows it. Commit the file.`,
			);
		}

		if (entry.size > env.ADDON_MEDIA_MAX_BYTES) {
			throw new ApiError(
				'artifact_too_large',
				`${path} is ${entry.size} bytes; a media file may be at most ${env.ADDON_MEDIA_MAX_BYTES} bytes.`,
			);
		}

		if (entry.size !== media.bytes) {
			throw rebuild(path, `is ${entry.size} bytes, but it measured ${media.bytes} bytes`);
		}

		committed.push({ path, entry });
	}

	const total = committed.reduce((sum, { entry }) => sum + entry.size, 0);

	if (total > env.ADDON_MEDIA_TOTAL_MAX_BYTES) {
		throw new ApiError(
			'artifact_too_large',
			`The media take ${total} bytes together; an addon's media may take at most ${env.ADDON_MEDIA_TOTAL_MAX_BYTES} bytes.`,
		);
	}

	return committed;
}

function listsExactly(page: AddonPage, paths: string[]): boolean {
	const measured = new Set(page.media.map((media) => media.path));

	return measured.size === paths.length && paths.every((path) => measured.has(path));
}

async function forEachAtMost<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
	const queue = items.values();

	async function worker() {
		for (const item of queue) {
			await fn(item);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function checkFormats(github: GitHubClient, repository: string, media: CommittedMedia[]) {
	await forEachAtMost(media, MEDIA_READ_CONCURRENCY, async ({ path, entry }) => {
		const data = await github.readBlob(repository, entry.sha);

		if (!matchesMediaFormat(path, data)) {
			throw new ApiError(
				'artifact_mismatch',
				`${path} is not the format its extension names.`,
			);
		}
	});
}

/**
 * @description Reads the measured store page `ubd build` committed, and checks it against the commit:
 * its frontmatter and media list against ADDON.md, and each media file's size, the size caps and its format.
 * @param env The environment, for the size caps.
 * @param github The GitHub client.
 * @param location The repository, tree, addon and output directories, and ADDON.md.
 * @returns The page, or `null` when no `page.json` is committed; throws when it does not match the commit.
 */
export async function readAddonPage(
	env: Env,
	github: GitHubClient,
	location: PageLocation,
): Promise<AddonPage | null> {
	const { repository, tree, outputDir, addonMd } = location;
	const path = inDir(outputDir, MEASURED_PAGE_FILENAME);
	const entry = tree.get(path);

	if (!entry) return null;

	if (entry.size > env.ADDON_TEXT_MAX_BYTES) {
		throw new ApiError(
			'artifact_too_large',
			`${path} is ${entry.size} bytes; it may be at most ${env.ADDON_TEXT_MAX_BYTES} bytes.`,
		);
	}

	const page = parsePage(
		path,
		new TextDecoder().decode(await github.readBlob(repository, entry.sha)),
	);
	const source = addonMd === null ? undefined : parseAddonPage(addonMd);

	if (!source?.success || !Bun.deepEquals(source.frontmatter, page.frontmatter)) {
		throw rebuild(path, 'does not match the frontmatter of ADDON.md');
	}

	if (!listsExactly(page, listPageMediaPaths(source.frontmatter, source.body))) {
		throw rebuild(path, 'does not measure exactly the media ADDON.md shows');
	}

	await checkFormats(github, repository, findMedia(env, location, page));

	return page;
}

export default { MEDIA_READ_CONCURRENCY, readAddonPage };
