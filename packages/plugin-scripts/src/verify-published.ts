import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import { updatesResponseSchema } from '@unbound-app/contracts/updates';
import { appendFileSync, readFileSync } from 'node:fs';
import { z } from '@unbound-app/contracts/zod';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { readPluginManifests } from './plugin-manifests';
import { PLUGINS_DIR, REPO_ROOT } from './paths';

const UNINSTALLED_VERSION = '0.0.0';
const clientPackageSchema = z.object({ version: z.string() });

type FirstPartyPlugin = { id: string };

type PublishedRelease = {
	id: string;
	manifestUrl: string;
	bundleUrl: string;
	sha256: string;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * @description Names the compiled bundle the client fetches for a Hermes bytecode version, beside the source bundle.
 * @param bundleUrl The source bundle's URL.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's URL.
 */
export function compiledBundleUrl(bundleUrl: string, bytecodeVersion: string): string {
	return `${bundleUrl.replace(/\.[^./]+$/, '')}.${bytecodeVersion}.hbc`;
}

/**
 * @description Hashes downloaded bytes the way the client verifies them.
 * @param bytes The downloaded body.
 * @param algorithm The digest to compute.
 * @returns The lowercase hex digest.
 */
export function digestOf(bytes: ArrayBuffer, algorithm: 'sha256' | 'sha512'): string {
	return createHash(algorithm).update(new Uint8Array(bytes)).digest('hex');
}

/**
 * @description Lists the first-party plugins in a plugins workspace; a plugin with a broken manifest throws instead of escaping verification.
 * @param directory The plugins workspace folder.
 * @returns Each plugin's id.
 */
export function firstPartyPlugins(directory: string): FirstPartyPlugin[] {
	return readPluginManifests(directory).map(({ manifest }) => ({ id: manifest.id }));
}

function clientVersion(): string {
	return clientPackageSchema.parse(
		JSON.parse(readFileSync(join(REPO_ROOT, 'packages/client/package.json'), 'utf8')),
	).version;
}

async function publishedReleases(
	apiUrl: string,
	plugins: FirstPartyPlugin[],
	fetcher: Fetcher,
): Promise<PublishedRelease[]> {
	const response = await fetcher(`${apiUrl}/api/v1/updates`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			clientVersion: clientVersion(),
			addons: plugins.map((plugin) => ({ id: plugin.id, version: UNINSTALLED_VERSION })),
		}),
	});

	if (!response.ok) {
		throw new Error(`POST ${apiUrl}/api/v1/updates answered ${response.status}.`);
	}

	return updatesResponseSchema.parse(await response.json()).updates;
}

/**
 * @description Checks one published release the way the client installs it: the served bundle must match the release's SHA-256, and every compiled bundle the manifest lists must be served with its SHA-512.
 * @param release The release the update endpoint returned.
 * @param fetcher The fetch implementation.
 * @returns The problems found; empty when the release installs cleanly.
 */
export async function checkRelease(release: PublishedRelease, fetcher: Fetcher): Promise<string[]> {
	const problems: string[] = [];
	const bundle = await fetcher(release.bundleUrl, { cache: 'no-store' });

	if (!bundle.ok) {
		return [`${release.id}: the bundle at ${release.bundleUrl} answered ${bundle.status}`];
	}

	const served = digestOf(await bundle.arrayBuffer(), 'sha256');

	if (served !== release.sha256) {
		problems.push(
			`${release.id}: the served bundle's SHA-256 ${served} does not match the release's ${release.sha256}`,
		);
	}

	const manifestResponse = await fetcher(release.manifestUrl, { cache: 'no-store' });

	if (!manifestResponse.ok) {
		return [
			...problems,
			`${release.id}: the manifest at ${release.manifestUrl} answered ${manifestResponse.status}`,
		];
	}

	const manifest = addonManifestSchema.parse(await manifestResponse.json());

	for (const [version, expected] of Object.entries(manifest.bytecode ?? {})) {
		const url = compiledBundleUrl(release.bundleUrl, version);
		const compiled = await fetcher(url, { cache: 'no-store' });

		if (!compiled.ok) {
			problems.push(
				`${release.id}: the bytecode ${version} bundle at ${url} answered ${compiled.status}`,
			);
			continue;
		}

		const digest = digestOf(await compiled.arrayBuffer(), 'sha512');

		if (digest !== expected) {
			problems.push(
				`${release.id}: the bytecode ${version} bundle's SHA-512 does not match its manifest`,
			);
		}
	}

	return problems;
}

/**
 * @description Verifies every published first-party plugin and reports what a client would fail to install.
 * @param apiUrl The Unbound backend's base URL.
 * @param fetcher The fetch implementation.
 * @returns The problems found, and which first-party plugins the store does not publish.
 */
export async function verifyPublished(
	apiUrl: string,
	fetcher: Fetcher = fetch,
): Promise<{ problems: string[]; unpublished: string[] }> {
	const plugins = firstPartyPlugins(PLUGINS_DIR);
	const releases = await publishedReleases(apiUrl, plugins, fetcher);
	const published = new Set(releases.map((release) => release.id));
	const problems = (
		await Promise.all(releases.map((release) => checkRelease(release, fetcher)))
	).flat();

	return {
		problems,
		unpublished: plugins.map((plugin) => plugin.id).filter((id) => !published.has(id)),
	};
}

if (import.meta.main) {
	const apiUrl = (process.env.UNBOUND_API_URL ?? 'https://unbound.rip').replace(/\/+$/, '');
	const { problems, unpublished } = await verifyPublished(apiUrl);
	const lines = [
		'## Published plugins',
		'',
		problems.length
			? problems.map((problem) => `- ${problem}`).join('\n')
			: 'Every published plugin installs cleanly: bundles match their SHA-256 and every listed bytecode bundle is served.',
		'',
		unpublished.length ? `Not published: ${unpublished.join(', ')}` : '',
	];

	console.log(lines.join('\n'));

	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
	}

	process.exit(problems.length ? 1 : 0);
}
