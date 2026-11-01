import {
	MAIN_DOCS_VERSION,
	docsManifestSchema,
	getDocsKey,
	getDocsManifestKey,
	type DocsManifest,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';

import { buildDocsIndex, type DocsIndex } from '~/lib/docs/docs-index';
import { createLruCache, type LruCache } from '~/lib/docs/lru-cache';
import { docsProjectSchema } from '~/lib/docs/typedoc';

export const MUTABLE_DOCS_TTL_MS = 5 * 60 * 1000;

export const DOCS_VERSION_CACHE_LIMIT = 8;

type Cached<T> = {
	expiresAt: number;
	value: Promise<T>;
};

export type DocsSource = {
	/** The package's manifest, or `undefined` when none is published. */
	manifest: (pkg: DocsPackage) => Promise<DocsManifest | undefined>;
	/** A published version's index; fails when the version is missing from the CDN. */
	index: (pkg: DocsPackage, version: DocsVersion) => Promise<DocsIndex>;
};

export type DocsSourceOptions = {
	/** The CDN URL of a public bucket key. */
	cdnUrl: (key: string) => string;
	fetch?: typeof globalThis.fetch;
	now?: () => number;
};

/**
 * @description Reads the docs from the CDN through an in-memory cache: release tags until evicted, `main` and
 * the manifests for {@link MUTABLE_DOCS_TTL_MS}. A failed load is never cached.
 * @param options The CDN URL builder, and the fetch and clock to use.
 * @returns The source.
 */
export function createDocsSource({
	cdnUrl,
	fetch = globalThis.fetch,
	now = Date.now,
}: DocsSourceOptions): DocsSource {
	const manifests = createLruCache<DocsPackage, Cached<DocsManifest | undefined>>(
		DOCS_VERSION_CACHE_LIMIT,
	);
	const versions = createLruCache<string, Cached<DocsIndex>>(DOCS_VERSION_CACHE_LIMIT);

	function readThrough<K, T>(
		cache: LruCache<K, Cached<T>>,
		key: K,
		ttl: number,
		load: () => Promise<T>,
	): Promise<T> {
		const hit = cache.get(key);

		if (hit && hit.expiresAt > now()) {
			return hit.value;
		}

		const entry = { expiresAt: now() + ttl, value: load() };

		cache.set(key, entry);
		entry.value.catch(() => {
			if (cache.get(key) === entry) {
				cache.delete(key);
			}
		});

		return entry.value;
	}

	// UNKNOWN: the CDN's JSON is parsed by each caller's schema.
	async function fetchJson(key: string): Promise<unknown> {
		const url = cdnUrl(key);
		const response = await fetch(url);

		if (response.status === 404) return;

		if (!response.ok) {
			throw new Error(
				`Failed to load docs ${url}: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	return {
		manifest: (pkg) =>
			readThrough(manifests, pkg, MUTABLE_DOCS_TTL_MS, async () => {
				const json = await fetchJson(getDocsManifestKey(pkg));

				return json === undefined ? undefined : docsManifestSchema.parse(json);
			}),
		index: (pkg, version) =>
			readThrough(
				versions,
				`${pkg}/${version}`,
				version === MAIN_DOCS_VERSION ? MUTABLE_DOCS_TTL_MS : Infinity,
				async () => {
					const key = getDocsKey(pkg, version);
					const json = await fetchJson(key);

					if (json === undefined) {
						throw new Error(`Failed to load docs ${key}: not on the CDN.`);
					}

					return buildDocsIndex(docsProjectSchema.parse(json));
				},
			),
	};
}

export default { createDocsSource };
