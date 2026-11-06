#!/usr/bin/env bun
// Makes an installed Discord on the vphone load this machine's dev build, idempotently.
import { join } from 'node:path';

import {
	appPaths,
	DISCORD,
	HubError,
	readDeviceFile,
	writeDeviceFile,
	type Vphone,
} from './vphone.ts';
import { isObject, parseJson, type Json, type JsonObject } from './json.ts';
import { connectVphone } from './session.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `Makes an installed Discord on the vphone load this machine's Unbound dev build. Idempotent: it copies
UnboundResources into Discord.app and merges the loader and debugger keys into settings.json (keeping the
others), only when they differ, then relaunches. Run it after every IPA install.
  provision [--ipa <path on the vphone's Mac>]   install that IPA first (fetch-ipa, patch-ats.py, copy it there)
Needs the debug loader tweak installed (setup.md, step 4). Exit 0 when Unbound answers the bridge afterwards.`;

/** In the device shell's bootstrap root, where the loader's deb puts it. Real-root paths need `/rootfs`. */
const RESOURCES = '/var/jb/Library/Application Support/UnboundResources.bundle';

type Setting = [path: string, value: Json];

function argValue(flag: string): string | undefined {
	const at = process.argv.indexOf(flag);

	return at === -1 ? undefined : process.argv[at + 1];
}

/** Sets `value` at a dotted path, returning whether anything changed. */
function setPath(target: JsonObject, path: string[], value: Json): boolean {
	const [head, ...rest] = path;
	const current = target[head];

	if (!rest.length) {
		const changed = JSON.stringify(current) !== JSON.stringify(value);

		target[head] = value;

		return changed;
	}

	const next = isObject(current) ? current : {};

	target[head] = next;

	return setPath(next, rest, value);
}

async function readSettings(vphone: Vphone, remote: string): Promise<JsonObject> {
	try {
		const settings = parseJson(
			(await readDeviceFile(vphone, remote)).toString('utf8'),
			'settings.json',
		);

		return isObject(settings) ? settings : {};
	} catch {
		// No settings yet (first launch never finished): start from an empty file.
		return {};
	}
}

async function copyResources(vphone: Vphone, bundlePath: string): Promise<string> {
	const app = `/rootfs${bundlePath}/UnboundResources.bundle`;
	const missing = `[ -d "${RESOURCES}" ] || { echo "missing ${RESOURCES}: install the loader deb first"; exit 1; }`;
	const same = `[ -d "${app}" ] && diff -rq "${RESOURCES}" "${app}" >/dev/null 2>&1`;
	const copy = `rm -rf "${app}" && cp -a "${RESOURCES}" "${app}" && chown -R _installd:_installd "${app}"`;
	const command = `${missing}; if ${same}; then echo same; else ${copy} && echo copied; fi`;

	return (await vphone.text('shell', { command, root: true })).trim();
}

async function main(): Promise<number> {
	const { DEV_HOST, UNBOUND_DEV_PORT, UNBOUND_BRIDGE_PORT } = process.env;

	if (!DEV_HOST || !UNBOUND_DEV_PORT || !UNBOUND_BRIDGE_PORT) {
		throw new Error('Run through scripts/provision (it loads .env)');
	}

	const vphone = connectVphone();

	try {
		const ipa = argValue('--ipa');

		if (ipa) {
			console.log(await vphone.text('install_ipa', { path: ipa }, 600_000));
		}

		const paths = await appPaths(vphone);

		// Discord rewrites settings.json as it exits, so stop it before editing.
		await vphone.text('terminate', { bundle_id: DISCORD }).catch(() => '');
		console.log(`UnboundResources: ${await copyResources(vphone, paths.bundlePath)}`);

		const remote = `${paths.documentsPath}/Unbound/settings.json`;
		const settings = await readSettings(vphone, remote);
		const keys: Setting[] = [
			['unbound.loader.update.url', `http://${DEV_HOST}:${UNBOUND_DEV_PORT}/unbound.bundle`],
			['unbound.loader.update.hmr', true],
			['unbound.debugger.enabled', true],
			['unbound.debugger.address', `${DEV_HOST}:${UNBOUND_BRIDGE_PORT}`],
		];
		const changed = keys
			.filter(([path, value]) => setPath(settings, path.split('.'), value))
			.map(([path]) => path);

		if (changed.length) {
			const dir = `/rootfs${paths.documentsPath}/Unbound`;

			await vphone.text('shell', { command: `mkdir -p "${dir}"`, root: true });
			await writeDeviceFile(
				vphone,
				remote,
				new TextEncoder().encode(JSON.stringify(settings)),
			);
			await vphone.text('shell', { command: `chown -R mobile:mobile "${dir}"`, root: true });
		}

		console.log(
			`settings.json: ${changed.length ? `set ${changed.join(', ')}` : 'already set'}`,
		);
	} finally {
		vphone.close();
	}

	const relaunch = Bun.spawnSync(
		['bun', join(import.meta.dir, 'relaunch.ts'), '--stale', '--force'],
		{
			stdout: 'inherit',
			stderr: 'inherit',
		},
	);

	return relaunch.exitCode ?? 1;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(USAGE);
	process.exit(0);
}

main().then(
	(code) => process.exit(code),
	(error: Error) => {
		console.error(error.message);
		process.exit(error instanceof HubError ? 2 : 1);
	},
);
