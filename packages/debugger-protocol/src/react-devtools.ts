/**
 * React DevTools over the debugger socket: the device's backend and the frontend (the DevTools app's
 * controller) swap React DevTools' own `{ event, payload }` messages, each wrapped in one frame.
 */

/** Device ↔ bridge ↔ the frontend controller: one React DevTools message. */
export type ReactDevtoolsFrame = {
	type: 'react-devtools';
	event: string;
	// UNKNOWN: React DevTools' payloads differ per event; the bridge passes them through untouched.
	payload?: unknown;
};

/** The payload of {@link REACT_DEVTOOLS_STATUS_EVENT}. */
export type ReactDevtoolsStatus = {
	connected: boolean;
	/** Why the backend is unavailable, such as the loader not having run it. */
	error?: string;
};

/**
 * The event the device sends the frontend, with a {@link ReactDevtoolsStatus}, when its backend
 * starts a session, cannot start one, or ends one.
 */
export const REACT_DEVTOOLS_STATUS_EVENT = 'unbound:backend-status';

/** React DevTools' own event that ends a backend session; the bridge sends it when the frontend leaves. */
export const REACT_DEVTOOLS_SHUTDOWN_EVENT = 'shutdown';

/**
 * @description Checks the fields of a React DevTools frame whose `type` is already known.
 * @param frame The parsed frame.
 * @returns Whether the frame names an event.
 */
export function isReactDevtoolsFrame(frame: object): frame is ReactDevtoolsFrame {
	return 'event' in frame && typeof frame.event === 'string';
}
