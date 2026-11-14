import type { NativeDeviceState, UnboundLaunchReport } from '@unbound-app/types';

import { NativeBridgeCapabilityError, NativeBridgeVersionError } from '~/native/errors';
import { DeviceInfo, getNativeResources, getRuntimeProperties } from '~/native/native';
import { CLIENT_VERSION, MINIMUM_DISCORD_VERSIONS, VERSION } from '~/core/constants';
import { isOlderThanSupported, discordChannel } from '~/core/discord-support';
import missingExtensions from '~/diagnostics/missing-extensions';
import { readBundleInfo } from '~/native/read-bundle-info';
import { currentEnvironment } from '~/core/environment';
import { crashedAddons } from '~/addons/crash-guard';
import { React, ReactNative } from '~/metro/common';
import { getLoader } from '~/native/unbound-native';
import { getHeapUsage } from '~/native/runtime';
import type { Addons } from '~/addons/addons';
import { icons } from '~/icon-packs/manager';
import { plugins } from '~/plugins/manager';
import UpdatesStore from '~/updates/state';
import { getLocale } from '~/i18n/locale';
import { themes } from '~/themes/manager';
import { patches } from '~/patcher/api';

import type { AddonCount, DebugInfo, DiscordSupport } from './format-debug-info';

import { privateDnsName, resolverName } from './dns-provider';
import { readClockSkew, utcOffset } from './clock';
import { readExperiments } from './experiments';
import { readAppSession } from './app-session';
import { recentErrors } from './recent-errors';
import { pushStateOf } from './push-state';

const MAX_PATCH_CALLERS = 8;
const MAX_LISTED_PLUGINS = 60;

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

function launchOf(launch?: UnboundLaunchReport): DebugInfo['launch'] {
	if (!launch) {
		return undefined;
	}

	const {
		bundle,
		earlyCloses,
		recovery,
		previousExit,
		lastCrash,
		firstRenderMs,
		crashes,
		source,
		pullRequest,
		lastCheck,
		settings,
		system,
	} = launch;

	return {
		bundle,
		earlyCloses,
		recovery,
		previousExit,
		lastCrash,
		firstRenderMs,
		crashes,
		source,
		pullRequest,
		lastCheck,
		settings,
		system,
	};
}

function enabledPlugins(): string[] {
	return plugins
		.getAddons()
		.filter((addon) => plugins.isEnabled(addon.id))
		.map((addon) => `${addon.id}@${addon.version}`)
		.slice(0, MAX_LISTED_PLUGINS);
}

function displayOf(): DebugInfo['display'] {
	const { Dimensions, PixelRatio } = ReactNative;
	const { width, height } = Dimensions.get('window');

	return {
		width: Math.round(width),
		height: Math.round(height),
		scale: PixelRatio.get(),
		fontScale: Math.round(PixelRatio.getFontScale() * 100) / 100,
		tablet: DeviceInfo?.isTablet,
	};
}

/**
 * @description Reads the accessibility settings React Native only answers asynchronously, for `/debug`.
 * @returns Whether Reduce Motion and Bold Text are on; a setting the platform lacks is left out.
 */
export async function readAccessibility(): Promise<
	Pick<NonNullable<DebugInfo['display']>, 'reduceMotion' | 'boldText'>
> {
	const { AccessibilityInfo, Platform } = ReactNative;
	const [reduceMotion, boldText] = await Promise.all([
		AccessibilityInfo.isReduceMotionEnabled().catch(() => undefined),
		Platform.OS === 'ios'
			? AccessibilityInfo.isBoldTextEnabled().catch(() => undefined)
			: undefined,
	]);

	return { reduceMotion, boldText };
}

function storageOf(state?: NativeDeviceState): DebugInfo['storage'] {
	if (state?.freeMB === undefined && state?.unboundMB === undefined) {
		return undefined;
	}

	return { freeMB: state.freeMB, unboundMB: state.unboundMB };
}

