import { PatchType, createPatcher as createPossessPatcher, patches } from 'possess';

export * from 'possess';

function trackPatches<T extends (...args: any[]) => () => void>(
	method: T,
	type: PatchType,
	unpatches: Set<() => void>,
): T {
	function register(...args: Parameters<T>): () => void {
		const unpatch = method(...args);
		const parent = args[0] as object;
		const key = args[1] as PropertyKey;
		const installed = Reflect.get(parent, key);
		const registration = patches.find(
			(entry) => entry.parent.deref() === parent && entry.method === key,
		);
		const group = registration?.patches[type];
		const patch = group ? [...group].pop() : undefined;
		let active = true;
		function remove(): void {
			if (!active) return;
			active = false;
			unpatches.delete(remove);
			if (Reflect.get(parent, key) !== installed) {
				if (patch) group?.delete(patch);
				if (
					registration &&
					Object.values(registration.patches).every((set) => set.size === 0)
				) {
					const index = patches.indexOf(registration);
					if (index >= 0) patches.splice(index, 1);
				}
				return;
			}
			unpatch();
		}
		unpatches.add(remove);
		return remove;
	}
	return register as T;
}

export function createPatcher(
	defaultOptions: Parameters<typeof createPossessPatcher>[0],
): ReturnType<typeof createPossessPatcher> {
	const patcher = createPossessPatcher(defaultOptions);
	const unpatches = new Set<() => void>();
	return {
		after: trackPatches(patcher.after, PatchType.After, unpatches),
		before: trackPatches(patcher.before, PatchType.Before, unpatches),
		instead: trackPatches(patcher.instead, PatchType.Instead, unpatches),
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}
