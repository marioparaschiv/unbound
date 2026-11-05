import type { FontProvider, ResolvedFont } from '@unbound-app/contracts/fonts';

/** `fetch`, injectable so tests answer with recorded provider responses. */
export type FontFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** One place fonts come from: it recognises its own links and lists their files without hosting them. */
export type FontSource = {
	provider: FontProvider;
	/**
	 * @description Reads the provider's family id from a link.
	 * @returns The id, or `undefined` when the link is not this source's.
	 */
	match: (url: URL) => string | undefined;
	/**
	 * @description Lists a family's files at the provider.
	 * @returns The font, or `undefined` when the provider has no such family.
	 */
	resolve: (id: string, fetch: FontFetch) => Promise<ResolvedFont | undefined>;
};
