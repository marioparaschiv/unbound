import type { Patch, PatchOptions, PatchParent, PatchType } from 'possess';
import * as Possess from 'possess';

/** Patch options; `last` runs a patch after every other patch of its kind on the same method. */
export type UnboundPatchOptions = PatchOptions & { last?: boolean };

function isLast(patch: Patch): boolean {
	return (patch as Patch & UnboundPatchOptions).last === true;
}

/**
 * @description Moves the patches marked `last` on a method behind the others of their kind, so a patch added later
 * still runs before them.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param type The kind of patch that was added.
 */
export function keepLastPatchesLast(parent: PatchParent, method: string, type: PatchType): void {
	const state = Possess.patches.find(
		(entry) => entry.parent.deref() === parent && entry.method === method,
	);
	const patches = state?.patches[type];

	if (!patches) return;

	for (const patch of [...patches].filter(isLast)) {
		patches.delete(patch);
		patches.add(patch);
	}
}
