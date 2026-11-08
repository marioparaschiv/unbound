import type { GitHubRelease } from '~/lib/github';

/** What a file installs as: a sideloaded app, a jailbreak tweak, a patched Discord or an Xposed module. */
export type DownloadKind = 'ipa' | 'deb' | 'apks' | 'xposed';

export type DownloadFile = {
	kind: DownloadKind;
	name: string;
	url: string;
	size: number;
};

/** The Discord app a build is made from: a platform, and the Discord channel for a nightly. */
export type BuildTrack = 'ios' | 'ios-testflight' | 'android' | 'android-beta' | 'android-alpha';

export type DownloadPlatform = 'ios' | 'android';

/** The newest release CI published on one track. */
export type DownloadBuild = {
	track: BuildTrack;
	platform: DownloadPlatform;
	/** Unbound's version, such as `1.0.971`. */
	version: string;
	/** The Discord version it is built on, such as `352.17`. */
	discordVersion: string;
	publishedAt: string;
	releaseUrl: string;
	files: DownloadFile[];
};

export type DownloadChannel = 'stable' | 'nightly';

/** Each channel's builds, in track order; a track with no release is left out. */
export type Downloads = Record<DownloadChannel, DownloadBuild[]>;

export const CHANNEL_TRACKS: Record<DownloadChannel, BuildTrack[]> = {
	stable: ['ios', 'android'],
	nightly: ['ios-testflight', 'android-beta', 'android-alpha'],
};

export const EMPTY_DOWNLOADS: Downloads = { stable: [], nightly: [] };

const KIND_ORDER: DownloadKind[] = ['ipa', 'deb', 'apks', 'xposed'];

// CI names loader releases `Unbound 1.0.973 for Discord 353.9, Android beta`; TestFlight adds the build number.
const RELEASE_NAME =
	/^Unbound (\S+) for Discord ([^\s,]+)(?: \(\d+\))?, (iOS|Android)(?: (TestFlight|beta|alpha))?$/;

const TRACKS = new Set<string>(Object.values(CHANNEL_TRACKS).flat());

function isTrack(value: string): value is BuildTrack {
	return TRACKS.has(value);
}

function readKind(name: string): DownloadKind | undefined {
	if (name.endsWith('.xposed.apk')) {
		return 'xposed';
	}

	if (name.endsWith('.apks')) {
		return 'apks';
	}

	if (name.endsWith('.ipa')) {
		return 'ipa';
	}

	if (name.endsWith('.deb')) {
		return 'deb';
	}

	return undefined;
}

// A release can carry older `.deb`s beside its own, so each kind prefers the file named for the release's version.
function pickFiles(release: GitHubRelease, version: string): DownloadFile[] {
	const files = release.assets.flatMap((asset) => {
		const kind = readKind(asset.name);

		return kind ? [{ kind, ...asset }] : [];
	});

	return KIND_ORDER.flatMap((kind) => {
		const ofKind = files.filter((file) => file.kind === kind);
		const picked = ofKind.find((file) => file.name.includes(`_${version}_`)) ?? ofKind.at(-1);

		return picked ? [picked] : [];
	});
}

function toBuild(release: GitHubRelease): DownloadBuild | undefined {
	const match = RELEASE_NAME.exec(release.name ?? '');

	if (!match || !release.publishedAt) {
		return undefined;
	}

	const [, version = '', discordVersion = '', platformName = '', suffix] = match;
	const platform: DownloadPlatform = platformName === 'iOS' ? 'ios' : 'android';
	const track = suffix ? `${platform}-${suffix.toLowerCase()}` : platform;
	const files = pickFiles(release, version);

	if (!isTrack(track) || files.length === 0) {
		return undefined;
	}

	return {
		track,
		platform,
		version,
		discordVersion,
		publishedAt: release.publishedAt,
		releaseUrl: release.url,
		files,
	};
}

/**
 * @description Picks the newest loader release on each track from a repository's releases.
 * @param releases The releases, in any order.
 * @returns The stable and nightly builds, in track order.
 */
export function toDownloads(releases: GitHubRelease[]): Downloads {
	const newest = new Map<BuildTrack, DownloadBuild>();

	for (const release of releases) {
		const build = toBuild(release);
		const current = build && newest.get(build.track);

		if (build && (!current || build.publishedAt > current.publishedAt)) {
			newest.set(build.track, build);
		}
	}

	const pick = (channel: DownloadChannel) =>
		CHANNEL_TRACKS[channel].flatMap((track) => newest.get(track) ?? []);

	return { stable: pick('stable'), nightly: pick('nightly') };
}

export default { CHANNEL_TRACKS, EMPTY_DOWNLOADS, toDownloads };
