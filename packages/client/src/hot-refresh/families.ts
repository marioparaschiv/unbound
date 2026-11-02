import type { FunctionComponent } from 'react';

/** A component or a `memo` / `forwardRef` object, as the refresh transform registers it. */
export type RefreshType = FunctionComponent<never> | { $$typeof: symbol };

/** Every version of one component across module re-runs; `current` is the latest. */
export type Family = { current: RefreshType };

/** One run's hook order for a component, as a key that re-running the component hashes to. */
type Signature = {
	forceReset: boolean;
	ownKey: string;
	fullKey: string | null;
	getCustomHooks: () => unknown[];
};

/** What a refresh found: families whose component changed compatibly, and those that need a remount. */
export type RefreshUpdate = {
	updatedFamilies: Set<Family>;
	staleFamilies: Set<Family>;
};

type ForwardRef = { $$typeof: symbol; render: RefreshType };

type Memo = { $$typeof: symbol; type: RefreshType; compare: unknown };

type WithPrototype = { prototype?: { isReactComponent?: boolean } | null };

const FORWARD_REF = Symbol.for('react.forward_ref');
const MEMO = Symbol.for('react.memo');

const familiesById = new Map<string, Family>();
const familiesByType = new Map<RefreshType, Family>();
const signatures = new Map<RefreshType, Signature>();
const pending: [Family, RefreshType][] = [];

let refreshing = false;

/**
 * @description Records a component under an id, so a later run of its module becomes the newest version of
 * the same family rather than a new component.
 * @param type The component or `memo` / `forwardRef` object this run made.
 * @param id The family id the transform registered it under.
 */
export function register(type: RefreshType, id: string): void {
	if (type === null || (typeof type !== 'function' && typeof type !== 'object')) return;

	if (familiesByType.has(type)) return;

	const known = familiesById.get(id);
	const family = known ?? { current: type };

	if (known) {
		pending.push([known, type]);
	} else {
		familiesById.set(id, family);
	}

	familiesByType.set(type, family);

	const tag = tagOf(type);

	if (tag === FORWARD_REF) {
		register((type as ForwardRef).render, `${id}$render`);
	}

	if (tag === MEMO) {
		register((type as Memo).type, `${id}$type`);
	}
}

/**
 * @description Records the hook order a component's transform captured, so {@link performReactRefresh} can
 * tell a changed body from a changed hook count.
 * @param type The component.
 * @param key The signature the transform computed.
 * @param forceReset Whether the component's hooks must never be reused.
 * @param getCustomHooks Reads the hooks the component's custom hooks call into.
 */
export function setSignature(
	type: RefreshType,
	key: string,
	forceReset = false,
	getCustomHooks?: () => unknown[],
): void {
	if (signatures.has(type)) return;

	signatures.set(type, {
		forceReset,
		ownKey: key,
		fullKey: null,
		getCustomHooks: getCustomHooks ?? (() => []),
	});

	const tag = tagOf(type);

	if (tag === FORWARD_REF) {
		setSignature((type as ForwardRef).render, key, forceReset, getCustomHooks);
	}

	if (tag === MEMO) {
		setSignature((type as Memo).type, key, forceReset, getCustomHooks);
	}
}

/**
 * @description Finds the family a component type or family id belongs to.
 * @param id The family id a module registered the component under.
 * @returns The family, or `undefined` if this id was never registered.
 */
export function getFamilyByID(id: string): Family | undefined {
	return familiesById.get(id);
}

/**
 * @description Finds the family a component type belongs to.
 * @param type The component type.
 * @returns The family, or `undefined` if this type was never registered.
 */
export function getFamilyByType(type: RefreshType): Family | undefined {
	return familiesByType.get(type);
}

/**
 * @description Makes the signature function the transform puts on `globalThis.$RefreshSig$`.
 * @returns The function the transformed module calls with its component and hook key each run.
 */