function patchCounts(): DebugInfo['patches'] {
	const counts = new Map<string, number>();

	for (const patched of patches) {
		for (const list of Object.values(patched.patches)) {
			for (const patch of list) {
				const caller = patch.caller ?? 'unknown';

				counts.set(caller, (counts.get(caller) ?? 0) + 1);
			}
		}
	}

	return [...counts.entries()]
		.map(([caller, count]) => ({ caller, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_PATCH_CALLERS);
}

function nativeCounts(): DebugInfo['native'] {
	const resources = getNativeResources();

	return (
		resources && {
			hooks: resources.hooks,
			surfaces: resources.surfaces,
			handles: resources.handles,
		}
	);
}

function memoryOf(state?: NativeDeviceState): DebugInfo['memory'] {
	if (!state) {
		return undefined;
	}

	const { availableMB, lowMemory, memoryWarnings, thermal } = state;

	return { availableMB, lowMemory, memoryWarnings, thermal };
}

function powerOf(state?: NativeDeviceState): DebugInfo['power'] {
	const power = state?.power;

	if (typeof power?.lowPower !== 'boolean') {
		return undefined;
	}

	return { lowPower: power.lowPower, battery: power.battery, charging: power.charging };
}

function dnsOf(state?: NativeDeviceState): DebugInfo['dns'] {
	const dns = state?.dns;

	if (!dns) {
		return undefined;
	}

	const resolver = resolverName(dns.servers ?? []);
	const privateDns = privateDnsName(dns.privateDns, dns.privateDnsHost);

	return resolver || privateDns ? { resolver, privateDns } : undefined;
}

function pushOf(state: NativeDeviceState | undefined, android: boolean): DebugInfo['push'] {
	const entitlements = android
		? undefined
		: attempt(() => globalThis.NativePlatform?.ios?.getEntitlements(), undefined);

	return pushStateOf(state?.push, entitlements);
}

const MAX_ADDON_UPDATES = 64;

function addonUpdates(): string[] | undefined {
	const { state } = UpdatesStore.getState();

	if (state.status !== 'ready' || !state.updates.length) {
		return undefined;
	}

	return state.updates
		.slice(0, MAX_ADDON_UPDATES)
		.map(({ name, from, update }) => `${name} ${from} → ${update.version}`.slice(0, 128));
}

const MAX_INJECTED = 32;
const EDGE_BLANKS =
	/^[\s\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]+|[\s\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]+$/gu;

function injectedOf(state?: NativeDeviceState): string[] | undefined {
	const names = state?.injected
		?.filter((name) => typeof name === 'string')
		.map((name) => name.replace(EDGE_BLANKS, ''))
		.filter((name) => name.length > 0);

	return names?.length
		? names.slice(0, MAX_INJECTED).map((name) => name.slice(0, 96))
		: undefined;
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
	const state = attempt(() => platform?.device.getState?.(), undefined);
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
		commit: loader?.launch?.revision || String(VERSION),
		loader: environment?.loaderVersion ?? 'unknown',
		loaderOrigin: String(loader?.origin ?? 'unknown origin'),
		...channel,
		discordBuild: String(bundle.Build ?? 'unknown'),
		discordSupport: discordSupport(channel.discord, channel.discordChannel, android),
		appSource,
		installDetails: android
			? ''
			: installDetailsOf(attempt(() => platform?.app.getInstallDetails?.(), '')),
		environment: attempt(() => platform?.app.getEnvironment?.(), undefined),
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
		launch: launchOf(loader?.launch),
		bundleChannel: loader?.launch?.channel,
		memory: attempt(() => memoryOf(state), undefined),
		network: attempt(() => state?.network, undefined),
		power: attempt(() => powerOf(state), undefined),
		clock: attempt(() => ({ utcOffset: utcOffset() }), undefined),
		dns: attempt(() => dnsOf(state), undefined),
		push: attempt(() => pushOf(state, android), undefined),
		injected: attempt(() => injectedOf(state), undefined),
		missingExtensions: android
			? undefined
			: attempt(() => missingExtensions(appSource), undefined),
		storage: attempt(() => storageOf(state), undefined),
		errors: recentErrors(),
		patches: attempt(patchCounts, undefined),
		native: attempt(nativeCounts, undefined),
		enabledPlugins: attempt(enabledPlugins, undefined),
		addonUpdates: attempt(addonUpdates, undefined),
		experiments: attempt(readExperiments, undefined),
		display: attempt(displayOf, undefined),
		session: readAppSession(),
		heap: attempt(getHeapUsage, undefined),
	};
}

/**
 * @description Reads everything `/debug` reports, including the accessibility settings React Native only answers asynchronously.
 * @returns The full report the card endpoint takes.
 */
export async function readDebugReport(): Promise<DebugInfo> {
	const info = readDebugInfo();
	const [accessibility, skewS] = await Promise.all([readAccessibility(), readClockSkew()]);

	return {
		...info,
		...(info.display && { display: { ...info.display, ...accessibility } }),
		...(info.clock && { clock: { ...info.clock, skewS } }),
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
