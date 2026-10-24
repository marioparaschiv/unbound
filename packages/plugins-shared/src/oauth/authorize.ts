import { metro } from '@unbound-app/api';

export type AuthorizeOptions = {
	clientId: string;
	redirectUri: string;
	scopes: string[];
	state?: string;
};

/** What Discord's authorize screen hands its `callback`: the redirect URL on approval. */
type AuthorizeResult = {
	location?: string | null;
	canceled?: boolean;
};

/**
 * @description Opens Discord's in-app OAuth2 authorize screen and waits for the user's answer.
 * @param options The application's client ID, redirect URI, scopes and optional state.
 * @returns The redirect URL Discord produced, or `undefined` when the user cancelled or closed the screen.
 */
export function authorize({
	clientId,
	redirectUri,
	scopes,
	state,
}: AuthorizeOptions): Promise<string | undefined> {
	return new Promise((resolve) => {
		metro.api.OAuth2.openOAuth2Modal({
			clientId,
			redirectUri,
			scopes,
			state,
			responseType: 'code',
			permissions: 0n,
			cancelCompletesFlow: false,
			callback: ({ location, canceled }: AuthorizeResult) => {
				resolve(canceled || !location ? undefined : location);
			},
			onClose: () => resolve(undefined),
		});
	});
}

export default authorize;
