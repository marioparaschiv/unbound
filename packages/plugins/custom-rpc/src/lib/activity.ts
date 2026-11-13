export type ActivityKind = 'playing' | 'streaming' | 'listening' | 'watching' | 'competing';

export type TimestampMode = 'none' | 'now' | 'time';

export type PresenceOptions = {
	appId: string;
	appName: string;
	type: ActivityKind;
	streamLink: string;
	details: string;
	state: string;
	timestamps: TimestampMode;
	largeImage: string;
	largeText: string;
	smallImage: string;
	smallText: string;
	buttonOneText: string;
	buttonOneUrl: string;
	buttonTwoText: string;
	buttonTwoUrl: string;
};

export type Activity = {
	application_id: string;
	name: string;
	type: number;
	flags: number;
	details?: string;
	state?: string;
	url?: string;
	timestamps?: { start: number };
	assets?: {
		large_image?: string;
		large_text?: string;
		small_image?: string;
		small_text?: string;
	};
	buttons?: string[];
	metadata?: { button_urls: string[] };
};

const ACTIVITY_TYPES: Record<ActivityKind, number> = {
	playing: 0,
	streaming: 1,
	listening: 2,
	watching: 3,
	competing: 5,
};

const INSTANCE = 1;

function startOfDay(now: Date): number {
	const day = new Date(now);

	day.setHours(0, 0, 0, 0);

	return day.getTime();
}

function timestamps(mode: TimestampMode, now: Date): Activity['timestamps'] {
	if (mode === 'now') return { start: now.getTime() };

	if (mode === 'time') return { start: startOfDay(now) };
}

function buttons(options: PresenceOptions): Pick<Activity, 'buttons' | 'metadata'> {
	const pairs = [
		[options.buttonOneText, options.buttonOneUrl],
		[options.buttonTwoText, options.buttonTwoUrl],
	].filter(([text, url]) => text && url);

	if (!pairs.length) return {};

	return {
		buttons: pairs.map(([text]) => text!),
		metadata: { button_urls: pairs.map(([, url]) => url!) },
	};
}

async function assets(
	options: PresenceOptions,
	resolve: (image: string) => Promise<string | undefined>,
): Promise<Activity['assets']> {
	const large = options.largeImage ? await resolve(options.largeImage) : undefined;
	const small = options.smallImage ? await resolve(options.smallImage) : undefined;
	const found = {
		...(large ? { large_image: large, large_text: options.largeText || undefined } : {}),
		...(small ? { small_image: small, small_text: options.smallText || undefined } : {}),
	};

	return Object.keys(found).length ? found : undefined;
}

/**
 * @description Builds the Rich Presence activity the settings describe, the way Vencord's CustomRPC does.
 * @param options The settings.
 * @param now The current time, for the elapsed timer.
 * @param resolve Turns an image key or link into an asset id Discord can show.
 * @returns The activity, or `undefined` while it has no name.
 */
export async function buildActivity(
	options: PresenceOptions,
	now: Date,
	resolve: (image: string) => Promise<string | undefined>,
): Promise<Activity | undefined> {
	if (!options.appName.trim()) return;

	const activity: Activity = {
		application_id: options.appId.trim() || '0',
		name: options.appName.trim(),
		type: ACTIVITY_TYPES[options.type],
		flags: INSTANCE,
		...(options.details ? { details: options.details } : {}),
		...(options.state ? { state: options.state } : {}),
		...(options.type === 'streaming' && options.streamLink ? { url: options.streamLink } : {}),
		...buttons(options),
	};
	const start = timestamps(options.timestamps, now);
	const images = await assets(options, resolve);

	if (start) activity.timestamps = start;

	if (images) activity.assets = images;

	return activity;
}
