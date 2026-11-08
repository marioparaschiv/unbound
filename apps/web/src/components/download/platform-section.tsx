import { IconApple, IconMobile } from 'nucleo-micro-bold';

import { BuildMeta, ReleaseNotesLink } from '~/components/download/build-meta';
import type { DownloadBuild, DownloadPlatform } from '~/lib/downloads/builds';
import { staggerStyle } from '~/components/motion/reveal-style';
import BuildSection from '~/components/download/build-section';

type PlatformInfo = {
	title: string;
	detail: string;
	icon: typeof IconApple;
};

type PlatformSectionProps = {
	platform: DownloadPlatform;
	builds: DownloadBuild[];
};

const PLATFORM_INFO: Record<DownloadPlatform, PlatformInfo> = {
	ios: { title: 'iOS', detail: 'iPhone and iPad', icon: IconApple },
	android: { title: 'Android', detail: 'Android 9 or newer', icon: IconMobile },
};

/**
 * @description One platform's builds under a large heading, so iOS and Android read as separate blocks.
 * @param props The platform and its builds in the shown channel.
 * @returns The platform's section, or nothing when it has no build.
 */
function PlatformSection({ platform, builds }: PlatformSectionProps) {
	const info = PLATFORM_INFO[platform];
	// A stable build's track is its platform; nightly tracks keep their line under their own title.
	const stable = builds.length === 1 && builds[0]?.track === platform ? builds[0] : undefined;

	if (builds.length === 0) return null;

	return (
		<section
			aria-labelledby={`platform-${platform}`}
			className='flex flex-col gap-6 pt-8 border-t first:border-t-0 first:pt-0'
		>
			<div className='flex items-center gap-4 animate-reveal' style={staggerStyle(6)}>
				<span className='flex justify-center items-center bg-card shadow-surface border rounded-full size-14 text-foreground shrink-0'>
					<info.icon size={26} aria-hidden />
				</span>
				<div className='flex flex-col gap-0.5 grow'>
					<h3 id={`platform-${platform}`} className='font-bold text-foreground text-2xl'>
						{info.title}
					</h3>
					<p className='text-muted-foreground text-sm'>
						{stable ? <BuildMeta build={stable} /> : info.detail}
					</p>
				</div>
				{stable ? <ReleaseNotesLink build={stable} /> : null}
			</div>
			<div className='flex flex-col gap-10'>
				{builds.map((build) => (
					<BuildSection key={build.track} build={build} />
				))}
			</div>
		</section>
	);
}

export default PlatformSection;
