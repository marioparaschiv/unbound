import { AIRLINES } from '~/lib/airlines';

export type FlightNumber = { flight: string; callsign: string };

const IATA_FLIGHT = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g;
const ICAO_CALLSIGN = /\b([A-Z]{3})(\d{1,4}[A-Z]{0,2})\b/g;
const ICAO_CODES = new Set(Object.values(AIRLINES));
const MAX_FLIGHTS = 3;

/**
 * @description Finds flight numbers in a message: IATA ones such as `LH400` or `BA 286`, turned into their ICAO callsign,
 * and ICAO callsigns such as `DLH400`. Only airlines it knows count, so most other codes are left alone.
 * @param content The message's text.
 * @returns Up to three flights, each once.
 */
export function findFlights(content: string): FlightNumber[] {
	const flights = new Map<string, FlightNumber>();

	for (const [, code, number] of content.matchAll(IATA_FLIGHT)) {
		const icao = AIRLINES[code!];

		if (icao)
			flights.set(icao + number, { flight: `${code}${number}`, callsign: icao + number });
	}

	for (const [match, code] of content.matchAll(ICAO_CALLSIGN)) {
		if (ICAO_CODES.has(code!) && !flights.has(match))
			flights.set(match, { flight: match, callsign: match });
	}

	return [...flights.values()].slice(0, MAX_FLIGHTS);
}

/**
 * @description Builds the Flightradar24 page for a flight number.
 * @param flight The flight number as written.
 * @returns The page's address.
 */
export function trackerLink(flight: string): string {
	return `https://www.flightradar24.com/data/flights/${flight.toLowerCase()}`;
}

export default { findFlights, trackerLink };
