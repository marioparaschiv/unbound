import type { CommandErrorCode } from '@unbound-app/debugger-protocol/registry';

import type { CommandResult, CommandRunner } from '~/lib/run-command';
import type { PilotTarget, ShellResult } from '~/lib/pilot';
import { openAndroidTarget } from '~/lib/android-target';
import { openIOSTarget } from '~/lib/ios-target';

/**
 * One device Discord runs on, reached over adb (Android) or jb-p1lot (iPhone). Opened once from the
 * CLI flags; every device feature goes through it instead of building its own adb or pilot calls.
 */

export type DevicePlatform = 'android' | 'ios';

/** Why no device could be opened: `invalid-input` for contradicting flags, else `no-device`. */
export type DeviceTargetError = { error: string; code: CommandErrorCode };

/** The flags device commands take to pick a device. */
export type DeviceFlags = { serial?: string; ios?: boolean; udid?: string };

export type DeviceTargetOptions = DeviceFlags & {
	run?: CommandRunner;
	/** The jb-p1lot binary; found on the PATH when left out. */
	pilot?: string;
	/** The adb binary; `adb` on the PATH when left out. */
	adb?: string;
};

type TargetBase = {
	/** The device's adb serial or UDID, or a description when the serial is unknown. */
	id: string;
	/** A folder on the device files can be staged in before they are moved into Discord's data. */
	staging: string;
	/** A script that stops Discord, for root scripts that must change its data while it is closed. */
	stopDiscordScript: string;
	/**
	 * @description Runs a script on the device as root.
	 * @param script The script.
	 * @param timeoutMs How long to wait; a per-platform default when left out.
	 */
	shell(script: string, timeoutMs?: number): Promise<ShellResult>;
	/** @description Copies a file from this computer to the device. */
	push(local: string, remote: string, timeoutMs?: number): Promise<CommandResult>;
	/** @description Copies a file from the device to this computer. */
	pull(remote: string, local: string, timeoutMs?: number): Promise<CommandResult>;
	restartDiscord(): Promise<ShellResult>;
};

/** How to call adb for this device, for features only Android has, such as logcat. */
export type AdbCommand = {
	program: string;
	/** Prefixes adb arguments with the device's serial, when one was given. */
	argv: (args: string[]) => string[];
	run: (args: string[], timeoutMs: number) => Promise<CommandResult>;
};

export type AndroidTarget = TargetBase & {
	platform: 'android';
	/** The serial the device was picked by, if any. */
	serial?: string;
	adb: AdbCommand;
};

export type IOSTarget = TargetBase & {
	platform: 'ios';
	udid: string;
	/** The device, jb-p1lot binary and runner, for features only the iPhone has. */
	pilot: PilotTarget;
};

export type DeviceTarget = AndroidTarget | IOSTarget;

/**
 * @description Reads which platform the device flags pick.
 * @param flags The command's device flags.
 * @returns The platform, or why the flags contradict each other.
 */
export function devicePlatform(flags: DeviceFlags): DevicePlatform | DeviceTargetError {
	const onIOS = Boolean(flags.ios) || flags.udid !== void 0;

	if (onIOS && flags.serial !== void 0) {
		return {
			error: 'Pass either --serial for an Android device or --ios/--udid for an iPhone, not both.',
			code: 'invalid-input',
		};
	}

	return onIOS ? 'ios' : 'android';
}

/**
 * @description Opens the device the flags pick: checks an Android device answers over adb, or picks
 * the one iPhone whose jb-p1lot bridge runs when no UDID is given.
 * @param options The device flags, and the runner and binaries to use.
 * @returns The device, or why it cannot be reached.
 */
export async function openDeviceTarget(
	options: DeviceTargetOptions,
): Promise<DeviceTarget | DeviceTargetError> {
	const platform = devicePlatform(options);

	if (typeof platform !== 'string') {
		return platform;
	}

	const target = await (platform === 'ios' ? openIOSTarget(options) : openAndroidTarget(options));

	return 'error' in target ? { error: target.error, code: 'no-device' } : target;
}

export default { devicePlatform, openDeviceTarget };
