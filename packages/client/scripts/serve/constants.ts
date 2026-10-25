import { join } from 'node:path';

import { resolveDevServerUrl } from '../dev-host';

export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
export const HOST = process.env.HOST || '0.0.0.0';
export const DIST_DIR = join(__dirname, '..', '..', 'dist');

// The address a device on the LAN should point at - matches what the dev build
// bakes into the bundle, so the two never drift.
export const LAN_URL = resolveDevServerUrl();

export const MANIFEST_POLL_INTERVAL = 250;

/** The JavaScript bundle inside `DIST_DIR`; every Hermes `unbound.<version>.bundle` is compiled from it. */
export const SOURCE_BUNDLE_NAME = 'unbound.js';

/** Written after every bundle variant, so its change marks a finished build. */
export const MANIFEST_NAME = 'manifest.json';

/** Matches every bundle variant the loader may download: `unbound.js` or `unbound.<version>.bundle`. */
export const BUNDLE_PATTERN = /^unbound\.(?:js|\d+\.bundle)$/;

export default {
	PORT,
	HOST,
	DIST_DIR,
	LAN_URL,
	MANIFEST_POLL_INTERVAL,
	SOURCE_BUNDLE_NAME,
	MANIFEST_NAME,
	BUNDLE_PATTERN,
};