export function createSignatureFunctionForTransform() {
	let savedType: RefreshType | undefined;
	let hasCustomHooks = false;
	let didCollectHooks = false;

	return function signature<T>(
		type: T,
		key?: string,
		forceReset?: boolean,
		getCustomHooks?: () => unknown[],
	) {
		if (typeof key === 'string') {
			if (!savedType) {
				savedType = type as RefreshType;
				hasCustomHooks = typeof getCustomHooks === 'function';
			}

			if (type !== null && (typeof type === 'function' || typeof type === 'object')) {
				setSignature(type as RefreshType, key, forceReset, getCustomHooks);
			}

			return type;
		}

		if (!(!didCollectHooks && hasCustomHooks && savedType)) {
			return;
		}

		didCollectHooks = true;

		collectCustomHooksForSignature(savedType);
	};
}

/**
 * @description Applies the components registered since the last call, splitting the families whose hooks
 * changed and so need a remount from those React can re-render in place.
 * @returns The families per outcome, or `null` when nothing was registered again or a refresh is running.
 */
export function performReactRefresh(): RefreshUpdate | null {
	if (!pending.length || refreshing) return null;

	refreshing = true;

	try {
		const updatedFamilies = new Set<Family>();
		const staleFamilies = new Set<Family>();
		const updates = pending.slice();

		pending.length = 0;

		for (const [family, next] of updates) {
			const previous = family.current;

			family.current = next;

			if (isCompatible(previous, next)) {
				updatedFamilies.add(family);
			} else {
				staleFamilies.add(family);
			}
		}

		return { updatedFamilies, staleFamilies };
	} finally {
		refreshing = false;
	}
}

/**
 * @description Hashes a component's signature together with the signatures of the custom hooks it calls.
 * @param signature The component's signature.
 * @returns The full key, or the component's own key when a hook cannot be read or is not a component.
 */
function computeFullKey(signature: Signature): string {
	if (signature.fullKey !== null) {
		return signature.fullKey;
	}

	let hooks: unknown[];

	try {
		hooks = signature.getCustomHooks();
	} catch {
		signature.forceReset = true;

		return (signature.fullKey = signature.ownKey);
	}

	let fullKey = signature.ownKey;

	for (const hook of hooks) {
		if (typeof hook !== 'function') {
			signature.forceReset = true;

			return (signature.fullKey = signature.ownKey);
		}

		const nested = signatures.get(hook as RefreshType);

		if (nested) {
			fullKey += `\n---\n${computeFullKey(nested)}`;

			if (nested.forceReset) {
				signature.forceReset = true;
			}
		}
	}

	return (signature.fullKey = fullKey);
}

function collectCustomHooksForSignature(type: RefreshType): void {
	const signature = signatures.get(type);

	if (signature) {
		computeFullKey(signature);
	}
}

// A class component, or a component whose type changed, must remount; otherwise the hook order decides.
function isCompatible(previous: RefreshType, next: RefreshType): boolean {
	if (
		(previous as WithPrototype).prototype?.isReactComponent ||
		(next as WithPrototype).prototype?.isReactComponent
	) {
		return false;
	}

	if (typeof previous !== typeof next) {
		return false;
	}

	if (typeof previous === 'object' && previous !== null && next !== null) {
		const previousTag = tagOf(previous);
		const nextTag = tagOf(next);

		if (previousTag !== nextTag) {
			return false;
		}

		if (previousTag === MEMO) {
			const previousCompare = (previous as Memo).compare;
			const nextCompare = (next as Memo).compare;

			if ((previousCompare === null) !== (nextCompare === null)) {
				return false;
			}
		}
	}

	const previousSignature = signatures.get(previous);
	const nextSignature = signatures.get(next);

	if (!previousSignature && !nextSignature) {
		return true;
	}

	if (!previousSignature || !nextSignature) {
		return false;
	}

	return (
		computeFullKey(previousSignature) === computeFullKey(nextSignature) &&
		!nextSignature.forceReset
	);
}

function tagOf(type: RefreshType): symbol | undefined {
	try {
		return (type as { $$typeof?: symbol }).$$typeof;
	} catch {
		// UNKNOWN: a component's `$$typeof` getter is whatever the component author wrote.
		return undefined;
	}
}
