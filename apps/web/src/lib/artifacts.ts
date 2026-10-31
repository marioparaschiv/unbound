import {
	ADDON_PAGE_FILENAME,
	MEASURED_PAGE_FILENAME,
	type AddonPage,
} from '@unbound-app/contracts/addon-page';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { formatChangelogText } from '@unbound-app/contracts/changelog';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import type { SourcePin } from '@unbound-app/contracts/source';

import type { addonVersion, submissionSource } from '~/db/schema';
import type { PageMediaFiles } from '~/lib/addon-page-source';
import type { AppContext } from '~/lib/context';
import type { Env } from '~/lib/env';

export type AddonVersionRow = typeof addonVersion.$inferSelect;

export type SubmissionSourceRow = typeof submissionSource.$inferSelect;

/** What a version reads from the submission it was approved from, as {@link VERSION_SOURCE} loads it. */
export type VersionSubmission = {
	repository: string | null;
	source: SubmissionSourceRow | null;
};

/** The relational `with` that loads a version's {@link VersionSubmission}. */
export const VERSION_SOURCE = {
	submission: { columns: { repository: true }, with: { source: true } },
} as const;

type ChangelogFields = Pick<AddonVersion, 'changelog' | 'changes'>;

export type ArtifactKeys = {
	manifest: string;
	bundle: string;
};

/**
 * @description Builds the public bucket key of a version's bundle compiled for one bytecode version, beside the bundle.
 * @param bundleKey The bundle's key.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's key.
 */
export function getBytecodeKey(bundleKey: string, bytecodeVersion: string): string {
	return `${bundleKey.replace(/\.[^./]+$/, '')}.${bytecodeVersion}.hbc`;
}

/** A version's store page as approval publishes it. */
export type StorePage = {
	addonMd: string;
	/** The measured page, or `null` when the commit has no `page.json`. */
	measured: AddonPage | null;
	media: PageMediaFiles;
};

/** The version an artifact is published as. */
export type ArtifactVersion = {
	addonId: string;
	version: string;
	manifest: PublishedManifest;
};

/**
 * @description Builds the public bucket folder an approved version's files sit in.
 * @param addonId The addon id.
 * @param version The approved version.
 * @returns The folder, without a trailing slash.
 */
export function getVersionDirectory(addonId: string, version: string): string {
	return `addons/${addonId}/${version}`;
}

/**
 * @description Builds the public bucket keys an approved version is published under. The bundle sits
 * at `main` relative to the manifest, which is how the client resolves it.
 * @param addonId The addon id.
 * @param version The approved version.
 * @param main The manifest's `main`.
 * @returns The manifest and bundle keys.
 */
export function getArtifactKeys(addonId: string, version: string, main: string): ArtifactKeys {
	const directory = getVersionDirectory(addonId, version);

	return { manifest: `${directory}/manifest.json`, bundle: `${directory}/${main}` };
}

/**
 * @description Writes a version's bundle and `manifest.json` to the public bucket at its {@link getArtifactKeys}.
 * @param ctx The application context.
 * @param target The addon id, version and manifest the files are published as.
 * @param bundle The verified bundle bytes.
 * @param bytecode The verified compiled bundles, by bytecode version.
 */
export async function writeArtifact(
	ctx: AppContext,
	target: ArtifactVersion,
	bundle: Uint8Array,
	bytecode: ReadonlyMap<string, Uint8Array> = new Map(),
): Promise<void> {
	const keys = getArtifactKeys(target.addonId, target.version, target.manifest.main);

	await Promise.all([
		...[...bytecode].map(([bytecodeVersion, bytes]) =>
			ctx.storage.public.write(getBytecodeKey(keys.bundle, bytecodeVersion), bytes),
		),
		ctx.storage.public.write(keys.bundle, bundle),
		ctx.storage.public.write(keys.manifest, JSON.stringify(target.manifest), {
			type: 'application/json',
		}),
	]);
}

