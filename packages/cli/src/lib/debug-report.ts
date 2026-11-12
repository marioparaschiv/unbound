// `readDebugReport` runs on the device through `toDeviceCode`, so it may not reach outside its own body.
import type { DevicePrelude } from '~/lib/device-prelude';

/**
 * @description Reads the report `/debug` sends, through the hook the client's developer build exposes.
 * @param _device The device prelude.
 * @returns The report as JSON. Throws when the client predates the hook.
 */
export async function readDebugReport(_device: DevicePrelude): Promise<string> {
	const read: unknown = Reflect.get(globalThis, '__UNBOUND_DEBUG_REPORT__');

	if (typeof read !== 'function') {
		throw new Error('This client predates `ubd debug report`; update it and reload.');
	}

	return JSON.stringify(await read());
}

export default readDebugReport;
