import { NativeBridgeCapabilityError, NativeBridgeVersionError } from '~/native/errors';
import { CLIENT_VERSION, MINIMUM_DISCORD_VERSIONS, VERSION } from '~/core/constants';
import { isOlderThanSupported, discordChannel } from '~/core/discord-support';
import { readBundleInfo } from '~/native/read-bundle-info';
import { currentEnvironment } from '~/core/environment';
import { getRuntimeProperties } from '~/native/native';
import { crashedAddons } from '~/addons/crash-guard';
import { React, ReactNative } from '~/metro/common';
import { getLoader } from '~/native/unbound-native';
import type { Addons } from '~/addons/addons';
import { icons } from '~/icon-packs/manager';
import { plugins } from '~/plugins/manager';
import { getLocale } from '~/i18n/locale';
import { themes } from '~/themes/manager';

import type { AddonCount, DebugInfo, DiscordSupport } from './format-debug-info';

const CRASH_PHASES: Record<string, string> = {
	starting: 'crashed on start',
	running: 'crashed',
	frozen: 'froze',
};

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

function deviceFlags(android: boolean, verified: boolean): string[] {
	const device = globalThis.NativePlatform?.device;
	const rooted = attempt(() => device?.isRooted(), false);
	const flags = [
		android ? (rooted ? 'Rooted' : 'Stock') : rooted ? 'Jailbroken' : 'Jailed',
		verified ? 'verified build' : 'unverified build',
		attempt(() => device?.isVirtualDevice(), false) && (android ? 'emulator' : 'simulator'),
		attempt(() => device?.isSystemApp(), false) && 'system app',
	];

	return flags.filter((flag): flag is string => typeof flag === 'string');
}

function addonCount<I extends object>(manager: Addons<I>): AddonCount {
	const installed = manager.getAddons();

	return {
		enabled: installed.filter((addon) => manager.isEnabled(addon.id)).length,
		installed: installed.length,
	};
}

function selectedAddon<I extends object>(manager: Addons<I>): string {
	return manager.getAddons().find((addon) => manager.isEnabled(addon.id))?.id ?? '';
}

function startFailure(error: Error): string {
	if (error instanceof NativeBridgeVersionError) {
		return `needs bridge API ${error.requiredApi}`;
	}

	if (error instanceof NativeBridgeCapabilityError) {
		return `loader lacks ${error.capability}`;
	}

	return 'failed to start';
}

function disabledAddons(): string[] {
	const crashed = crashedAddons().map(
		(addon) => `${addon.name} (${CRASH_PHASES[addon.phase] ?? addon.phase})`,
	);
	const failed = [...plugins.errors.entries()].map(
		([id, error]) =>
			`${plugins.getAddon(String(id))?.name ?? String(id)} (${startFailure(error)})`,
	);

	return [...new Set([...crashed, ...failed])];
}

function discordSupport(version: string, channel: string, android: boolean): DiscordSupport {
	if (isOlderThanSupported(version, MINIMUM_DISCORD_VERSIONS[android ? 'android' : 'ios'])) {
		return 'unsupported';
	}

	return channel === 'Alpha' ? 'untested' : 'supported';
}

const LEGACY_SIGNATURE = /^Discord's signature$/;

function installDetailsOf(details: string): string {
	return details
		.split(/, | · /)
		.filter((part) => part && !/^(no )?entitlements\b/.test(part))
		.map((part) => part.replace(LEGACY_SIGNATURE, 'Distribution'))
		.join(' · ');
}

/**
 * @description Reads everything `/debug` reports: Unbound, the loader, Discord, React Native, the device and the addons.
 * @returns The details, each already a display string except the addon counts.
 */
export function readDebugInfo(): DebugInfo {
	const platform = globalThis.NativePlatform;
	const environment = currentEnvironment(CLIENT_VERSION);
	const loader = getLoader();
	const bundle = readBundleInfo();
	const { Platform } = ReactNative;
	const android = Platform.OS === 'android';
	const rn = Platform.constants.reactNativeVersion;
	const runtime = getRuntimeProperties();
	const appSource = attempt(() => platform?.app.getAppSource(), '') || 'unknown source';
	const channel = channelOf(environment?.discordVersion ?? 'unknown', appSource);
	const os = android
		? `${Platform.constants.Release} (SDK ${Platform.Version})`
		: (environment?.osVersion ?? String(Platform.Version));

	return {
		client: `v${CLIENT_VERSION}`,
		commit: String(VERSION),
		loader: environment?.loaderVersion ?? 'unknown',
		loaderOrigin: String(loader?.origin ?? 'unknown origin'),
		...channel,
		discordBuild: String(bundle.Build ?? 'unknown'),
		discordSupport: discordSupport(channel.discord, channel.discordChannel, android),
		appSource,
		installDetails: android
			? ''
			: installDetailsOf(attempt(() => platform?.app.getInstallDetails?.(), '')),
		framework: attempt(() => platform?.app.getFramework(), ''),
		jailbreak: attempt(() => platform?.device.getJailbreak?.(), ''),
		react: React.version,
		reactNative: rn ? `${rn.major}.${rn.minor}.${rn.patch}` : 'unknown',
		hermes: String(runtime['OSS Release Version'] ?? 'unknown'),
		bytecode: String(runtime['Bytecode Version'] ?? 'unknown'),
		platform: android ? 'Android' : 'iOS',
		os,
		device: environment?.deviceModel ?? 'unknown device',
		flags: deviceFlags(android, environment?.verifiedBuild ?? false),
		plugins: attempt(() => addonCount(plugins), undefined),
		themes: attempt(() => addonCount(themes), undefined),
		disabledAddons: attempt(disabledAddons, []),
		locale: attempt(getLocale, ''),
		theme: attempt(() => selectedAddon(themes), ''),
		iconPack: attempt(() => selectedAddon(icons), ''),
		launch: loader?.launch,
	};
}

/**
 * @description Reads the app's entitlements as a plist on iOS.
 * @returns The plist, or an empty string on Android or when the loader cannot read them.
 */
export function readEntitlements(): string {
	return attempt(() => globalThis.NativePlatform?.ios?.getEntitlementsAsPlist(), '');
}

export default readDebugInfo;
