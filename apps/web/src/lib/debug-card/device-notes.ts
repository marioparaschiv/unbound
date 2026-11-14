import type {
	DebugCardClock,
	DebugCardDns,
	DebugCardGateway,
	DebugCardPower,
	DebugCardPush,
} from '@unbound-app/contracts/debug-cards';
import { CLOCK_SKEW_NOTICE_S, skewPhrase } from '@unbound-app/contracts/debug-card-clock';

import { joined } from './spans';

const LOW_BATTERY = 15;
const SLOW_HEARTBEAT_MS = 1000;
const MANY_IDENTIFIES = 3;
const HEALTHY_GATEWAY = new Set(['session established', 'ready']);
const FILTERING_RESOLVERS = new Set(['AdGuard', 'NextDNS', 'Control D', 'OpenDNS']);

/**
 * @description Summarises Low Power Mode, the battery level and charging.
 * @param power The power report.
 * @returns The summary, such as `low power · battery 14%`.
 */
export function powerSummary(power: DebugCardPower): string {
	return joined([
		power.lowPower ? 'low power' : undefined,
		power.battery === undefined ? undefined : `battery ${power.battery}%`,
		power.charging ? 'charging' : undefined,
	]);
}

/**
 * @description Flags Low Power Mode or a nearly flat battery, which throttle background work and downloads.
 * @param power The power report.
 * @returns The note, or `undefined` when power is unremarkable.
 */
export function powerNote(power?: DebugCardPower): string | undefined {
	if (!power) {
		return undefined;
	}

	const flat = power.battery !== undefined && power.battery <= LOW_BATTERY && !power.charging;

	return power.lowPower || flat ? powerSummary(power) : undefined;
}

/**
 * @description Summarises the UTC offset and how far the clock is off.
 * @param clock The clock report.
 * @returns The summary, such as `UTC+01:00 · 5 min ahead`.
 */
export function clockSummary(clock: DebugCardClock): string {
	return joined([
		clock.utcOffset,
		clock.skewS === undefined ? undefined : skewPhrase(clock.skewS),
	]);
}

/**
 * @description Flags a clock a minute or more off, which breaks TLS and signature checks.
 * @param clock The clock report.
 * @returns The note, or `undefined` when the clock is close enough or unmeasured.
 */
export function clockNote(clock?: DebugCardClock): string | undefined {
	if (clock?.skewS === undefined || Math.abs(clock.skewS) < CLOCK_SKEW_NOTICE_S) {
		return undefined;
	}

	return `clock ${skewPhrase(clock.skewS)}`;
}

function pushProblems(push: DebugCardPush): string[] {
	const problems = [
		push.permission === 'denied' && 'notifications off',
		push.permission === 'not asked' && 'notifications never asked',
		push.registered === false && 'not registered for pushes',
		push.playServices === false && 'no Play services',
		push.environment === 'missing' && 'no push entitlement',
	];

	return problems.filter((problem): problem is string => typeof problem === 'string');
}

/**
 * @description Summarises the notification permission and push readiness.
 * @param push The push report.
 * @returns The summary.
 */
export function pushSummary(push: DebugCardPush): string {
	return joined([push.permission, push.environment, ...pushProblems(push)]);
}

/**
 * @description Flags anything that stops notifications arriving.
 * @param push The push report.
 * @returns The note, or `undefined` when pushes should arrive.
 */
export function pushNote(push?: DebugCardPush): string | undefined {
	const problems = push ? pushProblems(push) : [];

	return problems.length ? joined(problems) : undefined;
}

/**
 * @description Summarises the resolver and Private DNS provider.
 * @param dns The DNS report.
 * @returns The summary, such as `Cloudflare · private NextDNS`.
 */
export function dnsSummary(dns: DebugCardDns): string {
	return joined([dns.resolver, dns.privateDns ? `private ${dns.privateDns}` : undefined]);
}

/**
 * @description Flags filtering resolvers and Private DNS, which can block Discord's media and API hosts.
 * @param dns The DNS report.
 * @returns The note, or `undefined` for a router or plain public resolver.
 */
export function dnsNote(dns?: DebugCardDns): string | undefined {
	if (!dns) {
		return undefined;
	}

	const filtering = dns.resolver !== undefined && FILTERING_RESOLVERS.has(dns.resolver);

	return filtering || dns.privateDns ? dnsSummary(dns) : undefined;
}

/**
 * @description Summarises the gateway connection: its state, heartbeat latency, identifies and failed attempts.
 * @param gateway The gateway report.
 * @returns The summary, such as `session established · 130 ms`.
 */
export function gatewaySummary(gateway: DebugCardGateway): string {
	return joined([
		gateway.state,
		gateway.latencyMs === undefined ? undefined : `${gateway.latencyMs} ms`,
		gateway.connectedS === undefined ? undefined : `up ${gateway.connectedS} s`,
		gateway.identifies ? `identified ${gateway.identifies}x` : undefined,
		gateway.failedAttempts ? `${gateway.failedAttempts} failed` : undefined,
	]);
}

/**
 * @description Flags a gateway that is not connected, answers heartbeats slowly, or keeps reconnecting.
 * @param gateway The gateway report.
 * @returns The note, or `undefined` for a healthy connection.
 */
export function gatewayNote(gateway?: DebugCardGateway): string | undefined {
	if (!gateway) {
		return undefined;
	}

	const notes = [
		HEALTHY_GATEWAY.has(gateway.state) ? undefined : gateway.state,
		(gateway.latencyMs ?? 0) > SLOW_HEARTBEAT_MS
			? `${gateway.latencyMs} ms heartbeat`
			: undefined,
		(gateway.identifies ?? 0) > MANY_IDENTIFIES
			? `identified ${gateway.identifies}x`
			: undefined,
		gateway.failedAttempts ? `${gateway.failedAttempts} failed connects` : undefined,
	];

	return notes.some(Boolean) ? joined(notes) : undefined;
}
