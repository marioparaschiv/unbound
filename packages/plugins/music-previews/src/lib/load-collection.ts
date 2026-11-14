import { type MusicCollection, withSearches } from '~/lib/collection';
import { lookupCollection } from '~/lib/itunes';
import type { MusicLink } from '~/lib/music-link';
import { embedUrl, parseEmbed } from '~/lib/spotify-embed';

async function spotifyCollection(kind: string, id: string): Promise<MusicCollection | undefined> {
	const response = await fetch(embedUrl(kind, id));
	const collection = response.ok ? parseEmbed(await response.text()) : undefined;

	return collection && { ...collection, tracks: withSearches(collection.tracks) };
}

/**
 * @description Loads the songs of a music link: Apple Music from iTunes, Spotify from its embed page with iTunes
 * searches for the songs Spotify has no clip for.
 * @param link The song, album or playlist.
 * @returns What the sheet shows, or `undefined` when the service had nothing.
 */
export function loadCollection(link: MusicLink): Promise<MusicCollection | undefined> {
	return link.service === 'apple'
		? lookupCollection(link.id, link.country)
		: spotifyCollection(link.kind, link.id);
}
