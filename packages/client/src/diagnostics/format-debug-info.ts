import type {
	DebugCardAddonCount,
	DebugCardRequest,
	DebugCardSupport,
} from '@unbound-app/contracts/debug-cards';
import { launchNotes } from '@unbound-app/contracts/debug-card-launch';
import { skewPhrase } from '@unbound-app/contracts/debug-card-clock';

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
		...(info.injected?.length ? [`- **Other tweaks:** ${info.injected.join(' · ')}`] : []),
		...(info.missingExtensions?.length
			? [`- **Missing extensions:** ${info.missingExtensions.join(' · ')}`]
			: []),
		...(info.addonUpdates?.length
			? [`- **Updates waiting:** ${info.addonUpdates.join(' · ')}`]
			: []),
		...(launchNotes(info.launch).length
			? [`- **Launch:** ${launchNotes(info.launch).join(' · ')}`]
			: []),
		`- **Runtime:** React ${info.react}, React Native ${info.reactNative}, Hermes ${info.hermes} (HBC ${info.bytecode})`,
		...(info.network ? [`- **Network:** ${networkLine(info.network, info.dns)}`] : []),
		...(info.power ? [`- **Power:** ${powerLine(info.power)}`] : []),
		...(info.clock ? [`- **Clock:** ${clockLine(info.clock)}`] : []),
		...(info.push ? [`- **Notifications:** ${pushLine(info.push)}`] : []),
		...(info.gateway ? [`- **Gateway:** ${gatewayLine(info.gateway)}`] : []),
		...(info.experiments?.length ? [`- **Experiments:** ${info.experiments.join(', ')}`] : []),
	];
}

function joinedParts(parts: (string | false | undefined)[]): string {
	return parts.filter(Boolean).join(' · ');
}

function networkLine(network: NonNullable<DebugInfo['network']>, dns?: DebugInfo['dns']): string {
	return joinedParts([
		network.type === 'wifi' ? 'Wi-Fi' : sentenceCase(network.type),
		network.metered && network.type !== 'cellular' && 'metered',
		network.lowData && 'Low Data Mode',
		network.vpn && 'VPN',
		network.proxy && 'proxy',
		dns?.resolver && dns.resolver !== 'local' && `DNS ${dns.resolver}`,
		dns?.privateDns && `Private DNS ${dns.privateDns}`,
	]);
}

function powerLine(power: NonNullable<DebugInfo['power']>): string {
	return joinedParts([
		power.lowPower ? 'Low Power Mode' : 'normal',
		power.battery !== undefined && `battery ${power.battery}%`,
		power.charging && 'charging',
	]);
}

function clockLine(clock: NonNullable<DebugInfo['clock']>): string {
	return joinedParts([clock.utcOffset, clock.skewS !== undefined && skewPhrase(clock.skewS)]);
}

function gatewayLine(gateway: NonNullable<DebugInfo['gateway']>): string {
	return joinedParts([
		gateway.state,
		gateway.latencyMs !== undefined && `${gateway.latencyMs} ms`,
		gateway.connectedS !== undefined && `connected ${durationOf(gateway.connectedS)}`,
		(gateway.identifies ?? 0) > 1 && `identified ${gateway.identifies}×`,
		(gateway.failedAttempts ?? 0) > 0 && `${gateway.failedAttempts} failed attempts`,
	]);
}

function durationOf(seconds: number): string {
	if (seconds < 120) {
		return `${seconds} s`;
	}

	if (seconds < 7200) {
		return `${Math.round(seconds / 60)} min`;
	}

	return `${Math.round(seconds / 3600)} h`;
}

function pushLine(push: NonNullable<DebugInfo['push']>): string {
	return joinedParts([
		push.permission === 'not asked' ? 'never asked' : push.permission,
		push.registered === false && 'not registered for pushes',
		push.playServices === false && 'no Google Play services',
		push.environment === 'missing' && 'no push entitlement',
		push.environment === 'development' && 'development pushes',
	]);
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
