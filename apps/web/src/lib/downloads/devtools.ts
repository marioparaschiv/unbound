/** A desktop system the DevTools app is built for. */
export type DevToolsOs = 'macos' | 'windows' | 'linux';

/** One DevTools archive on the rolling `devtools-latest` release. */
export type DevToolsAsset = {
	os: DevToolsOs;
	arch: string;
	url: string;
	extension: string;
};

/** The rolling release CI moves to each new DevTools version, so its asset URLs never change. */
export const DEVTOOLS_LATEST_URL =
	'https://github.com/marioparaschiv/unbound/releases/download/devtools-latest';

/** Every DevTools release, newest first. */
export const DEVTOOLS_RELEASES_URL =
	'https://github.com/marioparaschiv/unbound/releases?q=devtools-v&expanded=true';

const asset = (os: DevToolsOs, arch: string, archLabel: string, extension: string) => ({
	os,
	arch: archLabel,
	url: `${DEVTOOLS_LATEST_URL}/unbound-devtools-${os}-${arch}${extension}`,
	extension,
});

/** The archives devtools.yml attaches to each release, matching its build matrix. */
export const DEVTOOLS_ASSETS: DevToolsAsset[] = [
	asset('macos', 'arm64', 'Apple silicon', '.tar.gz'),
	asset('windows', 'x64', 'x64', '.zip'),
	asset('windows', 'arm64', 'ARM64', '.zip'),
	asset('linux', 'x64', 'x64', '.tar.gz'),
	asset('linux', 'arm64', 'ARM64', '.tar.gz'),
];
