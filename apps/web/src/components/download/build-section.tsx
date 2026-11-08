import {
	APP_SOURCE_URL,
	JAILBREAK_REPO_URL,
	OBTAINIUM_ICON,
	PACKAGE_MANAGERS,
	SIDELOADERS,
	getObtainiumUrl,
} from '~/lib/downloads/install-links';
import { BuildMeta, ReleaseNotesLink } from '~/components/download/build-meta';
import type { BuildTrack, DownloadBuild } from '~/lib/downloads/builds';
import DownloadFileRow from '~/components/download/download-file-row';
import { staggerStyle } from '~/components/motion/reveal-style';
import type { SourceApp } from '~/lib/downloads/install-links';
import SourceBadge from '~/components/download/source-badge';
import CopyField from '~/components/download/copy-field';

type TrackInfo = {
	/** Names a nightly track; a stable build sits under its platform's heading alone. */
	title?: string;
	detail?: string;
};

type BuildSectionProps = {
	build: DownloadBuild;
};

type SourceRowProps = {
	title: string;
	apps: SourceApp[];
	/** The URL to add by hand, in an app the badges do not cover. */
	url?: string;
	label?: string;
};

// Stagger slots after the page's sections and the platform heading: the versions, each tile, then the sources.
const FIRST_SLOT = 7;

const TRACK_INFO: Record<BuildTrack, TrackInfo> = {
	ios: {},
	android: {},
	'ios-testflight': { title: 'Discord TestFlight' },
	'android-beta': { title: 'Discord beta' },
	'android-alpha': { title: 'Discord alpha', detail: 'Changes the most.' },
};

function SourceRow({ title, apps, url, label = 'source' }: SourceRowProps) {
	return (
		<div className='flex flex-col gap-3'>
			<p className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>
				{title}
			</p>
			<div className='flex flex-wrap items-center gap-3'>
				{apps.map((app) => (
					<SourceBadge key={app.name} icon={app.icon} name={app.name} href={app.href} />
				))}
			</div>
			{url ? (
				<div className='w-full max-w-md'>
					<CopyField label={label} value={url} />
				</div>
			) : null}
		</div>
	);
}

function BuildSources({ build }: BuildSectionProps) {
	const obtainium = getObtainiumUrl(build.track);

	if (build.platform === 'android') {
		return obtainium ? (
			<SourceRow
				title='Auto-updates'
				apps={[{ name: 'Obtainium', icon: OBTAINIUM_ICON, href: obtainium }]}
			/>
		) : null;
	}

	return (
		<>
			<SourceRow
				title='Sideloading source'
				apps={SIDELOADERS}
				url={APP_SOURCE_URL}
				label='sideloading source'
			/>
			{build.track === 'ios' ? (
				<SourceRow
					title='Jailbreak repo'
					apps={PACKAGE_MANAGERS}
					url={JAILBREAK_REPO_URL}
					label='jailbreak repo'
				/>
			) : null}
		</>
	);
}

/**
 * @description One track's newest build: its versions and date, a tile per file and the sources that install it.
 * @param props The build.
 * @returns The build's section.
 */
function BuildSection({ build }: BuildSectionProps) {
	const info = TRACK_INFO[build.track];

	return (
		<div className='flex flex-col gap-4 min-w-0'>
			<div className='flex flex-col gap-0.5 animate-reveal' style={staggerStyle(FIRST_SLOT)}>
				{/* A stable build has no title; its platform heading shows its versions instead. */}
				{info.title ? (
					<h4 className='font-semibold text-foreground text-lg'>{info.title}</h4>
				) : null}
				{info.title ? (
					<div className='flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1 text-muted-foreground text-sm'>
						<p>
							{info.detail ? `${info.detail} ` : null}
							<BuildMeta build={build} />
						</p>
						<ReleaseNotesLink build={build} />
					</div>
				) : null}
			</div>
			<div className='gap-3 grid sm:grid-cols-2'>
				{build.files.map((file, index) => (
					<div
						key={file.kind}
						className='grid animate-reveal'
						style={staggerStyle(FIRST_SLOT + 1 + index)}
					>
						<DownloadFileRow file={file} />
					</div>
				))}
			</div>
			<div
				className='flex flex-col gap-4 animate-reveal'
				style={staggerStyle(FIRST_SLOT + 1 + build.files.length)}
			>
				<BuildSources build={build} />
			</div>
		</div>
	);
}

export default BuildSection;
