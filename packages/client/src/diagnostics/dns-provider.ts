/** A public resolver, by the address prefixes it answers on. */
type Provider = { name: string; prefixes: string[] };

const PROVIDERS: Provider[] = [
	{ name: 'Cloudflare', prefixes: ['1.1.1.', '1.0.0.', '2606:4700:4700:'] },
	{ name: 'Google', prefixes: ['8.8.8.8', '8.8.4.4', '2001:4860:4860:'] },
	{ name: 'Quad9', prefixes: ['9.9.9.', '149.112.112.', '2620:fe:'] },
	{ name: 'AdGuard', prefixes: ['94.140.14.', '94.140.15.', '2a10:50c0:'] },
	{ name: 'NextDNS', prefixes: ['45.90.28.', '45.90.30.', '2a07:a8c0:', '2a07:a8c1:'] },
	{ name: 'OpenDNS', prefixes: ['208.67.222.', '208.67.220.', '2620:119:35:', '2620:119:53:'] },
	{ name: 'Control D', prefixes: ['76.76.2.', '76.76.10.', '2606:1a40:'] },
	{ name: 'Tailscale', prefixes: ['100.100.100.100', 'fd7a:115c:a1e0:'] },
];

const PRIVATE_DNS_HOSTS: [RegExp, string][] = [
	[/(^|\.)cloudflare-dns\.com$|(^|\.)one\.one\.one\.one$/, 'Cloudflare'],
	[/(^|\.)dns\.google$/, 'Google'],
	[/(^|\.)quad9\.net$/, 'Quad9'],
	[/(^|\.)adguard(-dns)?\.(com|io)$/, 'AdGuard'],
	[/(^|\.)nextdns\.io$/, 'NextDNS'],
	[/(^|\.)controld\.com$/, 'Control D'],
	[/(^|\.)mullvad\.net$/, 'Mullvad'],
];

const LOCAL = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fe80:|fd|fc|127\.|::1$)/i;

function providerOf(server: string): string {
	const address = server.toLowerCase();

	if (LOCAL.test(address)) {
		return 'local';
	}

	return (
		PROVIDERS.find(({ prefixes }) => prefixes.some((prefix) => address.startsWith(prefix)))
			?.name ?? 'other'
	);
}

/**
 * @description Names the resolver behind a list of DNS server addresses, so `/debug` reports a provider and never an address.
 * @param servers The resolver addresses, in order.
 * @returns A provider such as `Cloudflare`, `local` for a router or LAN resolver, `other`, or `undefined` with none.
 */
export function resolverName(servers: string[]): string | undefined {
	const names = [...new Set(servers.map(providerOf))];

	if (!names.length) {
		return undefined;
	}

	return names.find((name) => name !== 'local' && name !== 'other') ?? names[0];
}

/**
 * @description Names the Android Private DNS provider from its hostname, never reporting the hostname itself.
 * @param active Whether Private DNS encrypts lookups.
 * @param host The hostname set in Settings, absent in automatic mode.
 * @returns The provider, `custom` for an unknown host, `automatic` without one, or `undefined` when it is off.
 */
export function privateDnsName(active?: boolean, host?: string): string | undefined {
	if (!active) {
		return undefined;
	}

	if (!host) {
		return 'automatic';
	}

	return PRIVATE_DNS_HOSTS.find(([pattern]) => pattern.test(host.toLowerCase()))?.[1] ?? 'custom';
}

export default resolverName;
