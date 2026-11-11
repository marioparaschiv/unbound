import { ANDROID_STAGING_DIRECTORY, DISCORD_PACKAGE } from '~/lib/device-paths';
import type { AndroidTarget, DeviceTargetOptions } from '~/lib/device-target';
import { formatDuration, runCommand } from '~/lib/run-command';
import type { CommandResult } from '~/lib/run-command';
import type { ShellResult } from '~/lib/pilot';

export const ANDROID_TIMEOUTS = {
	state: 15_000,
	push: 120_000,
	shell: 60_000,
	restart: 30_000,
};

const STOP_DISCORD = `am force-stop ${DISCORD_PACKAGE}`;
const START_DISCORD = `monkey -p ${DISCORD_PACKAGE} -c android.intent.category.LAUNCHER 1`;

/**
 * @description Opens an Android device over adb, failing when it does not answer. Every adb call is
 * bounded by a timeout, so an offline device or an unanswered root prompt fails instead of hanging.
 * @param options The device serial, and the runner and adb binary to use.
 * @returns The device, or why adb cannot reach it.
 */
export async function openAndroidTarget(
	options: Pick<DeviceTargetOptions, 'serial' | 'run' | 'adb'> = {},
): Promise<AndroidTarget | { error: string }> {
	const { serial, run = runCommand, adb: program = 'adb' } = options;
	const argv = (args: string[]) => [...(serial ? ['-s', serial] : []), ...args];
	const adb = (args: string[], timeoutMs: number) => run(program, argv(args), timeoutMs);

	const state = await adb(['get-state'], ANDROID_TIMEOUTS.state);

	if (!state.ok) {
		return { error: `No Android device is ready over adb. ${state.error}` };
	}

	// Asked once, on the first root script, since only those need to know.
	let identity: Promise<CommandResult> | undefined;

	async function shell(script: string, timeoutMs = ANDROID_TIMEOUTS.shell): Promise<ShellResult> {
		identity ??= adb(['shell', 'id -u'], ANDROID_TIMEOUTS.shell);

		const user = await identity;

		if (!user.ok) {
			return { ok: false, error: user.error };
		}

		const asRoot = user.stdout.trim() === '0';
		const quoted = script.replaceAll("'", "'\\''");
		const result = await adb(['shell', asRoot ? script : `su -c '${quoted}'`], timeoutMs);

		if (result.ok) {
			return { ok: true, output: result.stdout };
		}

		return {
			ok: false,
			error: asRoot
				? result.error
				: `${result.error} Root is needed to reach Discord's data; grant the shell root in your root manager if it asked, then retry within ${formatDuration(timeoutMs)}.`,
		};
	}

	return {
		platform: 'android',
		id: serial ?? 'the attached device',
		serial,
		staging: ANDROID_STAGING_DIRECTORY,
		stopDiscordScript: STOP_DISCORD,
		adb: { program, argv, run: adb },
		shell,
		push: (local, remote, timeoutMs = ANDROID_TIMEOUTS.push) =>
			adb(['push', local, remote], timeoutMs),
		pull: (remote, local, timeoutMs = ANDROID_TIMEOUTS.push) =>
			adb(['pull', remote, local], timeoutMs),
		async restartDiscord() {
			const result = await adb(
				['shell', `${STOP_DISCORD} && ${START_DISCORD}`],
				ANDROID_TIMEOUTS.restart,
			);

			return result.ok ? { ok: true, output: result.stdout } : result;
		},
	};
}

export default openAndroidTarget;
