import type { MusicCollection } from '~/lib/collection';
import { searchPreview } from '~/lib/itunes';

/** A preview clip an embed plays, with the song it is from. */
export type Clip = { url: string; title: string; contentType: string };

const SPOTIFY_CLIP = 'https://p.scdn.co/';

/**
 * @description Names a clip's audio type from where it is hosted: Spotify serves MP3, iTunes serves AAC in MP4.
 * @param url The clip.
 * @returns The MIME type.
 */
export function clipType(url: string): string {
	return url.startsWith(SPOTIFY_CLIP) ? 'audio/mpeg' : 'audio/mp4';
}

/**
 * @description Picks the clip an embed plays: the first song with its own clip, or else the first song found on iTunes
 * by title and artist.
 * @param collection The song, album or playlist.
 * @param search Finds a song's clip on iTunes.
 * @returns The clip, or `undefined` when no song has one.
 */
export async function pickClip(
	collection: MusicCollection,
	search: (query: string) => Promise<string | undefined> = searchPreview,
): Promise<Clip | undefined> {
	const own = collection.tracks.find((track) => track.preview);

	if (own?.preview)
		return { url: own.preview, title: own.title, contentType: clipType(own.preview) };

	const first = collection.tracks.find((track) => track.search);
	const url = first?.search ? await search(first.search) : undefined;

	return url && first ? { url, title: first.title, contentType: clipType(url) } : undefined;
}
