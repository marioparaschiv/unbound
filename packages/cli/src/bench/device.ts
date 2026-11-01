import { join } from 'node:path';
import { z } from 'zod';

import type { AppInfo, Vphone } from '~/bench/vphone';
import type { VariantBuild } from '~/bench/build';
import type { BenchServer } from '~/bench/server';

/** Where the bench keeps its snapshot and staged plugin sets on the device. Removed by every restore. */
export const DEVICE_BENCH_DIR = '/var/tmp/unbound-bench';

const SNAPSHOT = `${DEVICE_BENCH_DIR}/snapshot`;
const TWEAK_DIRS = [
	'/Library/MobileSubstrate/DynamicLibraries',
	'/var/jb/Library/MobileSubstrate/DynamicLibraries',
];
const JB_RESOURCES = '/var/jb/Library/Application Support';

/** The device folders and files a bench run changes; the snapshot holds exactly these. */
export type DevicePaths = { unbound: string; app: string };

const settingsSchema = z.record(z.string(), z.json());

/** settings.json: one key per storage bucket. */
export type SettingsJson = z.infer<typeof settingsSchema>;

/**
 * @description Finds Discord's Unbound folder and app bundle from its install info.
 * @param info Discord's app info.
 * @returns The paths.
 */
export function devicePaths(info: AppInfo): DevicePaths {
	return { unbound: `${info.documents_path}/Unbound`, app: info.bundle_path };
}

function quote(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function snapshotTargets(paths: DevicePaths): string[] {
	return [
		paths.unbound,
		...TWEAK_DIRS.flatMap((dir) => [`${dir}/Unbound.dylib`, `${dir}/Unbound.plist`]),
		`${paths.app}/UnboundResources.bundle`,
		`${JB_RESOURCES}/UnboundResources.bundle`,
	];
}

/**
 * @description Shell script that copies every path a run changes into a fresh snapshot, recording absent paths so
 * the restore removes them. It is written aside and renamed, so a half-taken snapshot is never restored.
 * @param paths The device paths.
 * @returns The script.
 */
export function snapshotScript(paths: DevicePaths): string {
	const tmp = `${SNAPSHOT}.tmp`;

	return [
		'set -e',
		`rm -rf ${tmp} && mkdir -p ${tmp} && : > ${tmp}/manifest`,
		...snapshotTargets(paths).map(
			(path, index) =>
				`if [ -e ${quote(path)} ]; then cp -a ${quote(path)} ${tmp}/${index}; printf '%s\\t%s\\n' ${index} ${quote(path)} >> ${tmp}/manifest; else printf -- '-\\t%s\\n' ${quote(path)} >> ${tmp}/manifest; fi`,
		),
		`mv ${tmp} ${SNAPSHOT}`,
		'echo snapshot taken',
	].join('\n');
}

/**
 * @description Shell script that puts every snapshotted path back and deletes the bench folder. With no snapshot it
 * only deletes leftovers, so it is safe to run any number of times.
 * @returns The script; it prints `restored` when it restored a snapshot.
 */
export function restoreScript(): string {
	return [
		'set -e',
		`if [ -f ${SNAPSHOT}/manifest ]; then`,
		`  while IFS="$(printf '\\t')" read -r index path; do rm -rf "$path"; if [ "$index" != "-" ]; then cp -a ${SNAPSHOT}/"$index" "$path"; fi; done < ${SNAPSHOT}/manifest`,
		'  echo restored',
		'fi',
		`rm -rf ${DEVICE_BENCH_DIR}`,
	].join('\n');
}

/**
 * @description Reads settings.json while Discord is stopped.
 * @param vphone The device.
 * @param paths The device paths.
 * @returns The parsed settings.
 */
export async function readSettings(vphone: Vphone, paths: DevicePaths): Promise<SettingsJson> {
	return settingsSchema.parse(
		JSON.parse(await vphone.shell(`cat ${quote(`${paths.unbound}/settings.json`)}`)),
	);
}

/**
 * @description Replaces settings.json while Discord is stopped, through the bench server.
 * @param vphone The device.
 * @param server The bench server the device downloads from.
 * @param paths The device paths.
 * @param settings The new settings.
 */
export async function writeSettings(
	vphone: Vphone,
	server: BenchServer,
	paths: DevicePaths,
	settings: SettingsJson,
): Promise<void> {
	const url = server.publish(`settings-${Date.now()}.json`, {
		text: JSON.stringify(settings, null, '\t'),
	});
	const target = quote(`${paths.unbound}/settings.json`);

	await vphone.shell(
		`set -e; curl -sf -o ${target}.bench ${quote(url)}; mv ${target}.bench ${target}; chown mobile:mobile ${target}`,
	);
}

function child(object: SettingsJson, key: string): SettingsJson {
	const existing = object[key];
	const parsed = settingsSchema.safeParse(existing);
	const next = parsed.success ? { ...parsed.data } : {};

	object[key] = next;

	return next;
}

/**
 * @description Points the loader at the bench server with hot reload off (the release default) and enables every
 * plugin the variants ship. Everything else in the settings is kept.
 * @param current The device's settings.
 * @param bundleUrl The bench server's bundle URL.
 * @param pluginIds Every plugin id across the variants.
 * @returns The new settings.
 */
export function benchSettings(
	current: SettingsJson,
	bundleUrl: string,
	pluginIds: string[],
): SettingsJson {
	const settings = { ...current };
	const update = child(child(child(settings, 'unbound'), 'loader'), 'update');
	const states = child(child(settings, 'plugins'), 'states');

	update.url = bundleUrl;
	update.hmr = false;

	for (const id of pluginIds) states[id] = true;

	return settings;
}

/**
 * @description Empties Unbound's module cache, which lives in settings.json under the `unbound::cache` bucket.
 * @param current The device's settings.
 * @returns The settings without the cache.
 */
export function withoutModuleCache(current: SettingsJson): SettingsJson {
	return Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'unbound::cache'));
}

