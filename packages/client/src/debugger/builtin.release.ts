/**
 * @description The default bundle's debugger. Only the dev bundle carries the socket and the protocol,
 * so every entry point does nothing and `shouldStart` keeps the built-in unregistered.
 */
import type * as debuggerModule from '~/debugger/builtin';

type Debugger = typeof debuggerModule;

/** @description Does nothing: the default bundle has no socket to start or close. */
function noop(): void {}

/**
 * @description Does nothing: the default bundle has no debugger to start.
 */
export const start: Debugger['start'] = noop;

/**
 * @description Does nothing: the default bundle has no debugger to stop.
 */
export const stop: Debugger['stop'] = noop;

/**
 * @description Never starts, whatever the settings say.
 * @returns `false`.
 */
export const shouldStart: Debugger['shouldStart'] = () => false;

export default { start, stop, shouldStart };
