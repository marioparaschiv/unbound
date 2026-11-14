import { packDebugAltText, type DebugAltPayload } from '@unbound-app/contracts/debug-card-alt-text';
import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';
import { launchNotes } from '@unbound-app/contracts/debug-card-launch';
import { parsePlist } from '@unbound-app/contracts/plist';

import {
	displaySummary,
	errorNotes,
	joined,
	lastCheckSummary,
	memorySummary,
	networkSummary,
	sessionSummary,
	sourceLabel,
	supportOf,
	updateNotes,
} from '~/lib/debug-card/layout';
import { cleanNames } from '~/lib/debug-card/spans';
import type { DebugCardContext } from '~/lib/debug-card/context';

const MAX_ALT_TEXT = 1024;

// Dropped in this order while the packed text is over Discord's limit; what is left is bounded by the request schema.
const DROP_ORDER = [
	'experiments',
	'tweaks',
	'enabledPlugins',
	'patches',
	'native',
	'heap',
	'storage',
	'memory',
	'iconPack',
	'theme',
	'locale',
	'session',
	'display',
	'errors',
	'disabled',
	'crashes',
	'entitlements',
	'install',
	'source',
	'framework',
	'loaderOrigin',
	'jailbreak',
] as const;

/**
 * @description Packs the report and the app's entitlements into the image's alt text, so bots can read them; whole unless over Discord's limit.
 * @param info The versions and device details, with the entitlements plist on iOS.
 * @param context What the server adds: the compat scan and whether the client or loader is behind.
 * @param now When the report was taken, to say how long ago the last update check ran.
 * @returns Text `unpackDebugAltText` reads, at most 1024 characters.
 */
export function debugAltText(
	info: DebugInfo,
	context: DebugCardContext = {},
	now = new Date(),
): string {
	const entitlements = info.entitlements ? parsePlist(info.entitlements) : undefined;
	const report: DebugAltPayload = {
		unbound: info.client.replace(/^v/, ''),
		commit: info.commit,
		loader: info.loader,
		loaderOrigin: info.loaderOrigin,
		framework: info.framework,
		jailbreak: info.jailbreak ?? '',
		discord: info.discord,
		channel: info.discordChannel.toLowerCase(),
		build: info.discordBuild,
		source: info.appSource,
		install: (info.installDetails ?? '').replaceAll('`', ''),
		device: info.device,
		platform: info.platform,
		os: info.os,
		react: info.react,
		reactNative: info.reactNative,
		hermes: info.hermes,
		bytecode: info.bytecode,
		state: info.flags,
		...(supportOf(info, context) && { support: supportOf(info, context) }),
		...(updateNotes(context, info.addonUpdates).length && {
			updates: updateNotes(context, info.addonUpdates),
		}),
		...(launchNotes(info.launch).length && { launch: launchNotes(info.launch) }),
		...(info.disabledAddons?.length && { disabled: info.disabledAddons }),
		...(info.locale && { locale: info.locale }),
		...(info.theme && { theme: info.theme }),
		...(info.iconPack && { iconPack: info.iconPack }),
		...(info.plugins && { plugins: `${info.plugins.enabled}/${info.plugins.installed}` }),
		...(info.themes && { themes: `${info.themes.enabled}/${info.themes.installed}` }),
		...(info.launch?.firstRenderMs && { firstRenderMs: String(info.launch.firstRenderMs) }),
		...(sourceLabel(info.launch) && { bundleSource: sourceLabel(info.launch) }),
		...(lastCheckSummary(info.launch, now) && {
			lastCheck: lastCheckSummary(info.launch, now),
		}),
		...(info.launch?.settings && { settings: info.launch.settings }),
		...(info.errors?.length && { errors: errorNotes(info.errors) }),
		...(info.storage && {
			storage: joined([
				info.storage.freeMB === undefined ? undefined : `${info.storage.freeMB} MB free`,
				info.storage.unboundMB === undefined
					? undefined
					: `unbound ${info.storage.unboundMB} MB`,
			]),
		}),
		...(info.patches?.length && {
			patches: info.patches.map((patch) => `${patch.caller} ${patch.count}`),
		}),
		...(info.enabledPlugins?.length && { enabledPlugins: info.enabledPlugins }),
		...(info.experiments?.length && { experiments: info.experiments }),
		...(cleanNames(info.injected ?? []).length && { tweaks: cleanNames(info.injected ?? []) }),
		...(info.missingExtensions?.length && { missingExtensions: info.missingExtensions }),
		...(info.display && { display: displaySummary(info.display) }),
		...(info.session && { session: sessionSummary(info.session) }),
		...(info.native && {
			native: `${info.native.hooks} hooks · ${info.native.surfaces} surfaces · ${info.native.handles} handles`,
		}),
		...(info.memory && { memory: memorySummary(info.memory) }),
		...(info.network && { network: networkSummary(info.network) }),
		...(info.heap && { heap: `${info.heap.heapMB} MB · gc ${info.heap.gcMs} ms` }),
		...(info.launch?.crashes?.length && {
			crashes: info.launch.crashes.map(
				(crash) => `${new Date(crash.at).toISOString().slice(0, 16)}Z ${crash.crash}`,
			),
		}),
		...(entitlements !== undefined && { entitlements }),
	};
	let text = packDebugAltText(report);

	for (const key of DROP_ORDER) {
		if (text.length <= MAX_ALT_TEXT) {
			break;
		}

		delete report[key];
		text = packDebugAltText(report);
	}

	return text;
}

export default debugAltText;
