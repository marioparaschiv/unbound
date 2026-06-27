import { join } from 'node:path';

import { resolveDevServerUrl } from '../dev-host';

export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
export const HOST = process.env.HOST || '0.0.0.0';
export const DIST_DIR = join(__dirname, '..', '..', 'dist');

// The address a device on the LAN should point at - matches what the dev build
// bakes into the bundle, so the two never drift.
export const LAN_URL = resolveDevServerUrl();

export const KEEPALIVE_INTERVAL = 5000;
export const WS_IDLE_TIMEOUT = 60;
export const WATCH_DEBOUNCE = 100;

/** The name of the built bundle file inside `DIST_DIR`. */
export const BUNDLE_NAME = 'unbound.bundle';

export default {
	PORT,
	HOST,
	DIST_DIR,
	LAN_URL,
	KEEPALIVE_INTERVAL,
	WS_IDLE_TIMEOUT,
	WATCH_DEBOUNCE,
	BUNDLE_NAME,
};
