import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Plugins', 'Token');
const STORE_NAMES = new Set(['Authentication', 'AuthenticationStore']);

/** The manifest permission that lets a plugin read the account token. */
export const TOKEN_PERMISSION = 'account-token';

/** Wraps what a plugin's own lookup returned, so a token module it may not use reads no token. */
export type TokenGuard = <T>(value: T) => T;

/**
 * @description Tells whether a `findByProps` lookup asks for the module that holds the account token.
 * @param props The lookup's arguments.
 * @returns Whether `getToken` is among them.
 */
export function asksForToken(props: readonly unknown[]): boolean {
	return props.includes('getToken');
}

/**
 * @description Tells whether a store name is the one that holds the account token.
 * @param name The store name a plugin asked for.
 * @returns Whether it is the authentication store.
 */
export function isTokenStore(name: string): boolean {
	return STORE_NAMES.has(name);
}

/**
 * @description Creates the guard one plugin's lookups go through. A plugin whose manifest lists the
 * `account-token` permission gets modules as they are; any other gets a view whose `getToken` returns nothing and
 * logs once. Discord's own calls never pass through it.
 * @param name The plugin's name, for the log.
 * @param permissions The manifest's permissions.
 * @returns The guard.
 */
export function createTokenGuard(
	name: string,
	permissions: readonly string[] | undefined,
): TokenGuard {
	if (permissions?.includes(TOKEN_PERMISSION)) {
		return (value) => value;
	}

	let warned = false;

	function denied(): undefined {
		if (!warned) {
			warned = true;
			logger.warn(
				`Blocked ${name} from reading the account token: its manifest doesn't ask for it.`,
			);
		}

		return undefined;
	}

	return (value) => {
		if (typeof value !== 'object' || value === null) {
			return value;
		}

		return new Proxy(value, {
			get(target, property) {
				if (property === 'getToken') {
					return denied;
				}

				const member: unknown = Reflect.get(target, property);

				return typeof member === 'function' ? member.bind(target) : member;
			},
		});
	};
}

export default createTokenGuard;
