import { createLogger } from '@unbound-app/logger';
import type { Patch, PatchContext } from 'possess';
import * as Possess from 'possess';

import { findInvalidRowValues, type RowValue } from '~/core/row-values';
import type { PatcherInstance } from '~/patcher/create-patcher';
import { aliasPatchCallback } from '~/hot-refresh/live-patch';

const Logger = createLogger('RowValueGuard', 'Shapes');
const OWN_CALLER = 'unbound::row-value-guard';

const checked = new WeakSet<Patch>();
const reported = new Set<string>();

function invalidPaths(row: RowValue): Set<string> {
	return new Set(findInvalidRowValues(row).map((value) => `${value.path} ${value.reason}`));
}

function reportNew(caller: string, before: Set<string>, row: RowValue) {
	for (const problem of invalidPaths(row)) {
		const key = `${caller} ${problem}`;

		if (before.has(problem) || reported.has(key)) {
			continue;
		}

		reported.add(key);
		Logger.error(`${caller} left a chat row value Discord cannot draw: ${problem}`);
	}
}

function checkPatch(patch: Patch) {
	const caller = patch.caller;

	if (checked.has(patch) || !caller || caller === OWN_CALLER) return;

	checked.add(patch);

	const original = patch.callback;

	const checkedCallback = function checkedCallback(
		// UNKNOWN: possess calls patch callbacks with the patched method's `this`.
		this: unknown,
		ctx: PatchContext,
	) {
		const before = invalidPaths(ctx.result);
		const returned: RowValue = original.call(this, ctx);

		reportNew(caller, before, returned === undefined ? ctx.result : returned);

		return returned;
	};

	aliasPatchCallback(checkedCallback, original);
	patch.callback = checkedCallback;
}

/**
 * @description In developer builds, checks each plugin's patch on chat rows as it runs and logs, by plugin, any value
 * it leaves that Discord's native code cannot draw.
 * @param patcher The guard's patcher.
 * @param prototype `RowManager.prototype`.
 */
export function watchRowShapes(patcher: PatcherInstance, prototype: MetroExport) {
	patcher.before(prototype, 'generate', () => {
		const state = Possess.patches.find(
			(entry) => entry.parent.deref() === prototype && entry.method === 'generate',
		);

		for (const patch of state?.patches[Possess.PatchType.After] ?? []) checkPatch(patch);
	});
}
