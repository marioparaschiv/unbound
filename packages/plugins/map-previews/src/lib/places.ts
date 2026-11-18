export type Place = { latitude: number; longitude: number; zoom: number };

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PAIR = `${NUMBER}\\s*(?:,|%2C)\\s*${NUMBER}`;
const LINK = /https?:\/\/[^\s<>()"']+/gi;
const MAP_HOSTS =
	/^(?:(?:www\.|maps\.)?google\.[a-z.]+|maps\.apple\.com|(?:www\.)?openstreetmap\.org)$/i;
const AT_PAIR = new RegExp(`@${PAIR}(?:,(\\d+(?:\\.\\d+)?)z)?`);
const QUERY_PAIR = new RegExp(`[?&](?:q|query|ll|sll|coordinate|center|destination)=${PAIR}`);
const QUERY_ZOOM = /[?&](?:z|zoom)=(\d+(?:\.\d+)?)/;
const OSM_HASH = new RegExp(`#map=(\\d+)/${NUMBER}/${NUMBER}`);
const OSM_MARKER = new RegExp(`[?&]mlat=${NUMBER}&mlon=${NUMBER}`);
const GEO = new RegExp(`geo:${PAIR}`, 'gi');
const DECIMAL = '(-?\\d{1,3}\\.\\d{3,})';
const BARE_PAIR = new RegExp(`(?<![\\w.,-])${DECIMAL},\\s?${DECIMAL}(?![\\w.]|,\\d)`, 'g');
const DEFAULT_ZOOM = 15;
const MAX_ZOOM = 18;
const MAX_PLACES = 2;

function place(latitude: string, longitude: string, zoom?: string): Place | undefined {
	const lat = Number(latitude);
	const lng = Number(longitude);

	if (
		!Number.isFinite(lat) ||
		!Number.isFinite(lng) ||
		Math.abs(lat) > 90 ||
		Math.abs(lng) > 180
	) {
		return undefined;
	}

	const level = Math.round(Number(zoom) || DEFAULT_ZOOM);

	return { latitude: lat, longitude: lng, zoom: Math.min(Math.max(level, 1), MAX_ZOOM) };
}

function linkPlace(link: string): Place | undefined {
	let host = '';

	try {
		host = new URL(link).hostname;
	} catch {
		return undefined;
	}

	if (!MAP_HOSTS.test(host)) return undefined;

	const zoom = QUERY_ZOOM.exec(link)?.[1];
	const osm = OSM_HASH.exec(link);
	const marker = OSM_MARKER.exec(link);
	const at = AT_PAIR.exec(link);
	const query = QUERY_PAIR.exec(link);

	if (marker) return place(marker[1], marker[2], osm?.[1] ?? zoom);
	if (osm) return place(osm[2], osm[3], osm[1]);
	if (at) return place(at[1], at[2], at[3] ?? zoom);
	if (query) return place(query[1], query[2], zoom);

	return undefined;
}

/**
 * @description Finds the spots a message points at: map links from Google Maps, Apple Maps and OpenStreetMap, `geo:`
 * links, and bare `latitude, longitude` pairs with at least three decimals.
 * @param content The message content.
 * @returns Up to two places, each once, links first.
 */
export function findPlaces(content: string): Place[] {
	const links = content.match(LINK) ?? [];
	const text = content.replace(LINK, ' ');
	const found = [
		...links.map(linkPlace),
		...[...text.matchAll(GEO)].map((match) => place(match[1], match[2])),
		...[...text.matchAll(BARE_PAIR)].map((match) => place(match[1], match[2])),
	];
	const places = new Map<string, Place>();

	for (const spot of found) {
		if (spot) places.set(`${spot.latitude},${spot.longitude}`, spot);
	}

	return [...places.values()].slice(0, MAX_PLACES);
}
