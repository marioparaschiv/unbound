import type {
	DebugCardAddonCount,
	DebugCardRequest,
	DebugCardSupport,
} from '@unbound-app/contracts/debug-cards';
import { launchNotes } from '@unbound-app/contracts/debug-card-launch';

/** How many addons of one kind are installed and enabled. */
export type AddonCount = DebugCardAddonCount;

/** Whether Unbound supports the running Discord: `unsupported` is older than the minimum, `untested` an Alpha build. */
export type DiscordSupport = DebugCardSupport;

/** What `/debug` reports about the running client, as the server's card endpoint takes it. */
export type DebugInfo = DebugCardRequest;

function sentenceCase(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @description Lists the client's debug information as Markdown bullets, one labelled line per component.
 * @param info The versions and device details.
 * @returns The lines, shared by `/debug` and the GitHub issue report.
 */
export function debugLines(info: DebugInfo): string[] {
	const loader = [info.loaderOrigin, info.jailbreak, info.framework]
		.filter(Boolean)
		.map((part) => `(\`${part}\`)`)
		.join(' ');

	return [
		`- **Unbound:** ${info.client} (\`${info.commit}\`), loader ${info.loader} ${loader}`,
		`- **Discord:** ${info.discord} ${info.discordChannel.toLowerCase()}, build ${info.discordBuild} (${info.appSource})${info.discordSupport && info.discordSupport !== 'supported' ? `, ${info.discordSupport}` : ''}`,
		`- **Device:** ${info.device} on ${info.platform} ${info.os}`,
		...(info.installDetails ? [`- **Install:** ${sentenceCase(info.installDetails)}`] : []),
		`- **State:** ${info.flags.join(' · ')}`,
		...(info.disabledAddons?.length
			? [`- **Disabled:** ${info.disabledAddons.join(' · ')}`]
			: []),
		...(launchNotes(info.launch).length
			? [`- **Launch:** ${launchNotes(info.launch).join(' · ')}`]
			: []),
		`- **Runtime:** React ${info.react}, React Native ${info.reactNative}, Hermes ${info.hermes} (HBC ${info.bytecode})`,
		...(info.network ? [`- **Network:** ${networkLine(info.network)}`] : []),
	];
}

function networkLine(network: NonNullable<DebugInfo['network']>): string {
	return [
		network.type === 'wifi' ? 'Wi-Fi' : sentenceCase(network.type),
		network.metered && network.type !== 'cellular' ? 'metered' : undefined,
		network.lowData ? 'Low Data Mode' : undefined,
		network.vpn ? 'VPN' : undefined,
		network.proxy ? 'proxy' : undefined,
	]
		.filter(Boolean)
		.join(' · ');
}

/**
 * @description Formats the client's debug information as a Discord message: a heading and one labelled line per component.
 * @param info The versions and device details.
 * @returns The message text.
 */
export function formatDebugInfo(info: DebugInfo): string {
	return ['### Unbound Debug Info', ...debugLines(info)].join('\n');
}

export default formatDebugInfo;
