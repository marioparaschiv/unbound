import { HubVphone, type Vphone } from './vphone.ts';
import { SshVphone } from './vphone-ssh.ts';

/**
 * @description Opens a vphone session: over SSH when `VPHONE_SSH` names a host, else through the tailnet hub.
 * @returns The session.
 */
export function connectVphone(): Vphone {
	return process.env.VPHONE_SSH ? new SshVphone() : new HubVphone();
}
