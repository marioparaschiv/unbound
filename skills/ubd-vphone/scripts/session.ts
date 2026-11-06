import { HubError, HubVphone, type Vphone } from './vphone.ts';
import { SshVphone } from './vphone-ssh.ts';

/**
 * @description Opens a vphone session: over SSH when `VPHONE_SSH` names a host, else through a tailnet hub.
 * @returns The session.
 */
export function connectVphone(): Vphone {
	if (process.env.VPHONE_SSH) {
		return new SshVphone();
	}

	if (!process.env.TAILNET_URL) {
		throw new HubError(
			'No way to reach the vphone: set VPHONE_SSH in .env to its SSH host, such as mobile@<ip> (setup.md, Over SSH).',
		);
	}

	return new HubVphone();
}
