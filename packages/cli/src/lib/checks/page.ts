import {
	ADDON_PAGE_FILENAME,
	MEASURED_PAGE_FILENAME,
	addonPageSchema,
	mediaPathSchema,
	parseAddonPage,
	splitFrontmatter,
} from '@unbound-app/contracts/addon-page';
import type {
	AddonPage,
	AddonPageFrontmatter,
	MeasuredMedia,
} from '@unbound-app/contracts/addon-page';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { Token, Tokens } from 'marked';
import { Lexer, walkTokens } from 'marked';
import { dirname, join } from 'node:path';

import type { BuildCheck, BuildCheckIssue } from '~/lib/build-checks';
import { measureMedia } from '~/lib/media-probe';
import { parseMediaLimits } from '~/lib/env';
import type { MediaLimits } from '~/lib/env';

/** What the body of ADDON.md breaks, and the media paths it references in order. */
export type PageBodyLint = {
	issues: string[];
	paths: string[];
};

/** Every issue found reading ADDON.md, and the measured page when nothing failed. */
export type PageResult = {
	issues: BuildCheckIssue[];
	page?: AddonPage;
};

const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const POSTER_ASPECT_TOLERANCE = 0.01;

/**
 * @description Checks the Markdown body of ADDON.md and lists the media it shows.
 * @param body The Markdown after the frontmatter.
 * @returns One message per leading H1, table, or image path outside `media/`, and every valid
 * media path, exactly as written.
 */
export function lintPageBody(body: string): PageBodyLint {
	const tokens = Lexer.lex(body);
	const issues: string[] = [];
	const paths: string[] = [];
	const first = tokens.find((token) => token.type !== 'space');

	if (first?.type === 'heading' && (first as Tokens.Heading).depth === 1) {
		issues.push(
			`${ADDON_PAGE_FILENAME} starts with the heading "${firstLine(first)}"; the manifest's name is the page title, so start with "##" or a paragraph.`,
		);
	}

	walkTokens(tokens, (token) => {
		if (token.type === 'table') {
			issues.push(
				`${ADDON_PAGE_FILENAME} has a table at "${firstLine(token)}"; ubd build rejects tables, so use a list.`,
			);
		}

		if (token.type !== 'image') return;

		const { href } = token as Tokens.Image;
		const error = checkBodyPath(href);

		if (error) {
			issues.push(error);
		} else {
			paths.push(href);
		}
	});

	return { issues, paths };
}

/**
 * @description Reads ADDON.md, checks it, and measures every media file it references.
 * @param dir The addon's directory.
 * @param limits The per-file and per-addon media size limits.
 * @returns The issues found, and the page to write when ADDON.md has frontmatter and no errors.
 */
export async function readPage(dir: string, limits: MediaLimits): Promise<PageResult> {
	const source = readFileSync(join(dir, ADDON_PAGE_FILENAME), 'utf8');
	const split = splitFrontmatter(source);
	const parsed = parseAddonPage(source);
	const issues: BuildCheckIssue[] = [];
	let frontmatter: AddonPageFrontmatter | undefined;

	if (split.frontmatter === void 0) {
		issues.push(
			warning(
				`${ADDON_PAGE_FILENAME} has no frontmatter, so the store shows no banner or gallery and no ${MEASURED_PAGE_FILENAME} is written; add a banner.`,
			),
		);
	} else if (parsed.success) {
		({ frontmatter } = parsed);
	} else {
		issues.push(error(`${ADDON_PAGE_FILENAME} has invalid frontmatter:\n${parsed.error}`));
	}

	const body = lintPageBody(split.body);

	issues.push(...body.issues.map(error));

	const paths = [...new Set([...listFrontmatterPaths(frontmatter), ...body.paths])];
	const measurements = await Promise.all(
		paths.map((path) => measureMedia(dir, path, limits.ADDON_MEDIA_MAX_BYTES)),
	);
	const media: MeasuredMedia[] = [];

	for (const measurement of measurements) {
		if ('error' in measurement) {
			issues.push(error(measurement.error));
		} else {
			media.push(measurement.media);
		}
	}

	const total = media.reduce((sum, file) => sum + file.bytes, 0);

	if (total > limits.ADDON_MEDIA_TOTAL_MAX_BYTES) {
		issues.push(
			error(
				`The media take ${total} bytes together; an addon's media may take at most ${limits.ADDON_MEDIA_TOTAL_MAX_BYTES} bytes.`,
			),
		);
	}

	if (!frontmatter || issues.some((issue) => issue.severity === 'error')) {
		return { issues };
	}

	const page = addonPageSchema.safeParse({ frontmatter, media });

	if (!page.success) {
		return { issues: [...issues, ...page.error.issues.map((issue) => error(issue.message))] };
	}

	return { issues: [...issues, ...checkPosters(page.data)], page: page.data };
}

