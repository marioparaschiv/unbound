import { MessageRowData } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { createLookup, requestBranding, type BrandingLookup } from '~/lib/lookup';
import { createPendingRows, type PendingRows } from '~/lib/redraw';
import { createToggles, type Toggles } from '~/lib/toggles';

type Session = {
	lookup: BrandingLookup;
	toggles: Toggles;
	pending: PendingRows;
	active: boolean;
};

const REDRAW_KEYS: readonly (string | null)[] = ['replaceElements', 'dearrowByDefault', null];
// Discord's native chat list calls `RowManager.generate` for one row at a time, on its own schedule, after
// `MessageStore` changes. Nothing in JS says when the last redrawn row was generated (no event, promise or
// batch), so no ordering can hold `stop` open exactly long enough. It outlasts `REBIND_ALL_MS` in redraw.ts.
const REBIND_GRACE_MS = 1600;

let current: Session | undefined;

/**
 * @description Starts a run's branding cache, embed switches and rows waiting for branding, which every feature shares.
 * Warns and starts none when Discord moved its message row module, so every feature stays off.
 */
export function startSession(): void {
	current = undefined;

	if (!MessageRowData) {
		logger.warn('DeArrow skipped: Discord moved MessageRowData.');

		return;
	}

	const pending = createPendingRows();

	current = {
		lookup: createLookup(requestBranding, pending.resolve),
		toggles: createToggles(() => settings.dearrowByDefault),
		pending,
		active: true,
	};
}

/**
 * @description Reads the running session, which ends once `stop` starts redrawing the original embeds.
 * @returns The session, or `undefined` when none runs.
 */
export function activeSession(): Session | undefined {
	return current?.active ? current : undefined;
}

/**
 * @description Reads the rows to bind again, which outlive the session until the original embeds are redrawn.
 * @returns The rows, or `undefined` when no session started.
 */
export function pendingRows(): PendingRows | undefined {
	return current?.pending;
}

/**
 * @description Redraws the chat when a setting that changes how embeds look changes.
 */
export function listenToSettings(): void {
	const session = activeSession();

	if (!session) return;

	storage.onChange(
		(payload) => payload.store === addon.id && REDRAW_KEYS.includes(payload.key),
		session.pending.rebindAll,
	);
}

/**
 * @description Ends the session and redraws the chat with the original embeds, dropping branding that arrives later.
 * @returns A promise that resolves once the redrawn rows were bound again, while the `RowManager` patch still marks them.
 */
export function redrawOriginalEmbeds(): Promise<void> {
	const session = activeSession();

	if (!session) return Promise.resolve();

	session.active = false;
	session.pending.clear();
	session.pending.rebindAll();
	session.lookup.dispose();

	return new Promise((resolve) => setTimeout(resolve, REBIND_GRACE_MS));
}
