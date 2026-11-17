export type Comic = { num: number; title: string; alt: string; img: string; date: string };

export type ArchiveEntry = { num: number; title: string };

type Fetcher = (
	url: string,
) => Promise<{ ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

type ComicJson = {
	num?: unknown;
	safe_title?: unknown;
	title?: unknown;
	alt?: unknown;
	img?: unknown;
	year?: unknown;
	month?: unknown;
	day?: unknown;
};

const ARCHIVE_LINK = /<a href="\/(\d+)\/" title="[^"]*">([^<]*)<\/a>/g;

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function decodeEntities(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

/**
 * @description Reads xkcd's JSON for one comic.
 * @param json The parsed `info.0.json`.
 * @returns The comic, or `undefined` when the JSON lacks a number or image.
 */
export function toComic(json: unknown): Comic | undefined {
	const body = (json ?? {}) as ComicJson;
	const num = typeof body.num === 'number' ? body.num : undefined;
	const img = text(body.img);

	if (!num || !img) return undefined;

	return {
		num,
		title: text(body.safe_title) || text(body.title),
		alt: text(body.alt),
		img,
		date: [
			text(body.year),
			text(body.month).padStart(2, '0'),
			text(body.day).padStart(2, '0'),
		].join('-'),
	};
}

/**
 * @description Reads every comic's number and title from xkcd's archive page.
 * @param html The archive page.
 * @returns The comics, newest first.
 */
export function parseArchive(html: string): ArchiveEntry[] {
	return [...html.matchAll(ARCHIVE_LINK)].map(([, num, title]) => ({
		num: Number(num),
		title: decodeEntities(title ?? ''),
	}));
}

/**
 * @description Finds the comics whose titles hold every word of a query, exact titles first.
 * @param archive The archive.
 * @param query The words.
 * @returns At most 25 matches.
 */
export function searchArchive(archive: readonly ArchiveEntry[], query: string): ArchiveEntry[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	const matches = archive.filter(({ title }) =>
		words.every((word) => title.toLowerCase().includes(word)),
	);
	const exact = query.trim().toLowerCase();

	return [
		...matches.filter((entry) => entry.title.toLowerCase() === exact),
		...matches.filter((entry) => entry.title.toLowerCase() !== exact),
	].slice(0, 25);
}

export type ComicRequest =
	| { kind: 'latest' }
	| { kind: 'random' }
	| { kind: 'number'; num: number }
	| { kind: 'search'; query: string };

/**
 * @description Reads the `/xkcd` argument: a number, `latest`, `random` or title words; empty means the latest.
 * @param input The argument.
 * @returns The request.
 */
export function parseRequest(input: string | undefined): ComicRequest {
	const value = input?.trim().replace(/^#/, '') ?? '';

	if (!value || value.toLowerCase() === 'latest') return { kind: 'latest' };

	if (value.toLowerCase() === 'random') return { kind: 'random' };

	return /^\d+$/.test(value)
		? { kind: 'number', num: Number(value) }
		: { kind: 'search', query: value };
}

/**
 * @description Creates the xkcd client, which caches comics and the archive for the session.
 * @param fetcher How to fetch.
 * @returns `comic` loads one by number or the latest, `latest` the newest number, `archive` every title.
 */
export function createXkcd(fetcher: Fetcher) {
	const comics = new Map<number | 'latest', Comic>();
	let archive: Promise<ArchiveEntry[]> | undefined;

	async function comic(num?: number): Promise<Comic | undefined> {
		const key = num ?? 'latest';
		const cached = comics.get(key);

		if (cached) return cached;

		const response = await fetcher(
			num ? `https://xkcd.com/${num}/info.0.json` : 'https://xkcd.com/info.0.json',
		);

		if (!response.ok) return undefined;

		const loaded = toComic(await response.json());

		if (loaded) {
			comics.set(key, loaded);
			comics.set(loaded.num, loaded);
		}

		return loaded;
	}

	return {
		comic,
		async latest(): Promise<number | undefined> {
			return (await comic())?.num;
		},
		archive(): Promise<ArchiveEntry[]> {
			archive ??= fetcher('https://xkcd.com/archive/').then(async (response) =>
				response.ok ? parseArchive(await response.text()) : [],
			);

			return archive;
		},
	};
}

export type Xkcd = ReturnType<typeof createXkcd>;
