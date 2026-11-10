// Hot-refresh wire contract: dev server (`scripts/serve/refresh.ts`), its runtime (`scripts/build/dev-runtime.js`)
// and the device (`builtin.dev.ts`). Types only; nothing ships.

/** A patch the dev server sends to the device it was built for. */
export type PatchMessage = { type: 'patch'; code: string; filename: string; changedIds: string[] };

/** What a device reports after a patch: delivered, then refreshed in place, or rejected for a reload. */
export type DeviceMessage =
	| { type: 'applied'; filename: string }
	| { type: 'refreshed'; fibers: number; remounted: number; ms: number }
	| { type: 'rejected'; reason?: string };

/** Whether the dev runtime re-ran the patched modules, or the change needs a full reload. */
export type PatchOutcome = 'applied' | 'needs-reload';

/** The dev runtime `scripts/build/dev-runtime.js` installs as `globalThis.__rolldown_runtime__`. */
export type DevRuntime = {
	applyPatch(code: string, changedIds: string[]): PatchOutcome;
};
