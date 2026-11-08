import { IconArrowUpRight } from 'nucleo-micro-bold';

import type { DownloadBuild } from '~/lib/downloads/builds';
import { formatDate } from '~/components/addon/format';

type BuildMetaProps = {
	build: DownloadBuild;
};

type ReleaseNotesLinkProps = {
	build: DownloadBuild;
};

/**
 * @description A build's Unbound and Discord versions and its release date on one line.
 * @param props The build.
 * @returns The line's text.
 */
export function BuildMeta({ build }: BuildMetaProps) {
	return (
		<>
			Unbound {build.version} · Discord {build.discordVersion} ·{' '}
			{formatDate(build.publishedAt)}
		</>
	);
}

/**
 * @description Links a build's GitHub release.
 * @param props The build.
 * @returns The link.
 */
export function ReleaseNotesLink({ build }: ReleaseNotesLinkProps) {
	return (
		<a
			href={build.releaseUrl}
			target='_blank'
			rel='noopener noreferrer'
			className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm whitespace-nowrap transition-colors'
		>
			Release notes
			<IconArrowUpRight size={14} aria-hidden />
		</a>
	);
}

export default { BuildMeta, ReleaseNotesLink };
