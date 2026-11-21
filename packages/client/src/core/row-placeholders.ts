import { isValidThumbHash } from '~/core/thumbhash';
import type { RowValue } from '~/core/row-values';

const MAX_DEPTH = 12;
const PLACEHOLDER_KEY = 'placeholder';

type Container = RowValue[] | { [key: string]: RowValue };

/** A chat row's message, whose attachments, embeds, components and forwarded snapshots carry image placeholders. */
export type RowMessage = { id?: string } & { [key: string]: RowValue };

function isContainer(value: RowValue): value is Container {
	if (Array.isArray(value)) {
		return true;
	}

	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype: object | null = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

function dropInside(value: Container, depth: number, seen: Set<Container>): number {
	if (depth > MAX_DEPTH || seen.has(value)) {
		return 0;
	}

	seen.add(value);

	let dropped = 0;

	for (const [key, child] of Object.entries(value)) {
		if (key === PLACEHOLDER_KEY && typeof child === 'string' && !isValidThumbHash(child)) {
			(value as { [key: string]: RowValue })[key] = null;
			dropped++;
		} else if (child !== undefined && isContainer(child)) {
			dropped += dropInside(child, depth + 1, seen);
		}
	}

	return dropped;
}

/**
 * @description Removes every image placeholder in a chat row's message that is not a complete ThumbHash, wherever it
 * sits, so Discord draws those images without a preview instead of trapping in its native decoder.
 * @param message The row's message.
 * @returns How many placeholders it removed.
 */
export function dropInvalidPlaceholders(message: RowMessage): number {
	return dropInside(message, 0, new Set());
}

export default { dropInvalidPlaceholders };
