/** The loader's log of Unbound and Discord JS lines; older loaders wrote plain text here alone. */
export const UNBOUND_LOG = 'Unbound/Logs/unbound.log';

/** The loader's log of React Native and other native output. */
export const NATIVE_LOG = 'Unbound/Logs/native.log';

/** Both current log files, each rotated on its own. */
export const LOG_FILES = [UNBOUND_LOG, NATIVE_LOG] as const;
