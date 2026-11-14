/** One song a sheet lists: its own clip, or a search that finds one on iTunes when tapped. */
export type PreviewTrack = { title: string; subtitle: string; preview?: string; search?: string };

/** A song, album or playlist as the sheet shows it. */
export type MusicCollection = {
	title: string;
	subtitle: string;
	cover?: string;
	tracks: PreviewTrack[];
};

/**
 * @description Gives songs without their own clip an iTunes search to find one.
 * @param tracks The songs.
 * @returns The songs, the ones without a clip searchable by title and artist.
 */
export function withSearches(tracks: readonly PreviewTrack[]): PreviewTrack[] {
	return tracks.map((track) =>
		track.preview ? track : { ...track, search: `${track.title} ${track.subtitle}`.trim() },
	);
}
