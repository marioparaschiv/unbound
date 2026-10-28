import type { AddonManifest } from '@unbound-app/types';

/**
 * The wire protocol shared by the bridge, the device and controllers: every frame is a JSON-encoded
 * {@link BridgeMessage}. Dependency-free at runtime so the React Native client can bundle it.
 */

/** A request to evaluate code on the device, sent controller → bridge → device. */
export type EvalRequest = {
	type: 'eval';
	/** Correlation id echoed back on the matching {@link EvalResult}. */
	id: string;
	code: string;
	timeout?: number;
};

/** The outcome of an {@link EvalRequest}, sent device → bridge → the one waiting controller. */
export type EvalResult = {
	type: 'eval-result';
	/** The `id` of the {@link EvalRequest} this answers. */
	id: string;
	ok: boolean;
	/** Present when `ok`; the inspected return value. */
	value?: string;
	/** Present when `!ok`; the inspected error. */
	error?: string;
	/**
	 * Console output captured during this eval, so callers see its side effects too. Populated by
	 * the controller that owns the request, not sent by the device.
	 */
	logs?: LogMessage[];
};

/**
 * A request to hot-reload a plugin on the device, sent controller → bridge → device. Carries the
 * freshly built bundle and manifest so the device swaps them in without a re-fetch.
 */
export type PluginPushRequest = {
	type: 'plugin-push';
	/** Correlation id echoed back on the matching {@link PluginPushResult}. */
	id: string;
	addonId: string;
	bundle: string;
	manifest: AddonManifest;
	/** The bundle compiled to Hermes bytecode, base64-encoded, by bytecode version; its digests are in `manifest.bytecode`. */
	bytecode?: Record<string, string>;
};

/** The outcome of a {@link PluginPushRequest}, sent device → bridge → the one waiting controller. */
export type PluginPushResult = {
	type: 'plugin-push-result';
	/** The `id` of the {@link PluginPushRequest} this answers. */
	id: string;
	ok: boolean;
	/** Present when `!ok`; the reload failure, inspected. */
	error?: string;
};

/** A `console.*` / `nativeLoggingHook` line, streamed device → bridge → all controllers. */
export type LogMessage = {
	type: 'log';
	/** 1 = log/gray, 2 = warn/yellow, 3 = error/red. */
	level: 1 | 2 | 3;
	message: string;
};

/** What a device reports about itself when it connects. */
export type DeviceInfo = {
	platform: string;
	discordVersion: string;
	loaderVersion: string;
	clientVersion: string;
};

/** Device → bridge, once its socket opens, so the bridge can say which device is attached. */
export type DeviceHello = {
	type: 'hello';
	device: DeviceInfo;
};

/** Bridge → controller, once on attach and whenever the device connects, drops or says hello. */
export type DeviceStatus = {
	type: 'device-status';
	connected: boolean;
	/** Present once the connected device has said hello. */
	device?: DeviceInfo;
};

/** Every framed message on the wire. */
export type BridgeMessage =
	| EvalRequest
	| EvalResult
	| PluginPushRequest
	| PluginPushResult
	| LogMessage
	| DeviceHello
	| DeviceStatus;

/** The default port the bridge listens on and controllers dial. */
export const DEFAULT_BRIDGE_PORT = 9090;

export const DEFAULT_EVAL_TIMEOUT_MS = 10_000;

export const MAX_EVAL_TIMEOUT_MS = 86_400_000;

/** The query marker a controller appends to its URL so the bridge routes it as a controller, not a device. */
export const CONTROLLER_ENDPOINT_MARKER = 'mcp';

const MESSAGE_TYPES: ReadonlySet<string> = new Set<BridgeMessage['type']>([
	'eval',
	'eval-result',
	'plugin-push',
	'plugin-push-result',
	'log',
	'hello',
	'device-status',
]);

/**
 * @description Safely parses a raw wire frame into a {@link BridgeMessage}, guarding against invalid
 * JSON and unknown shapes so both ends can trust what they route.
 * @param raw The JSON string received off the socket.
 * @returns The parsed message, or `undefined` if it isn't a recognised frame.
 */
export function parseMessage(raw: string): BridgeMessage | undefined {
	let value: unknown;

	try {
		value = JSON.parse(raw);
	} catch {
		return void 0;
	}

	return isBridgeMessage(value) ? value : void 0;
}

function hasRequiredFields(frame: unknown): frame is BridgeMessage {
	if (typeof frame !== 'object' || frame === null || !('type' in frame)) {
		return false;
	}

	switch (frame.type) {
		case 'log':
			return (
				'message' in frame &&
				typeof frame.message === 'string' &&
				'level' in frame &&
				(frame.level === 1 || frame.level === 2 || frame.level === 3)
			);
		case 'eval':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'code' in frame &&
				typeof frame.code === 'string'
			);
		case 'eval-result':
		case 'plugin-push-result':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				typeof frame.ok === 'boolean'
			);
		case 'plugin-push':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'addonId' in frame &&
				typeof frame.addonId === 'string' &&
				'bundle' in frame &&
				typeof frame.bundle === 'string' &&
				'manifest' in frame &&
				typeof frame.manifest === 'object' &&
				frame.manifest !== null &&
				(!('bytecode' in frame) ||
					frame.bytecode === void 0 ||
					isStringRecord(frame.bytecode))
			);
		case 'hello':
			return 'device' in frame && isDeviceInfo(frame.device);
		case 'device-status':
			return (
				'connected' in frame &&
				typeof frame.connected === 'boolean' &&
				(!('device' in frame) || frame.device === undefined || isDeviceInfo(frame.device))
			);
		default:
			return false;
	}
}

function isDeviceInfo(value: unknown): value is DeviceInfo {
	return (
		typeof value === 'object' &&
		value !== null &&
		'platform' in value &&
		typeof value.platform === 'string' &&
		'discordVersion' in value &&
		typeof value.discordVersion === 'string' &&
		'loaderVersion' in value &&
		typeof value.loaderVersion === 'string' &&
		'clientVersion' in value &&
		typeof value.clientVersion === 'string'
	);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((entry) => typeof entry === 'string')
	);
}

function isBridgeMessage(value: unknown): value is BridgeMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string' &&
		MESSAGE_TYPES.has(value.type) &&
		hasRequiredFields(value)
	);
}

/**
 * @description Serialises a {@link BridgeMessage} into its wire form. Inverse of {@link parseMessage}.
 * @param message The message to frame.
 * @returns The JSON string to send over the socket.
 */
export function serializeMessage(message: BridgeMessage): string {
	return JSON.stringify(message);
}
export default {
	DEFAULT_BRIDGE_PORT,
	DEFAULT_EVAL_TIMEOUT_MS,
	MAX_EVAL_TIMEOUT_MS,
	CONTROLLER_ENDPOINT_MARKER,
	parseMessage,
	serializeMessage,
};