function checkBodyPath(href: string): string | undefined {
	if (EXTERNAL_URL.test(href)) {
		return `${ADDON_PAGE_FILENAME} shows ${href}, which is not in the repository; put the file in media/ and use its path.`;
	}

	const parsed = mediaPathSchema.safeParse(href);

	if (parsed.success) return;

	return `${ADDON_PAGE_FILENAME} shows ${href}: ${parsed.error.issues.map((issue) => issue.message).join(' ')}`;
}

function listFrontmatterPaths(frontmatter: AddonPageFrontmatter | undefined): string[] {
	if (!frontmatter) {
		return [];
	}

	const paths = [frontmatter.banner];

	for (const entry of frontmatter.media) {
		if ('image' in entry) {
			paths.push(entry.image);

			continue;
		}

		paths.push(entry.video);

		if (entry.poster) {
			paths.push(entry.poster);
		}
	}

	return paths;
}

function checkPosters(page: AddonPage): BuildCheckIssue[] {
	const measured = new Map(page.media.map((media) => [media.path, media]));
	const issues: BuildCheckIssue[] = [];

	for (const entry of page.frontmatter.media) {
		if (!('video' in entry) || !entry.poster) {
			continue;
		}

		const video = measured.get(entry.video);
		const poster = measured.get(entry.poster);

		if (!video || !poster) {
			continue;
		}

		const videoAspect = video.width / video.height;
		const posterAspect = poster.width / poster.height;

		if (Math.abs(posterAspect / videoAspect - 1) > POSTER_ASPECT_TOLERANCE) {
			issues.push(
				warning(
					`The poster ${poster.path} is ${poster.width}x${poster.height} but its video ${video.path} is ${video.width}x${video.height}; give the poster the video's aspect ratio so the gallery does not jump when the video starts.`,
				),
			);
		}
	}

	return issues;
}

function writePage(target: string, page: AddonPage) {
	const temporary = `${target}.tmp`;

	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(temporary, `${JSON.stringify(page, null, '\t')}\n`);
	renameSync(temporary, target);
}

function firstLine(token: Token): string {
	return token.raw.trim().split('\n')[0] ?? '';
}

function error(message: string): BuildCheckIssue {
	return { severity: 'error', message };
}

function warning(message: string): BuildCheckIssue {
	return { severity: 'warning', message };
}

export const pageCheck: BuildCheck = {
	name: 'page',
	/**
	 * @description Checks ADDON.md and writes the measured page to `{output}/page.json`. An addon
	 * without ADDON.md has no page; a page that fails the check leaves no stale `page.json` behind.
	 * @param addon The addon to check.
	 * @returns One error per rule the page breaks, and warnings for pages the store shows partly.
	 */
	async run(addon) {
		if (!existsSync(join(addon.dir, ADDON_PAGE_FILENAME))) {
			return [];
		}

		const target = join(addon.output, MEASURED_PAGE_FILENAME);

		rmSync(target, { force: true });

		const { issues, page } = await readPage(addon.dir, parseMediaLimits());

		if (page) {
			writePage(target, page);
		}

		return issues;
	},
};

export default { lintPageBody, readPage, pageCheck };
