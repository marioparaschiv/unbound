import { networkInterfaces } from 'node:os';

type Candidate = { name: string; address: string };

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Adapter-name fragments for virtual interfaces (WSL, Hyper-V, Docker, VPNs)
// that look like LAN interfaces but a phone on your Wi-Fi can't reach.
const VIRTUAL =
	/vEthernet|WSL|Hyper-V|Default Switch|VirtualBox|VMware|Docker|Tailscale|ZeroTier|utun|Loopback/i;

/**
 * @description Lists every non-internal IPv4 address, ranked so the most likely real LAN address
 * comes first: physical-looking adapters before virtual ones, and `192.168.*` / `10.*` /
 * `172.16-31.*` private ranges before anything else. Link-local `169.254.*` is dropped entirely.
 * @returns The ranked address candidates, best first.
 */
export function lanCandidates(): Candidate[] {
	const candidates: Candidate[] = [];

	for (const [name, addresses] of Object.entries(networkInterfaces())) {
		for (const address of addresses ?? []) {
			if (address.family !== 'IPv4' || address.internal) continue;
			if (address.address.startsWith('169.254.')) continue;

			candidates.push({ name, address: address.address });
		}
	}

	// Lower is better. `192.168.*` is the typical home/office Wi-Fi range, so it
	// wins; `10.*` and `172.16-31.*` are valid private ranges but rarer on a
	// home LAN. A virtual adapter (WSL/Hyper-V/VPN) is heavily penalised - a
	// phone on your Wi-Fi can't route to it even if the IP looks private.
	function rank({ name, address }: Candidate): number {
		const virtualPenalty = VIRTUAL.test(name) ? 100 : 0;

		if (address.startsWith('192.168.')) {
			return virtualPenalty + 1;
		}

		if (address.startsWith('10.')) {
			return virtualPenalty + 2;
		}

		if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) {
			return virtualPenalty + 3;
		}

		return virtualPenalty + 10;
	}

	return candidates.sort((a, b) => rank(a) - rank(b));
}

/**
 * @description Picks the most likely LAN IPv4 address for a physical device to reach (a phone
 * hitting `localhost` would reach itself). Best-effort only - pass `--host <ip>` or set `DEV_HOST`
 * when the guess is wrong. Falls back to `localhost` when no external interface is found.
 * @returns The best-guess LAN address, or `localhost`.
 */
export function detectLanIp(): string {
	return lanCandidates()[0]?.address ?? 'localhost';
}

/**
 * @description Resolves the dev host the device should connect to, honouring `--host <ip>` on the
 * command line and the `DEV_HOST` env var, then falling back to the detected LAN IP.
 * @returns The resolved host (an IP or hostname), without scheme or port.
 */
export function resolveDevHost(): string {
	const flagIndex = process.argv.indexOf('--host');
	if (~flagIndex && process.argv[flagIndex + 1]) {
		return process.argv[flagIndex + 1];
	}

	if (process.env.DEV_HOST) return process.env.DEV_HOST;

	return detectLanIp();
}

/**
 * @description The full origin (`http://<host>:<port>`) the device fetches locale tables and the
 * hot-reload stream from. `DEV_SERVER_URL` overrides the whole URL when set.
 * @returns The dev server origin.
 */
export function resolveDevServerUrl(): string {
	return process.env.DEV_SERVER_URL || `http://${resolveDevHost()}:${PORT}`;
}

export default { lanCandidates, detectLanIp, resolveDevHost, resolveDevServerUrl };
