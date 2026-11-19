import type { NativeFabricSurface } from '@unbound-app/types';

type Unmount = (surface: NativeFabricSurface) => PromiseLike<void>;

const RELOAD_UNMOUNT_MS = 500;

const live = new Map<NativeFabricSurface, Unmount>();

/** A plugin scope's set of mounted surfaces that also lists them for {@link unmountLiveSurfaces}. */
class TrackedSurfaces extends Set<NativeFabricSurface> {
	constructor(private readonly unmount: Unmount) {
		super();
	}

	add(surface: NativeFabricSurface): this {
		live.set(surface, this.unmount);

		return super.add(surface);
	}

	delete(surface: NativeFabricSurface): boolean {
		live.delete(surface);

		return super.delete(surface);
	}

	clear(): void {
		for (const surface of this) live.delete(surface);

		super.clear();
	}
}

/**
 * @description Creates the set a plugin scope keeps its mounted surfaces in, listed for {@link unmountLiveSurfaces}.
 * @param unmount Unmounts one of the scope's surfaces.
 * @returns The set.
 */
export function createTrackedSurfaces(unmount: Unmount): Set<NativeFabricSurface> {
	return new TrackedSurfaces(unmount);
}

/**
 * @description Unmounts every surface plugins still have mounted, so none outlives the runtime a reload replaces, waiting
 * at most half a second.
 * @param timeoutMs How long to wait for the unmounts.
 * @returns A promise that settles once they finished or the wait ran out.
 */
export async function unmountLiveSurfaces(timeoutMs: number = RELOAD_UNMOUNT_MS): Promise<void> {
	const entries = [...live];

	live.clear();

	if (!entries.length) return;

	await Promise.race([
		Promise.allSettled(entries.map(([surface, unmount]) => unmount(surface))),
		new Promise((resolve) => setTimeout(resolve, timeoutMs)),
	]);
}

export default { createTrackedSurfaces, unmountLiveSurfaces };
