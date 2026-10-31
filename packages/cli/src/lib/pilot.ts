import { delimiter, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { z } from 'zod';

import type { CommandResult, CommandRunner } from '~/lib/run-command';
import { DISCORD_BUNDLE_ID } from '~/lib/device-paths';
import { parseJson } from '~/lib/parse-json';

/** The binary that drives a jailbroken iPhone over its bridge. */
export const PILOT = 'jb-p1lot';

/** The line prefix device scripts print the reason they failed after. */
export const ERROR_MARKER = 'UBD_ERROR=';

export const IOS_TIMEOUTS = {
	list: 30_000,
	transfer: 120_000,
	shell: 90_000,
	restart: 60_000,
};

/** One iPhone reached through `jb-p1lot`. */
export type PilotTarget = {
	udid: string;
	pilot: string;
	run: CommandRunner;
};

export type ShellResult = { ok: true; output: string } | { ok: false; error: string };

export type PilotShellOptions = {
	timeoutMs?: number;
	/** Bound the command on the device too, so `jb-p1lot` reports the timeout itself. */
	onDevice?: boolean;
};

type PilotCommand = (args: string[], timeoutMs: number) => Promise<CommandResult>;

// The host waits this much longer than a device-side timeout, so the device's own report arrives first.
const DEVICE_TIMEOUT_GRACE_MS = 10_000;

const shellOutputSchema = z.object({
	exitCode: z.number().optional(),
	output: z.string().optional(),
});

const deviceListSchema = z.object({
	devices: z.array(z.object({ id: z.unknown(), bridge: z.boolean().optional() })).optional(),
});

const appContainerSchema = z.object({ dataContainer: z.string().optional() });

/**
 * @description Finds the `jb-p1lot` binary on the PATH, falling back to Go's install directory.
 * @param env The environment to read `PATH` and `GOPATH` from.
 * @param home The home directory, for Go's default `~/go/bin`.
 * @returns The binary's path, or its bare name when it is nowhere to be found.
 */
export function resolvePilot(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	const goBin = join(env.GOPATH?.split(delimiter)[0] || join(home, 'go'), 'bin');
	const directories = [...(env.PATH ?? '').split(delimiter).filter(Boolean), goBin];

	return directories.map((directory) => join(directory, PILOT)).find(existsSync) ?? PILOT;
}

/**
 * @description Picks the one jailbroken iPhone whose jb-p1lot bridge is running.
 * @param pilotCommand Runs a jb-p1lot command.
 * @returns The device's UDID, or why no single device could be picked.
 */
export async function pickDevice(pilotCommand: PilotCommand): Promise<string | { error: string }> {
	const listed = await pilotCommand(['device_list'], IOS_TIMEOUTS.list);

	if (!listed.ok) {
		return { error: listed.error };
	}

	const parsed = parseJson(listed.stdout, deviceListSchema, PILOT);
	const devices = (parsed.ok ? (parsed.value.devices ?? []) : []).flatMap((device) =>
		typeof device.id === 'string' && device.bridge !== false ? [device.id] : [],
	);

	const [only] = devices;

	if (only && devices.length === 1) {
		return only;
	}

	return {
		error: devices.length
			? `Several iOS devices are connected (${devices.join(', ')}); pass --udid to pick one.`
			: `${PILOT} lists no connected iOS device with its bridge running.`,
	};
}

/**
 * @description Reads a `jb-p1lot shell_exec` result, whose JSON carries the command's exit code and output.
 * @param result The finished `jb-p1lot` call.
 * @returns The command's output when it exited cleanly, otherwise its output or exit code as the error.
 */
export function parseShellResult(result: CommandResult): ShellResult {
	if (!result.ok) {
		return result;
	}

	const parsed = parseJson(result.stdout, shellOutputSchema, PILOT);

	if (!parsed.ok) {
		return parsed;
	}

	const { exitCode, output = '' } = parsed.value;

	return exitCode === 0
		? { ok: true, output }
		: {
				ok: false,
				error: output.trim() || `The device command exited with code ${exitCode}.`,
			};
}

/**
 * @description Runs a shell script on the iPhone through `jb-p1lot shell_exec`.
 * @param target The device, and the jb-p1lot binary and runner.
 * @param script The script to run.
 * @param options How long to wait, and whether the device enforces the limit too.
 * @returns The script's output, or why it failed.
 */
export async function pilotShell(
	target: PilotTarget,
	script: string,
	options: PilotShellOptions = {},
): Promise<ShellResult> {
	const { timeoutMs = IOS_TIMEOUTS.shell, onDevice = false } = options;
	const args = ['shell_exec', '--device', target.udid, '--command', script];

	return parseShellResult(
		onDevice
			? await target.run(
					target.pilot,
					[...args, '--timeoutMs', String(timeoutMs)],
					timeoutMs + DEVICE_TIMEOUT_GRACE_MS,
				)
			: await target.run(target.pilot, args, timeoutMs),
	);
}

/**
 * @description Finds Discord's data container on the iPhone.
 * @param target The device, and the jb-p1lot binary and runner.
 * @param timeoutMs How long to wait for `jb-p1lot`.
 * @returns The container's path, or why it could not be found.
 */
export async function discordDataContainer(
	target: PilotTarget,
	timeoutMs: number,
): Promise<string | { error: string }> {
	const result = await target.run(
		target.pilot,
		['app_container', '--device', target.udid, '--bundleId', DISCORD_BUNDLE_ID],
		timeoutMs,
	);

	if (!result.ok) {
		return { error: result.error };
	}

	const parsed = parseJson(result.stdout, appContainerSchema, PILOT);

	if (!parsed.ok) {
		return { error: parsed.error };
	}

	return parsed.value.dataContainer || { error: "Discord's data container was not found." };
}

/**
 * @description Reads the value a device script printed after a marker.
 * @param output The script's output.
 * @param marker The line prefix, such as {@link ERROR_MARKER}.
 * @returns The rest of the first marked line, trimmed, or `undefined` when no line has the marker.
 */
export function readMarker(output: string, marker: string): string | undefined {
	return output
		.split('\n')
		.find((line) => line.startsWith(marker))
		?.slice(marker.length)
		.trim();
}

export default {
	PILOT,
	ERROR_MARKER,
	IOS_TIMEOUTS,
	resolvePilot,
	pickDevice,
	parseShellResult,
	pilotShell,
	discordDataContainer,
	readMarker,
};
