import type { Font, UnboundDiscordFamily } from '@unbound-app/types';

/** One weight and style of a Discord font group, and the Discord families that draw it. */
export type FontSlot = {
	/** `<weight>` or `<weight>-italic`, unique within a group. */
	key: string;
	weight: number;
	italic: boolean;
	/** Discord's families at this weight and style, such as `ggsans-Bold` and its `NotoSans-Bold` fallback. */
	families: string[];
	/** The face the first family draws with, or `undefined` while it keeps Discord's font. */
	face: Font | undefined;
};

/**
 * @description Splits a Discord font group into its weights and styles, upright before italic, light to heavy.
 * @param group A group such as `PRIMARY`.
 * @param families Discord's families and the groups each belongs to.
 * @param faceOf Reads the face overriding a Discord family.
 * @returns The group's slots.
 */
export function groupSlots(
	group: string,
	families: Record<string, UnboundDiscordFamily>,
	faceOf: (family: string) => Font | undefined,
): FontSlot[] {
	const slots = new Map<string, FontSlot>();

	for (const [family, discord] of Object.entries(families)) {
		if (!discord.groups.includes(group)) continue;

		const italic = discord.style === 'italic';
		const key = italic ? `${discord.weight}-italic` : String(discord.weight);
		const slot = slots.get(key);

		if (slot) {
			slot.families.push(family);
		} else {
			slots.set(key, {
				key,
				weight: discord.weight,
				italic,
				families: [family],
				face: faceOf(family),
			});
		}
	}

	return [...slots.values()].sort(
		(a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight,
	);
}

/**
 * @description Picks the upright slot nearest a weight, as the one that stands for its group.
 * @param slots A group's slots.
 * @param weight The wanted weight.
 * @returns The slot, or `undefined` for a group with no upright weight.
 */
export function nearestSlot(slots: FontSlot[], weight: number): FontSlot | undefined {
	let best: FontSlot | undefined;

	for (const slot of slots) {
		if (slot.italic) continue;

		if (!best || Math.abs(slot.weight - weight) < Math.abs(best.weight - weight)) {
			best = slot;
		}
	}

	return best;
}

/**
 * @description Picks the face of a family nearest a weight and style; a style mismatch costs more than any weight gap.
 * @param faces The family's faces.
 * @param weight The wanted weight.
 * @param italic Whether an italic face is wanted.
 * @returns The nearest face, or `undefined` for no faces.
 */
export function nearestFace(faces: Font[], weight: number, italic = false): Font | undefined {
	return closest(faces, weight, italic);
}

/**
 * @description Picks the variable face a slot's axes are set on: the face drawing it when that is variable,
 * else the variable face of `faces` nearest the slot's weight and style.
 * @param slot The slot.
 * @param faces The faces of the families its group uses.
 * @returns The face, or `undefined` when none of them is variable.
 */
export function variableFace(slot: FontSlot, faces: Font[]): Font | undefined {
	if (slot.face?.axes?.length) return slot.face;

	return closest(
		faces.filter((face) => face.axes?.length),
		slot.weight,
		slot.italic,
	);
}

/**
 * @description Reads where a slot sits on a variable face's axes: the face's own coordinates when it draws the
 * slot, else its defaults with the weight axis at the slot's weight.
 * @param slot The slot.
 * @param face The variable face from {@link variableFace}.
 * @returns Axis tag to coordinate, for every axis of the face.
 */
export function slotCoordinates(slot: FontSlot, face: Font): Record<string, number> {
	const coordinates: Record<string, number> = {};

	for (const axis of face.axes ?? []) {
		const own = slot.face?.id === face.id ? face.variations?.[axis.tag] : undefined;
		const weight = axis.tag === 'wght' ? slot.weight : undefined;

		coordinates[axis.tag] = Math.min(
			axis.max,
			Math.max(axis.min, own ?? weight ?? axis.default),
		);
	}

	return coordinates;
}

function closest(faces: Font[], weight: number, italic: boolean): Font | undefined {
	let best: Font | undefined;
	let bestScore = Infinity;

	for (const face of faces) {
		const score =
			Math.abs(face.weight - weight) + ((face.style === 'italic') === italic ? 0 : 2000);

		if (score < bestScore) {
			best = face;
			bestScore = score;
		}
	}

	return best;
}
