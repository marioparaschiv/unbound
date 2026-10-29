import type { NativeFabricBridge, NativeObjCBridge } from '@unbound-app/api/native';

import { removeLabelHooks, wakeWaitingCells, type TrackedCell } from '~/native/cells';
import { createLinkedMessages, type LinkedMessages } from '~/linked-messages';
import { reportSurfaceLayout, teardownSurface, type EmbeddedSurface } from '~/native/surfaces';
import { registerMessageSurface } from '~/components/message-surface';
import { SurfaceHeightCache } from '~/surface-layout';
import { createTimers, type Timers } from '~/timers';
import type { Renderers } from '~/modules';

/** Everything one run of the plugin owns, from `start` to `stop`. */
export type Session = {
	objc: NativeObjCBridge;
	fabric: NativeFabricBridge;
	renderers: Renderers;
	signal: AbortSignal;
	timers: Timers;
	surfaceModule: string;
	linked: LinkedMessages;
	cells: Map<string, TrackedCell>;
	surfaces: Map<string, EmbeddedSurface>;
	surfacesById: Map<string, EmbeddedSurface>;
	heights: SurfaceHeightCache;
	nextVersion: number;
};

/**
 * @description Opens a session and registers the React surface its embeds mount.
 * @param objc The Objective-C bridge.
 * @param fabric The Fabric bridge that mounts React surfaces into native views.
 * @param renderers Discord's message renderers.
 * @returns The session, and `dispose`, which tears down every embed it created; `undefined` when the surface did not register.
 */
export function createSession(
	objc: NativeObjCBridge,
	fabric: NativeFabricBridge,
	renderers: Renderers,
) {
	const controller = new AbortController();
	const session: Session = {
		objc,
		fabric,
		renderers,
		signal: controller.signal,
		timers: createTimers(),
		surfaceModule: '',
		linked: createLinkedMessages(controller.signal, (key) => wakeWaitingCells(session, key)),
		cells: new Map(),
		surfaces: new Map(),
		surfacesById: new Map(),
		heights: new SurfaceHeightCache(),
		nextVersion: 0,
	};
	const surfaceModule = registerMessageSurface({
		renderers: session.renderers,
		surface: (surfaceId) => session.surfacesById.get(surfaceId),
		reportLayout: (surfaceId, height) => reportSurfaceLayout(session, surfaceId, height),
	});

	if (!surfaceModule) return;

	session.surfaceModule = surfaceModule;

	// The registered surface keeps this session alive after `stop`, so it lets go of every handle and message.
	function dispose() {
		controller.abort();
		session.timers.clear();

		for (const cell of session.cells.values()) removeLabelHooks(cell);

		for (const surface of [...session.surfaces.values()]) {
			teardownSurface(session, surface, true);
		}

		session.cells.clear();
		session.surfacesById.clear();
		session.linked.clear();
	}

	return { session, dispose, drawn: () => session.surfaces.size };
}
