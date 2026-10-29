import { findByPropsLazy, findStoreLazy } from '~/api/metro/wrappers';
import { BundleInfo, getRuntimeProperties } from '~/api/native';
import { Messages as MessageActions } from '~/api/metro/api';
import { CLIENT_VERSION, VERSION } from '~/lib/constants';
import { React, ReactNative } from '~/api/metro/common';
import { discordChannel } from '~/lib/discord-support';
import type { BundleInfoType } from '~/api/native';
import { showToast } from '~/api/toasts';
import { Messages } from '~/api/i18n';
import fs from '~/api/fs';

import formatDebugInfo, { type DebugInfo } from './format-debug-info';

type NativeBundleInfo = Partial<BundleInfoType> & {
	getConstants?: () => Partial<BundleInfoType>;
};

type CloudUpload = {
	status: string;
	upload(): Promise<void>;
};

type SendResult = { ok?: boolean; status?: number } | undefined;

const ENTITLEMENTS_PATH = 'Unbound/cache/debug/Entitlements.xml';
const UPLOAD_ORIGIN_FILE = 1;
const UPLOAD_PLATFORM_REACT_NATIVE = 0;

const CloudUploader = findByPropsLazy('CloudUpload');
const SelectedChannelStore = findStoreLazy('SelectedChannel');

// A TurboModule serves its constants through getConstants() instead of as properties.
function readBundleInfo(): Partial<BundleInfoType> {
	const info: NativeBundleInfo = BundleInfo ?? {};

	return info.getConstants?.() ?? info;
}

function attempt<T>(read: () => T | null | undefined, fallback: T): T {
	try {
		return read() ?? fallback;
	} catch {
		return fallback;
	}
}

function channelOf(version: string, appSource: string) {
	const parsed = discordChannel(version, appSource);

	return { discord: parsed.version, discordChannel: parsed.channel };
}

function deviceFlags(android: boolean): string[] {
	const device = globalThis.NativePlatform?.device;
	const rooted = attempt(() => device?.isRooted(), false);
	const flags = [
		android ? (rooted ? 'rooted' : 'stock') : rooted ? 'jailbroken' : 'jailed',
		attempt(() => device?.isVirtualDevice(), false) && (android ? 'emulator' : 'simulator'),
		attempt(() => device?.isSystemApp(), false) && 'system app',
	];

	return flags.filter((flag): flag is string => typeof flag === 'string');
}

/**
 * @description Reads everything `/debug` reports: Unbound, the loader, Discord, React Native and the device.
 * @returns The details, each already a display string.
 */
export function readDebugInfo(): DebugInfo {
	const platform = globalThis.NativePlatform;
	const loader = globalThis.UNBOUND_LOADER;
	const bundle = readBundleInfo();
	const { Platform } = ReactNative;
	const android = Platform.OS === 'android';
	const rn = Platform.constants.reactNativeVersion;
	const runtime = getRuntimeProperties();
	const appSource = attempt(() => platform?.app.getAppSource(), '') || 'unknown source';
	const os = android
		? `${Platform.constants.Release} (SDK ${Platform.Version})`
		: attempt(() => platform?.device.getOSVersionString(), String(Platform.Version));

	return {
		client: `v${CLIENT_VERSION}`,
		commit: String(VERSION),
		loader: String(loader?.version ?? 'unknown'),
		loaderOrigin: String(loader?.origin ?? 'unknown origin'),
		...channelOf(String(bundle.Version ?? 'unknown'), appSource),
		discordBuild: String(bundle.Build ?? 'unknown'),
		appSource,
		framework: attempt(() => platform?.app.getFramework?.(), ''),
		react: React.version,
		reactNative: rn ? `${rn.major}.${rn.minor}.${rn.patch}` : 'unknown',
		hermes: String(runtime['OSS Release Version'] ?? 'unknown'),
		bytecode: String(runtime['Bytecode Version'] ?? 'unknown'),
		platform: android ? 'Android' : 'iOS',
		os,
		device: attempt(() => platform?.device.getDeviceModel(), 'unknown device'),
		flags: deviceFlags(android),
	};
}

/**
 * @description Reads the app's entitlements as a plist on iOS.
 * @returns The plist, or an empty string on Android or when the loader cannot read them.
 */
export function readEntitlements(): string {
	return attempt(() => globalThis.NativePlatform?.ios?.getEntitlementsAsPlist(), '');
}

function warnTextOnly() {
	showToast({
		title: Messages.UNBOUND_DEBUG_INFO,
		content: Messages.UNBOUND_DEBUG_ENTITLEMENTS_FAILED,
		icon: 'WarningIcon',
	});
}

async function uploadEntitlements(channelId: string): Promise<CloudUpload | undefined> {
	const plist = readEntitlements();

	if (!plist || !CloudUploader.CloudUpload) {
		return undefined;
	}

	await fs.write(ENTITLEMENTS_PATH, plist);

	const uri = `file://${fs.Documents}/${ENTITLEMENTS_PATH}`;
	const upload: CloudUpload = new CloudUploader.CloudUpload(
		{
			id: `unbound-debug-${Date.now()}`,
			origin: UPLOAD_ORIGIN_FILE,
			uri,
			originalUri: uri,
			mimeType: 'application/xml',
			filename: 'Entitlements.xml',
			platform: UPLOAD_PLATFORM_REACT_NATIVE,
			createdUsingInAppCamera: false,
			progress: 0,
		},
		channelId,
		0,
		true,
	);

	await upload.upload();

	return upload.status === 'COMPLETED' ? upload : undefined;
}

/**
 * @description Sends the debug report to the channel, with the app's entitlements attached as `Entitlements.xml` on iOS.
 * @param channelId The channel the command ran in, or the open channel when it is not known.
 * @returns The report for Discord to send when there is nothing to attach, otherwise nothing once it is sent.
 */
export async function sendDebugReport(channelId?: string): Promise<string | undefined> {
	const report = formatDebugInfo(readDebugInfo());
	const target: string | undefined =
		channelId ?? attempt(() => SelectedChannelStore.getChannelId(), undefined);
	const wantsEntitlements = Boolean(readEntitlements());
	const entitlements = target
		? await uploadEntitlements(target).catch(() => undefined)
		: undefined;

	if (!target || !entitlements) {
		if (wantsEntitlements) {
			warnTextOnly();
		}

		return report;
	}

	const result: SendResult = await MessageActions._sendMessage(
		target,
		{ content: report, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
		{ attachmentsToUpload: [entitlements] },
	);

	if (result?.ok === false) {
		warnTextOnly();

		return report;
	}

	return undefined;
}

export default { readDebugInfo, readEntitlements, sendDebugReport };
