import { IOS_TIMEOUTS, pickDevice, pilotShell, resolvePilot, type PilotTarget } from '~/lib/pilot';
import { DISCORD_BUNDLE_ID, IOS_STAGING_DIRECTORY, IOS_UIOPEN } from '~/lib/device-paths';
import type { DeviceTargetOptions, IOSTarget } from '~/lib/device-target';
import { runCommand } from '~/lib/run-command';

const STOP_DISCORD = 'killall -9 Discord 2>/dev/null; sleep 1';

/**
 * @description Opens a jailbroken iPhone through jb-p1lot, picking the one whose bridge runs when no
 * UDID is given.
 * @param options The device UDID, and the runner and jb-p1lot binary to use.
 * @returns The device, or why no single device could be picked.
 */
export async function openIOSTarget(
	options: Pick<DeviceTargetOptions, 'udid' | 'run' | 'pilot'> = {},
): Promise<IOSTarget | { error: string }> {
	const { run = runCommand, pilot = resolvePilot() } = options;
	const picked =
		options.udid ?? (await pickDevice((args, timeoutMs) => run(pilot, args, timeoutMs)));

	if (typeof picked !== 'string') {
		return picked;
	}

	const udid = picked;

	const device: PilotTarget = { udid, pilot, run };

	function transfer(direction: string, source: string, destination: string, timeoutMs: number) {
		return run(
			pilot,
			[
				'file_transfer',
				'--device',
				udid,
				'--direction',
				direction,
				'--source',
				source,
				'--destination',
				destination,
			],
			timeoutMs,
		);
	}

	// Bounded on the device too, so jb-p1lot reports a stuck script itself.
	const shell = (script: string, timeoutMs = IOS_TIMEOUTS.shell) =>
		pilotShell(device, script, { timeoutMs, onDevice: true });

	return {
		platform: 'ios',
		id: udid,
		udid,
		pilot: device,
		staging: IOS_STAGING_DIRECTORY,
		stopDiscordScript: STOP_DISCORD,
		shell,
		push: (local, remote, timeoutMs = IOS_TIMEOUTS.transfer) =>
			transfer('host_to_device', local, remote, timeoutMs),
		pull: (remote, local, timeoutMs = IOS_TIMEOUTS.transfer) =>
			transfer('device_to_host', remote, local, timeoutMs),
		async restartDiscord() {
			// Wakes SpringBoard so the launch is not refused behind the lock screen.
			await run(
				pilot,
				['ui_action', '--device', udid, '--action', 'button', '--button', 'unlock'],
				IOS_TIMEOUTS.restart,
			);

			return shell(
				`${STOP_DISCORD}; ${IOS_UIOPEN} --bundleid ${DISCORD_BUNDLE_ID}`,
				IOS_TIMEOUTS.restart,
			);
		},
	};
}

export default openIOSTarget;
