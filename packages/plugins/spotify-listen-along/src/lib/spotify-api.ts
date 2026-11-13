const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_LIFETIME_MS = 50 * 60_000;

export type SpotifyDevice = {
	id: string;
	is_active: boolean;
	is_restricted: boolean;
	type?: string;
};

export type DiscordHTTP = {
	get(request: { url: string }): Promise<{ body?: { access_token?: string } }>;
};

export type SpotifyClient = {
	devices(): Promise<SpotifyDevice[]>;
	play(deviceId: string, trackId: string, positionMs: number): Promise<number>;
	pause(deviceId: string): Promise<number>;
};

/**
 * @description Calls Spotify's Web API with the access token Discord holds for the user's connected Spotify account,
 * fetching a new token before the old one expires.
 * @param http Discord's HTTP client.
 * @param accountId The connected Spotify account's id.
 * @param request `fetch`, replaceable in tests.
 * @returns The client.
 */
export function createSpotifyClient(
	http: DiscordHTTP,
	accountId: string,
	request: typeof fetch = fetch,
): SpotifyClient {
	let token: { value: string; expires: number } | undefined;

	async function accessToken(): Promise<string> {
		if (token && token.expires > Date.now()) return token.value;

		const response = await http.get({
			url: `/users/@me/connections/spotify/${accountId}/access-token`,
		});
		const value = response.body?.access_token;

		if (!value) throw new Error('Discord returned no Spotify access token');

		token = { value, expires: Date.now() + TOKEN_LIFETIME_MS };

		return value;
	}

	async function call(method: string, path: string, body?: object): Promise<Response> {
		return request(`${SPOTIFY_API}${path}`, {
			method,
			headers: {
				authorization: `Bearer ${await accessToken()}`,
				'content-type': 'application/json',
			},
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	return {
		async devices() {
			const response = await call('GET', '/me/player/devices');
			const parsed = response.ok
				? ((await response.json()) as { devices?: SpotifyDevice[] })
				: {};

			return Array.isArray(parsed.devices) ? parsed.devices : [];
		},
		async play(deviceId, trackId, positionMs) {
			const response = await call(
				'PUT',
				`/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
				{
					uris: [`spotify:track:${trackId}`],
					position_ms: Math.max(0, Math.round(positionMs)),
				},
			);

			return response.status;
		},
		async pause(deviceId) {
			const response = await call(
				'PUT',
				`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`,
			);

			return response.status;
		},
	};
}

/**
 * @description Picks the device to play on: the one already playing, else a phone, never an idle speaker or computer elsewhere.
 * @param devices The user's Spotify devices.
 * @returns The device, or `undefined` when none should play.
 */
export function pickDevice(devices: SpotifyDevice[]): SpotifyDevice | undefined {
	const usable = devices.filter((device) => !device.is_restricted);

	return (
		usable.find((device) => device.is_active) ??
		usable.find((device) => device.type === 'Smartphone')
	);
}

export default { createSpotifyClient, pickDevice };
