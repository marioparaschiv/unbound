import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from '@unbound-app/contracts/zod';

import type { CommandRunner, DropTarget } from './device-drops';
import { deviceScript } from './device-script';

const ENVIRONMENT_FILE = 'environment.json';
const IOS_TWEAK_DIRECTORY = '/var/jb/Library/MobileSubstrate/DynamicLibraries';
const ANDROID_MODULES = ['app.astral.android'];
const SHA256 = /\b([0-9a-f]{64})\b/;

export const deviceEnvironmentSchema = z.object({
	loader: z.string(),
	origin: z.string(),
	client: z.string(),
	discord: z.string(),
});

export type DeviceEnvironment = z.infer<typeof deviceEnvironmentSchema>;

const environmentSchema = z.object({
	loader: z.string(),
	origin: z.string(),
	client: z.string(),
	discord: z.string(),
	loaderFile: z.string(),
});

export type Environment = z.infer<typeof environmentSchema>;

type LoaderGlobal = typeof globalThis & { UNBOUND_LOADER?: { version?: string; origin?: string } };

function readDeviceEnvironment(clientPath: string) {
	const loader = (globalThis as LoaderGlobal).UNBOUND_LOADER;
	const info = unbound.native?.BundleInfo;
	const hash = (text: string) => {
		let value = 0x811c9dc5;

		for (let index = 0; index < text.length; index++) {
			value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
		}

		return `${(value >>> 0).toString(16)}:${text.length}`;
	};

	return Promise.resolve(unbound.fs.read(clientPath, 'base64'))
		.then(
			(text) => hash(String(text)),
			() => '',
		)
		.then((client) =>
			JSON.stringify({
				loader: loader?.version ?? '',
				origin: loader?.origin ?? '',
				client,
				discord: `${info?.Version ?? ''}+${info?.Build ?? ''}`,
			}),
		);
}

/**
 * @description Reads what the device runs besides the plugins: the loader's version and file, a hash of the installed client bundle, and Discord's version.
 * @returns A script whose result is the {@link DeviceEnvironment} as JSON.
 */
export function deviceEnvironmentScript(): string {
	return deviceScript(readDeviceEnvironment, 'Unbound/unbound.bundle');
}

/**
 * @description Reads a SHA-256 digest from `sha256sum` output.
 * @param output What the command printed.
 * @returns The digest, or an empty string when there is none.
 */
export function parseDigest(output: string): string {
	return SHA256.exec(output)?.[1] ?? '';
}

/**
 * @description Hashes the loader binary the device runs, from the host: the tweak dylib on iOS, the LSPosed module's APK on Android.
 * @param target The device.
 * @param run Runs a host command.
 * @param origin The loader file the loader reports, such as `Unbound.dylib`.
 * @returns The digest, or an empty string when it cannot be read.
 */
export async function loaderDigest(
	target: DropTarget,
	run: CommandRunner,
	origin: string,
): Promise<string> {
	if (target.kind === 'ios') {
		if (!/^[\w.-]+\.dylib$/.test(origin)) return '';

		const { stdout } = await run([
			'jb-p1lot',
			'shell_exec',
			'--device',
			target.udid,
			'--command',
			`/var/jb/usr/bin/sha256sum ${IOS_TWEAK_DIRECTORY}/${origin}`,
		]);

		return parseDigest(stdout);
	}

	const serial = target.serial ? ['-s', target.serial] : [];

	for (const module of ANDROID_MODULES) {
		const { stdout } = await run(['adb', ...serial, 'shell', 'pm', 'path', module]);
		const path = /package:(\S+)/.exec(stdout)?.[1];

		if (!path) continue;

		return parseDigest((await run(['adb', ...serial, 'shell', 'sha256sum', path])).stdout);
	}

	return '';
}

/**
 * @description Says whether results from the last run were measured on the same loader, client and Discord, so they can be kept.
 * @param previous The last run's environment.
 * @param current This run's environment.
 * @returns `true` only when every part is known and unchanged.
 */
export function sameEnvironment(previous: Environment | undefined, current: Environment): boolean {
	if (!previous || !current.loaderFile || !current.client) return false;

	return (
		previous.loaderFile === current.loaderFile &&
		previous.client === current.client &&
		previous.discord === current.discord &&
		previous.loader === current.loader
	);
}

/**
 * @description Reads the environment the last run in this output directory recorded.
 * @param out The output directory.
 * @returns The environment, or `undefined` when there is none.
 */
export function readEnvironment(out: string): Environment | undefined {
	const file = join(out, ENVIRONMENT_FILE);

	if (!existsSync(file)) return;

	try {
		const parsed = environmentSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));

		return parsed.success ? parsed.data : undefined;
	} catch {
		return;
	}
}

/**
 * @description Records this run's environment for the next run to compare against.
 * @param out The output directory.
 * @param environment The environment.
 */
export function writeEnvironment(out: string, environment: Environment) {
	writeFileSync(join(out, ENVIRONMENT_FILE), `${JSON.stringify(environment, null, '\t')}\n`);
}
