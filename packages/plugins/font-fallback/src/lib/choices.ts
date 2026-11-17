import type { ScriptId } from '~/lib/scripts';

/** The installed face picked for each script, by face id. */
export type ScriptChoices = Partial<Record<ScriptId, string>>;

type Face = { id: string; family: string; weight: number; style: string };

const REGULAR = 400;

/**
 * @description Reads the stored choices, dropping anything malformed.
 * @param raw The stored JSON.
 * @returns The choices.
 */
export function parseChoices(raw: string): ScriptChoices {
	try {
		const parsed: unknown = JSON.parse(raw || '{}');

		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

		return Object.fromEntries(
			Object.entries(parsed).filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string',
			),
		) as ScriptChoices;
	} catch {
		// Settings written by hand or by an older build start over rather than failing to load.
		return {};
	}
}

/**
 * @description Picks one face per installed family to offer: the upright one closest to regular weight.
 * @template F The face type.
 * @param faces Every installed face.
 * @returns One face per family, families in name order.
 */
export function familyFaces<F extends Face>(faces: F[]): F[] {
	const best = new Map<string, F>();

	for (const face of faces) {
		const current = best.get(face.family);
		const score = (candidate: F) =>
			Math.abs(candidate.weight - REGULAR) + (candidate.style === 'normal' ? 0 : 1000);

		if (!current || score(face) < score(current)) best.set(face.family, face);
	}

	return [...best.values()].sort((left, right) => left.family.localeCompare(right.family));
}
