import { parse, type StaticDecode, type TSchema } from '@unbound-app/contracts/schema';

import { connectBridge } from './device-bridge';
import {
	run,
	screenshot,
	screenshotTarget,
	type CommandRunner,
	type ScreenshotTarget,
} from './device-io';
import type { MatrixDevice } from './matrix-config';

/** One device the matrix drives: Discord's runtime through `evaluate`, the host commands around it, and time. */
export type Device = {
	name: string;
	target: ScreenshotTarget;
	/** Evaluates a script in Discord; rejects with `DeviceDropped` when the device went away. */
	evaluate(code: string): Promise<string>;
	/** Resolves `true` once Discord's debugger is connected again, or `false` after `timeoutMs`. */
	waitForDevice(timeoutMs: number): Promise<boolean>;
	run: CommandRunner;
	screenshot(file: string): Promise<boolean>;
	sleep(ms: number): Promise<void>;
	close(): void;
};

/**
 * @description Opens a configured device: its debugger bridge, and `adb` or `jb-p1lot` for screenshots and swipes.
 * @param device The device from the matrix config.
 * @returns The device, open until {@link Device.close}.
 */
export function openDevice(device: MatrixDevice): Device {
	const target = screenshotTarget({ udid: device.udid, serial: device.serial });
	const bridge = connectBridge(device.port);

	return {
		name: device.name,
		target,
		evaluate: bridge.evaluate,
		waitForDevice: bridge.waitForDevice,
		run,
		screenshot: (file) => screenshot(target, file),
		sleep: (ms) => Bun.sleep(ms),
		close: bridge.close,
	};
}

/**
 * @description Evaluates a script whose result is JSON and parses that result with a schema.
 * @template T The parsed result.
 * @param device The device.
 * @param code A script that returns a JSON string.
 * @param schema The shape the script's JSON must have.
 * @returns The parsed result.
 */
export async function evaluateJson<T extends TSchema>(
	device: Pick<Device, 'evaluate'>,
	code: string,
	schema: T,
): Promise<StaticDecode<T>> {
	return parse(schema, JSON.parse(await device.evaluate(code)));
}

export default { openDevice, evaluateJson };
