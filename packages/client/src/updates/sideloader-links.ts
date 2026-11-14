/** A sideloading app that can install an IPA from a link, with the link that opens it on one. */
export type SideloaderLink = { name: string; url: string };

const SIDELOADERS: readonly { name: string; detect: RegExp; link: (ipa: string) => string }[] = [
	{
		name: 'AltStore',
		detect: /AltStore/i,
		link: (ipa) => `altstore-classic://install?url=${encodeURIComponent(ipa)}`,
	},
	{
		name: 'SideStore',
		detect: /SideStore/i,
		link: (ipa) => `sidestore://install?url=${encodeURIComponent(ipa)}`,
	},
	{ name: 'Feather', detect: /Feather/i, link: (ipa) => `feather://install/${ipa}` },
];

/**
 * @description Lists the sideloading apps that can install an IPA from a link, the ones the install details name first.
 * @param ipa The IPA's download URL.
 * @param installDetails How the loader describes the install's signing, such as `Development · AltStore/SideStore`.
 * @returns Each app's name and the link that opens it on the IPA.
 */
export function sideloaderLinks(ipa: string, installDetails: string): SideloaderLink[] {
	const links = SIDELOADERS.map((app) => ({
		name: app.name,
		url: app.link(ipa),
		detected: app.detect.test(installDetails),
	}));

	return [...links.filter((app) => app.detected), ...links.filter((app) => !app.detected)].map(
		({ name, url }) => ({ name, url }),
	);
}

export default sideloaderLinks;
