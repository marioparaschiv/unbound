type MediaList = { items?: { title?: string; type?: string }[] };

type Derivative = { src?: string; type?: string };

type CommonsAnswer = {
	query?: { pages?: Record<string, { videoinfo?: { derivatives?: Derivative[] }[] }> };
};

const AUDIO = /\.(ogg|oga|wav|mp3|flac)$/i;

/**
 * @description Picks the recordings of a word from Wiktionary's media list, those in the reader's language first.
 * @param list Wiktionary's media list for the word's page.
 * @param language The reader's language code.
 * @returns The recordings' file titles, best first.
 */
export function recordingTitles(list: MediaList | undefined, language: string): string[] {
	const titles = (list?.items ?? [])
		.map((item) => item.title ?? '')
		.filter((title) => title.startsWith('File:') && AUDIO.test(title));
	const prefix = `file:${language.toLowerCase()}`;

	return [
		...titles.filter((title) => title.toLowerCase().startsWith(prefix)),
		...titles.filter((title) => !title.toLowerCase().startsWith(prefix)),
	];
}

/**
 * @description Reads the MP3 version Wikimedia Commons keeps of a recording, which iOS and Android both play.
 * @param answer Commons' `videoinfo` answer for the recording.
 * @returns The MP3's link, or `undefined` when Commons has none.
 */
export function mp3Of(answer: CommonsAnswer | undefined): string | undefined {
	const pages = Object.values(answer?.query?.pages ?? {});

	return pages
		.flatMap((page) => page.videoinfo ?? [])
		.flatMap((info) => info.derivatives ?? [])
		.find((derivative) => derivative.type === 'audio/mpeg' && derivative.src)?.src;
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
	const response = await fetch(url, { headers: { Accept: 'application/json' } });

	return response.ok ? ((await response.json()) as T) : undefined;
}

/**
 * @description Finds a recording of a word on Wiktionary, as an MP3 from Wikimedia Commons.
 * @param word The word.
 * @param language The reader's language code, whose recordings come first.
 * @returns The MP3's link, or `undefined` when Wiktionary has no recording.
 */
export async function findRecording(word: string, language: string): Promise<string | undefined> {
	const list = await fetchJson<MediaList>(
		`https://en.wiktionary.org/api/rest_v1/page/media-list/${encodeURIComponent(word)}`,
	).catch(() => undefined);

	for (const title of recordingTitles(list, language).slice(0, 3)) {
		const answer = await fetchJson<CommonsAnswer>(
			`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=videoinfo&viprop=derivatives&format=json&origin=*`,
		).catch(() => undefined);
		const mp3 = mp3Of(answer);

		if (mp3) return mp3;
	}

	return undefined;
}

export default { recordingTitles, mp3Of, findRecording };
