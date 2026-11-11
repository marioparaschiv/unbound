import {
	REACT_DEVTOOLS_SHUTDOWN_EVENT,
	REACT_DEVTOOLS_STATUS_EVENT,
} from '@unbound-app/debugger-protocol';
import type { ReactDevtoolsFrame, ReactDevtoolsStatus } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import { watchHighlights } from '~/debugger/react-devtools-highlight.dev';

/** One React DevTools message, as its backend's bridge reads and writes them. */
type WallMessage = { event: string; payload?: unknown };

type WallListener = (message: WallMessage) => void;

/** The options of react-devtools-core's `connectWithCustomMessagingProtocol` this module passes. */
type MessagingOptions = {
	onSubscribe: (listener: WallListener) => void;
	onUnsubscribe: (listener: WallListener) => void;
	onMessage: (event: string, payload: unknown) => void;
};

declare global {
	/** Set by the React DevTools backend the loader runs before Discord when `loader.devtools` is on. */
	var DevTools:
		| {
				version: string;
				/** Starts a backend session over the given transport; returns its teardown. */
				connectWithCustomMessagingProtocol?: (
					options: MessagingOptions,
				) => (() => void) | undefined;
		  }
		| undefined;
}

type Session = {
	listeners: Set<WallListener>;
	unsubscribe: (() => void) | undefined;
	unwatchHighlights: () => void;
};

const Logger = createLogger('Debugger', 'ReactDevTools');

let session: Session | undefined;

/**
 * @description Feeds a frontend's React DevTools frame to the backend, starting a session on the first.
 * @param frame The frame the frontend sent over the debugger socket.
 * @param send Sends a frame back over the debugger socket.
 */
export function receive(frame: ReactDevtoolsFrame, send: (frame: ReactDevtoolsFrame) => void) {
	if (frame.event === REACT_DEVTOOLS_SHUTDOWN_EVENT) {
		endSession();

		return;
	}

	const current = session ?? startSession(send);

	if (!current) return;

	for (const listener of current.listeners) {
		listener({ event: frame.event, payload: frame.payload });
	}
}

/** Ends the backend session, if one runs; the next frontend frame starts a fresh one. */
export function endSession() {
	const current = session;

	if (!current) return;

	session = undefined;

	// React DevTools' own shutdown: the agent stops its listeners and the backend's bridge closes.
	for (const listener of current.listeners) {
		listener({ event: REACT_DEVTOOLS_SHUTDOWN_EVENT });
	}

	current.unwatchHighlights();
	current.unsubscribe?.();
	Logger.info('Session ended');
}

function startSession(send: (frame: ReactDevtoolsFrame) => void): Session | undefined {
	const connect = globalThis.DevTools?.connectWithCustomMessagingProtocol;

	if (!connect) {
		sendStatus(send, {
			connected: false,
			error: "React DevTools is off on this device. In Discord, open Unbound's Developer settings, turn on React DevTools, then restart Discord.",
		});

		return void 0;
	}

	const listeners = new Set<WallListener>();
	const started: Session = { listeners, unsubscribe: undefined, unwatchHighlights: () => {} };

	session = started;
	started.unsubscribe = connect({
		onSubscribe: (listener) => void listeners.add(listener),
		onUnsubscribe: (listener) => void listeners.delete(listener),
		onMessage: (event, payload) => send({ type: 'react-devtools', event, payload }),
	});
	// The backend creates its agent while connecting, so its highlight events can be watched only now.
	started.unwatchHighlights = watchHighlights();

	sendStatus(send, { connected: true });
	Logger.info('Session started');

	return started;
}

function sendStatus(send: (frame: ReactDevtoolsFrame) => void, status: ReactDevtoolsStatus) {
	send({ type: 'react-devtools', event: REACT_DEVTOOLS_STATUS_EVENT, payload: status });
}
