import type { PushedManifest } from '@unbound-app/types';

import {
	REACT_DEVTOOLS_SHUTDOWN_EVENT,
	REACT_DEVTOOLS_STATUS_EVENT,
	isReactDevtoolsFrame,
	type ReactDevtoolsFrame,
} from './react-devtools';
import {
	isViewFrameMessage,
	type ViewHighlight,
	type ViewsRequest,
	type ViewsResult,
} from './views';

export type { ViewFrame, ViewHighlight, ViewNode, ViewsRequest, ViewsResult } from './views';
export type { ReactDevtoolsFrame, ReactDevtoolsStatus } from './react-devtools';
export { REACT_DEVTOOLS_SHUTDOWN_EVENT, REACT_DEVTOOLS_STATUS_EVENT };

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

/**
 * Why a request failed before the device answered it, so callers branch on a code instead of the error text.
 */
export type RequestFailureCode =
	/** The bridge has no device. */
	| 'no-device'
	/** The device dropped mid-request. */
	| 'device-disconnected'
	| 'timeout'
	/** The controller has no socket to the bridge. */
	| 'bridge-unreachable'
	/** The controller closed. */
	| 'shut-down';

/** The outcome of an {@link EvalRequest}, sent device → bridge → the one waiting controller. */
export type EvalResult = {
	type: 'eval-result';
	/** The `id` of the {@link EvalRequest} this answers. */
	id: string;
	/**
	 * Console output captured during this eval, so callers see its side effects too. Populated by
	 * the controller that owns the request, not sent by the device.
	 */
	logs?: LogMessage[];
} & (
	| {
			ok: true;
			/** The inspected return value. */
			value: string;
	  }
	| {
			ok: false;
			/** The inspected error. */
			error: string;
			/** Set when the bridge or controller failed the eval; absent when the code itself threw on the device. */
			code?: RequestFailureCode;
	  }
);

/** The addon managers a push can reload into. */
export type PushedAddonKind = 'plugin' | 'theme';

/**
 * A request to hot-reload a plugin or theme on the device, sent controller → bridge → device. Carries
 * the freshly built bundle and manifest so the device swaps them in without a re-fetch.
 */
export type PluginPushRequest = {
	type: 'plugin-push';
	/** Correlation id echoed back on the matching {@link PluginPushResult}. */
	id: string;
	addonId: string;
	/** Which manager reloads the addon; a plugin when omitted, as pushes from older CLIs are. */
	kind?: PushedAddonKind;
	bundle: string;
	/** The manifest as authored; the device validates it before swapping anything in. */
	manifest: PushedManifest;
	/** The bundle compiled to Hermes bytecode, base64-encoded, by bytecode version; its digests are in `manifest.bytecode`. */
	bytecode?: Record<string, string>;
	/** Each extra file the manifest lists beside the bundle, such as an image, base64-encoded, by path. */
	files?: Record<string, string>;
};

/** The outcome of a {@link PluginPushRequest}, sent device → bridge → the one waiting controller. */
export type PluginPushResult = {
	type: 'plugin-push-result';
	/** The `id` of the {@link PluginPushRequest} this answers. */
	id: string;
} & (
	| { ok: true }
	| {
			ok: false;
			/** The reload failure, inspected. */
			error: string;
			/** Set when the bridge or controller failed the push; absent when the device's reload failed. */
			code?: RequestFailureCode;
	  }
);

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
export type DeviceStatus = { type: 'device-status' } & (
	| { connected: false }
	| {
			connected: true;
			/** Present once the connected device has said hello. */
			device?: DeviceInfo;
	  }
);

/** Every framed message on the wire. */
export type BridgeMessage =
	| EvalRequest
	| EvalResult
	| PluginPushRequest
	| PluginPushResult
	| LogMessage
	| DeviceHello
	| DeviceStatus
	| ViewsRequest
	| ViewsResult
	| ViewHighlight
	| ReactDevtoolsFrame;

/** The default port the bridge listens on and controllers dial. */
export const DEFAULT_BRIDGE_PORT = 9090;

export const DEFAULT_EVAL_TIMEOUT_MS = 10_000;

export const MAX_EVAL_TIMEOUT_MS = 86_400_000;

/** How long the bridge waits for the device to reload a pushed addon. */
export const PLUGIN_PUSH_TIMEOUT_MS = 60_000;

/**
 * How much longer a controller waits than the bridge, so the bridge's own timeout reply always
 * arrives before the controller gives up on its own.
 */
export const BRIDGE_REPLY_GRACE_MS = 5_000;

/**
 * @description Picks how long an eval may run: the requested timeout when it is a positive number of
 * milliseconds, capped at {@link MAX_EVAL_TIMEOUT_MS}, otherwise {@link DEFAULT_EVAL_TIMEOUT_MS}.
 * @param requested The timeout the controller asked for, if any.
 * @returns The timeout to apply, in milliseconds.
 */
export function resolveEvalTimeout(requested: number | undefined): number {
	return typeof requested === 'number' && requested > 0
		? Math.min(requested, MAX_EVAL_TIMEOUT_MS)
		: DEFAULT_EVAL_TIMEOUT_MS;
}

/** The query marker a controller appends to its URL so the bridge routes it as a controller, not a device. */
export const CONTROLLER_ENDPOINT_MARKER = 'mcp';

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

	return hasRequiredFields(value) ? value : void 0;
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
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				(frame.ok === true
					? 'value' in frame && typeof frame.value === 'string'
					: frame.ok === false && hasError(frame))
			);
		case 'plugin-push-result':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				(frame.ok === true || (frame.ok === false && hasError(frame)))
			);
		case 'plugin-push':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'addonId' in frame &&
				typeof frame.addonId === 'string' &&
				(!('kind' in frame) ||
					frame.kind === void 0 ||
					frame.kind === 'plugin' ||
					frame.kind === 'theme') &&
				'bundle' in frame &&
				typeof frame.bundle === 'string' &&
				'manifest' in frame &&
				typeof frame.manifest === 'object' &&
				frame.manifest !== null &&
				(!('bytecode' in frame) ||
					frame.bytecode === void 0 ||
					isStringRecord(frame.bytecode)) &&
				(!('files' in frame) || frame.files === void 0 || isStringRecord(frame.files))
			);
		case 'hello':
			return 'device' in frame && isDeviceInfo(frame.device);
		case 'device-status':
			return (
				'connected' in frame &&
				(frame.connected === false ||
					(frame.connected === true &&
						(!('device' in frame) ||
							frame.device === undefined ||
							isDeviceInfo(frame.device))))
			);
		case 'views-request':
		case 'views-result':
		case 'view-highlight':
			return isViewFrameMessage(frame);
		case 'react-devtools':
			return isReactDevtoolsFrame(frame);
		default:
			return false;
	}
}

type ErrorFrame = { error: string };

function hasError(frame: unknown): frame is ErrorFrame {
	return (
		typeof frame === 'object' &&
		frame !== null &&
		'error' in frame &&
		typeof frame.error === 'string'
	);
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
	PLUGIN_PUSH_TIMEOUT_MS,
	BRIDGE_REPLY_GRACE_MS,
	CONTROLLER_ENDPOINT_MARKER,
	REACT_DEVTOOLS_SHUTDOWN_EVENT,
	REACT_DEVTOOLS_STATUS_EVENT,
	resolveEvalTimeout,
	parseMessage,
	serializeMessage,
};