/**
 * @description Shell script that installs a variant's plugins and, when the installed loader differs, its loader.
 * Plugin sets are downloaded once per run and copied in at each switch. Discord must be stopped.
 * @param build The variant's build.
 * @param paths The device paths.
 * @param url The URLs of the variant's published files.
 * @returns The script.
 */
export function installScript(
	build: VariantBuild,
	paths: DevicePaths,
	url: (file: string) => string,
): string {
	const staged = `${DEVICE_BENCH_DIR}/plugins/${build.variant}`;
	const plugins = quote(`${paths.unbound}/Plugins`);
	const appResources = quote(`${paths.app}/UnboundResources.bundle`);

	return [
		'set -e',
		`if [ ! -f ${staged}/.ready ]; then rm -rf ${staged}; mkdir -p ${staged}; curl -sf ${quote(url('plugins.tar'))} | tar -xf - -C ${staged}; touch ${staged}/.ready; fi`,
		`rm -rf ${plugins}; cp -R ${staged} ${plugins}; rm -f ${plugins}/.ready; chown -R mobile:mobile ${plugins}`,
		`if [ "$(sha256sum ${TWEAK_DIRS[0]}/Unbound.dylib 2>/dev/null | cut -c1-64)" != "${build.loaderSha256}" ]; then`,
		...TWEAK_DIRS.map(
			(dir) =>
				`  mkdir -p ${dir}; curl -sf -o ${dir}/Unbound.dylib ${quote(url('Unbound.dylib'))}; curl -sf -o ${dir}/Unbound.plist ${quote(url('Unbound.plist'))}; chown root:wheel ${dir}/Unbound.dylib ${dir}/Unbound.plist; chmod 755 ${dir}/Unbound.dylib; chmod 644 ${dir}/Unbound.plist`,
		),
		`  rm -rf ${appResources}; curl -sf ${quote(url('resources.tar'))} | tar -xf - -C ${quote(paths.app)}; chown -R _installd:_installd ${appResources}`,
		`  rm -rf ${quote(`${JB_RESOURCES}/UnboundResources.bundle`)}; mkdir -p ${quote(JB_RESOURCES)}; curl -sf ${quote(url('resources.tar'))} | tar -xf - -C ${quote(JB_RESOURCES)}; chown -R root:wheel ${quote(`${JB_RESOURCES}/UnboundResources.bundle`)}`,
		'  echo loader installed',
		'fi',
	].join('\n');
}