/**
 * @description Writes a version's store page to its folder: ADDON.md, the measured `page.json`, and each
 * media file at the path ADDON.md writes it as, so `media/` lands under the version folder.
 * @param ctx The application context.
 * @param target The addon id and version the page is published as.
 * @param page ADDON.md, the measured page and its verified media bytes.
 */
export async function writeStorePage(
	ctx: AppContext,
	target: ArtifactVersion,
	page: StorePage,
): Promise<void> {
	const directory = getVersionDirectory(target.addonId, target.version);

	await Promise.all([
		...[...page.media].map(([path, bytes]) =>
			ctx.storage.public.write(`${directory}/${path}`, bytes),
		),
		ctx.storage.public.write(`${directory}/${ADDON_PAGE_FILENAME}`, page.addonMd, {
			type: 'text/markdown; charset=utf-8',
		}),
		page.measured
			? ctx.storage.public.write(
					`${directory}/${MEASURED_PAGE_FILENAME}`,
					JSON.stringify(page.measured),
					{ type: 'application/json' },
				)
			: undefined,
	]);
}

/**
 * @description Builds the CDN URL of a public bucket key.
 * @param env The validated environment.
 * @param key The public bucket key.
 * @returns The URL below `CDN_URL`.
 */
export function getCdnUrl(env: Env, key: string): string {
	return new URL(key, env.CDN_URL.endsWith('/') ? env.CDN_URL : `${env.CDN_URL}/`).href;
}

/**
 * @description Picks a version's changelog fields: a sourced version's parsed sections and their text,
 * otherwise the legacy free text.
 * @param text The version row's legacy changelog text.
 * @param source The version's source row, or `null` for a legacy upload.
 * @returns `changelog` as plain text and `changes` as the parsed entry, each `null` when absent.
 */
export function toVersionChangelog(
	text: string | null,
	source: Pick<SubmissionSourceRow, 'changelog'> | null,
): ChangelogFields {
	if (!source) {
		return { changelog: text, changes: null };
	}

	const changes = source.changelog;

	return { changelog: changes ? formatChangelogText(changes) : null, changes };
}

/**
 * @description Builds a source pin from a repository and the source row read from it.
 * @param repository The `owner/name` repository.
 * @param source The source row.
 * @returns The pin.
 */
export function pinSource(repository: string, source: SubmissionSourceRow): SourcePin {
	return {
		repository,
		repositoryId: source.repositoryId,
		path: source.path,
		ref: source.ref,
		commitSha: source.commitSha,
		bundlePath: source.bundlePath,
		bundleBlobSha: source.bundleBlobSha,
	};
}

/**
 * @description Builds the source pin of a submission from its repository and source row.
 * @param submission The submission's repository and source row.
 * @returns The pin, or `null` for a legacy upload.
 */
export function toSourcePin(submission: VersionSubmission | null): SourcePin | null {
	const { repository, source } = submission ?? {};

	if (!repository || !source) return null;

	return pinSource(repository, source);
}

/**
 * @description Renders an approved version row as the wire contract, with its CDN URLs.
 * @param env The validated environment.
 * @param row The version row.
 * @param submission The repository and source row of the submission the version was approved from.
 * @returns The version as API responses carry it.
 */
export function toAddonVersion(
	env: Env,
	row: AddonVersionRow,
	submission: VersionSubmission | null,
): AddonVersion {
	const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

	return {
		version: row.version,
		manifest: row.manifest,
		...toVersionChangelog(row.changelog, submission?.source ?? null),
		source: toSourcePin(submission),
		bundleSize: row.bundleSize,
		sha256: row.sha256,
		publishedAt: row.publishedAt.toISOString(),
		manifestUrl: getCdnUrl(env, keys.manifest),
		bundleUrl: getCdnUrl(env, keys.bundle),
	};
}

export default {
	VERSION_SOURCE,
	getVersionDirectory,
	getArtifactKeys,
	writeArtifact,
	writeStorePage,
	getCdnUrl,
	toVersionChangelog,
	pinSource,
	toSourcePin,
	toAddonVersion,
};
