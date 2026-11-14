import { type MusicCollection, withSearches } from '~/lib/collection';
import { lookupCollection } from '~/lib/itunes';
import { loadDeezer } from '~/lib/deezer';
import { loadTidal } from '~/lib/tidal';
import type { MusicLink } from '~/lib/music-link';
import { embedUrl, parseEmbed } from '~/lib/spotify-embed';

async function spotifyCollection(kind: string, id: string): Promise<MusicCollection | undefined> {
	const response = await fetch(embedUrl(kind, id));
	const collection = response.ok ? parseEmbed(await response.text()) : undefined;

	return collection && { ...collection, tracks: withSearches(collection.tracks) };
}

/**
 * @description Loads the songs of a music link: Apple Music from iTunes, Spotify from its embed page, Deezer from its
 * API, and Tidal from its track page, with iTunes searches for songs that have no clip of their own.
 * @param link The song, album or playlist.
 * @returns What the sheet shows, or `undefined` when the service had nothing.
 */
export function loadCollection(link: MusicLink): Promise<MusicCollection | undefined> {
	switch (link.service) {
		case 'apple':
			return lookupCollection(link.id, link.country);
		case 'deezer':
			return loadDeezer(link.kind, link.id);
		case 'tidal':
			return loadTidal(link.id);
		case 'spotify':
			return spotifyCollection(link.kind, link.id);
	}
}