/**
 * @description Publishes a variant's plugin set and loader on the bench server.
 * @param server The bench server.
 * @param build The variant's build.
 * @returns A function giving each published file's URL.
 */
export function publishBuild(server: BenchServer, build: VariantBuild): (file: string) => string {
	const urls = new Map([
		[
			'plugins.tar',
			server.publish(`${build.variant}/plugins.tar`, {
				path: join(build.dir, 'plugins.tar'),
			}),
		],
		[
			'Unbound.dylib',
			server.publish(`${build.variant}/Unbound.dylib`, {
				path: join(build.dir, 'loader/Unbound.dylib'),
			}),
		],
		[
			'Unbound.plist',
			server.publish(`${build.variant}/Unbound.plist`, {
				path: join(build.dir, 'loader/Unbound.plist'),
			}),
		],
		[
			'resources.tar',
			server.publish(`${build.variant}/resources.tar`, {
				path: join(build.dir, 'loader/resources.tar'),
			}),
		],
	]);

	return (file) => urls.get(file) ?? '';
}

/**
 * @description Reads the size of the loader log, the offset a launch's lines start after.
 * @param vphone The device.
 * @param paths The device paths.
 * @returns The size in bytes.
 */
export async function logSize(vphone: Vphone, paths: DevicePaths): Promise<number> {
	return (
		Number(
			(
				await vphone.shell(
					`wc -c < ${quote(`${paths.unbound}/Logs/unbound.log`)} 2>/dev/null || echo 0`,
				)
			).trim(),
		) || 0
	);
}

const LAUNCH_LINES = [
	' [EF] \\[',
	'RCTHost didInitializeRuntime',
	'Loaded [0-9]+ plugins?\\.',
	'Attempting to execute bundle',
	'Initializing Unbound',
	'Plugins started',
	'Unbound initialized',
	'successfully executed',
	'Running "Discord"',
];

/**
 * @description Reads the loader log lines a launch wrote after `offset`, following a rotation, filtered to the lines
 * the milestone parser and the error list read.
 * @param vphone The device.
 * @param paths The device paths.
 * @param offset The log size when the launch began.
 * @returns The lines.
 */
export async function readLaunchLog(
	vphone: Vphone,
	paths: DevicePaths,
	offset: number,
): Promise<string> {
	const logs = quote(`${paths.unbound}/Logs`);
	const read = `cd ${logs}; n=$(wc -c < unbound.log); if [ "$n" -lt ${offset} ]; then tail -c +${offset + 1} unbound.1.log; cat unbound.log; else tail -c +${offset + 1} unbound.log; fi`;

	return vphone.shell(`(${read}) | grep -E '${LAUNCH_LINES.join('|')}' | cut -c1-400; true`);
}

/**
 * @description Hashes the bundle the loader keeps as current, which after a launch is the one that ran.
 * @param vphone The device.
 * @param paths The device paths.
 * @returns The sha256, or `null` when there is no bundle.
 */
export async function currentBundleSha(vphone: Vphone, paths: DevicePaths): Promise<string | null> {
	const out = (
		await vphone.shell(
			`sha256sum ${quote(`${paths.unbound}/unbound.bundle`)} 2>/dev/null | cut -c1-64; true`,
		)
	).trim();

	return /^[0-9a-f]{64}$/.test(out) ? out : null;
}

export default {
	DEVICE_BENCH_DIR,
	devicePaths,
	snapshotScript,
	restoreScript,
	readSettings,
	writeSettings,
	benchSettings,
	withoutModuleCache,
	installScript,
	publishBuild,
	logSize,
	readLaunchLog,
	currentBundleSha,
};
