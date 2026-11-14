import type { PatchCallback, PatchContext, PatchParent } from 'possess';
import { PatchType, patches } from 'possess';

const CHAINED = Symbol('unbound.patcher.instead-chained');
const STEP = Symbol('unbound.patcher.instead-step');

type ChainContext = PatchContext & { [CHAINED]?: boolean; [STEP]?: boolean };

function insteadCallbacks(parent: PatchParent, method: string): PatchCallback[] {
	const entry = patches.find(
		(candidate) => candidate.parent.deref() === parent && candidate.method === method,
	);

	return entry ? [...entry.patches[PatchType.Instead]].map((patch) => patch.callback) : [];
}

/**
 * @description Makes an `instead` callback chain with the others on the same method: possess calls each with the real method
 * as `original`, so two of them would both run it. The first one a call reaches runs every `instead` in order, each one's
 * `original` calling the next, and the rest of that call's callbacks do nothing.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param callback The `instead` callback.
 * @returns The callback to register with possess.
 */
export function chainInstead(
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
): PatchCallback {
	return function chained(
		// UNKNOWN: possess calls patch callbacks with the patched method's `this`.
		this: unknown,
		ctx: ChainContext,
	) {
		if (ctx[STEP]) {
			return callback.call(this, ctx);
		}

		if (ctx[CHAINED]) {
			return undefined;
		}

		ctx[CHAINED] = true;

		return runChain(insteadCallbacks(parent, method), this, ctx, 0, ctx.args);
	};
}

// UNKNOWN: a patched method may return anything.
function runChain(
	callbacks: PatchCallback[],
	// UNKNOWN: the patched method's `this`, passed through to each callback.
	receiver: unknown,
	ctx: ChainContext,
	index: number,
	// UNKNOWN: a patched method takes any arguments.
	args: unknown[],
): unknown {
	const next = callbacks[index];

	if (!next) {
		return ctx.original(...args);
	}

	const stepContext: ChainContext = {
		...ctx,
		args,
		original: (...nextArgs: unknown[]) =>
			runChain(callbacks, receiver, ctx, index + 1, nextArgs),
		[STEP]: true,
	};

	return next.call(receiver, stepContext);
}

export default chainInstead;
