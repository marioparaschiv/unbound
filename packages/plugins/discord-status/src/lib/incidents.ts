/** An unresolved incident on discordstatus.com. */
export type Incident = {
	id: string;
	name: string;
	status: string;
	impact: string;
	shortlink: string;
};

/** discordstatus.com's `summary.json`, of which only the incidents are read. */
export type SummaryPayload = { incidents?: unknown };

/**
 * @description Tells whether a parsed response is a status summary object.
 * @param value The parsed response.
 * @returns Whether it is an object.
 */
export function isSummary(value: unknown): value is SummaryPayload {
	return Boolean(value) && typeof value === 'object';
}

const MINOR_IMPACTS = new Set(['none', 'minor']);
const KEPT_IDS = 20;

function isIncident(value: unknown): value is Incident {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const incident = value as Partial<Incident>;

	return (
		typeof incident.id === 'string' &&
		typeof incident.name === 'string' &&
		typeof incident.status === 'string' &&
		typeof incident.impact === 'string' &&
		typeof incident.shortlink === 'string'
	);
}

/**
 * @description Reads the unresolved incidents from discordstatus.com's summary.
 * @param payload The parsed `summary.json`.
 * @returns The incidents, or none when the payload has no list.
 */
export function readIncidents(payload: SummaryPayload): Incident[] {
	return Array.isArray(payload.incidents) ? payload.incidents.filter(isIncident) : [];
}

/**
 * @description Picks the incidents to tell the user about: ones not announced yet, and only major ones unless minor
 * incidents are wanted too.
 * @param incidents The unresolved incidents.
 * @param announced The ids already announced.
 * @param minor Whether minor incidents count.
 * @returns The incidents to announce.
 */
export function newIncidents(
	incidents: Incident[],
	announced: string[],
	minor: boolean,
): Incident[] {
	return incidents.filter(
		(incident) =>
			!announced.includes(incident.id) && (minor || !MINOR_IMPACTS.has(incident.impact)),
	);
}

/**
 * @description Adds incident ids to the announced list, keeping the newest twenty.
 * @param announced The ids already announced.
 * @param incidents The incidents just announced.
 * @returns The updated list.
 */
export function rememberAnnounced(announced: string[], incidents: Incident[]): string[] {
	return [...announced, ...incidents.map((incident) => incident.id)].slice(-KEPT_IDS);
}
