import { IconBook, IconDownload } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
	APP_SOURCE_URL,
	JAILBREAK_REPO_URL,
	OBTAINIUM_ICON,
	PACKAGE_MANAGERS,
	SIDELOADERS,
	SIDELOADING_TOOLS,
	getObtainiumUrl,
} from '~/lib/downloads/install-links';
import { InstallQuiz, InstallResult } from '~/components/guides/install-quiz';
import type { DownloadBuild, DownloadKind } from '~/lib/downloads/builds';
import type { InstallResultId } from '~/lib/guides/install-quiz';
import type { SourceApp } from '~/lib/downloads/install-links';
import SourceBadge from '~/components/download/source-badge';
import CopyField from '~/components/download/copy-field';
import { Button } from '~/components/ui/button';

type DownloadQuizProps = {
	/** The stable builds the answers download. */
	builds: DownloadBuild[];
};

type ResultBodyProps = {
	id: InstallResultId;
	children: ReactNode;
	actions?: ReactNode;
};

type FileButtonProps = {
	builds: DownloadBuild[];
	kind: DownloadKind;
};

type BadgesProps = {
	apps: SourceApp[];
	action?: string;
	/** Opens the links in a new tab, for web pages rather than app links. */
	external?: boolean;
};

const OBTAINIUM: SourceApp[] = [
	{ name: 'Obtainium', icon: OBTAINIUM_ICON, href: getObtainiumUrl('android') ?? '' },
];

function Badges({ apps, action, external }: BadgesProps) {
	return (
		<div className='flex flex-wrap gap-3'>
			{apps.map((app) => (
				<SourceBadge
					key={app.name}
					icon={app.icon}
					name={app.name}
					href={app.href}
					action={action}
					external={external}
				/>
			))}
		</div>
	);
}

function findFile(builds: DownloadBuild[], kind: DownloadKind) {
	return builds.flatMap((build) => build.files).find((file) => file.kind === kind);
}

function FileButton({ builds, kind }: FileButtonProps) {
	const file = findFile(builds, kind);

	if (!file) return null;

	return (
		<Button asChild>
			<a href={file.url} download>
				<IconDownload aria-hidden />
				Download {file.name}
			</a>
		</Button>
	);
}

// Every answer ends on what to get, then links the guide's full steps for the same path.
function ResultBody({ id, children, actions }: ResultBodyProps) {
	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-4 max-w-2xl text-muted-foreground text-sm'>
				{children}
			</div>
			<div className='flex flex-wrap gap-2'>
				{actions}
				<Button asChild variant='secondary'>
					<Link to='/docs/user/$' params={{ _splat: 'installing' }} hash={id}>
						<IconBook aria-hidden />
						Full install steps
					</Link>
				</Button>
			</div>
		</div>
	);
}

/**
 * @description The installing guide's quiz, ending on the stable file or source each answer needs.
 * @param props The stable builds.
 * @returns The quiz.
 */
function DownloadQuiz({ builds }: DownloadQuizProps) {
	return (
		<InstallQuiz>
			<InstallResult id='ios-source' title='iOS source'>
				<ResultBody id='ios-source'>
					<p>Add the source, then install Unbound from it. Other tools: paste the URL.</p>
					<Badges apps={SIDELOADERS} />
					<CopyField label='sideloading source' value={APP_SOURCE_URL} />
				</ResultBody>
			</InstallResult>

			<InstallResult id='ios-ipa' title='iOS IPA'>
				<ResultBody id='ios-ipa' actions={<FileButton builds={builds} kind='ipa' />}>
					<p>Open it in your sideloading tool.</p>
				</ResultBody>
			</InstallResult>

			<InstallResult id='ios-no-tool' title='Sideloading tool'>
				<ResultBody id='ios-no-tool'>
					<p>Set up one of these first, then tap Back.</p>
					<Badges apps={SIDELOADING_TOOLS} action='Get' external />
				</ResultBody>
			</InstallResult>

			<InstallResult id='ios-jailbroken' title='iOS Deb'>
				<ResultBody id='ios-jailbroken' actions={<FileButton builds={builds} kind='deb' />}>
					<p>Add the repo and install Unbound, or download the package.</p>
					<Badges apps={PACKAGE_MANAGERS} />
					<CopyField label='jailbreak repo' value={JAILBREAK_REPO_URL} />
				</ResultBody>
			</InstallResult>

			<InstallResult id='android-patched' title='APK'>
				<ResultBody
					id='android-patched'
					actions={<FileButton builds={builds} kind='apks' />}
				>
					<p>Uninstall Discord first. Install with Obtainium for updates, or with SAI.</p>
					<Badges apps={OBTAINIUM} />
				</ResultBody>
			</InstallResult>

			<InstallResult id='android-rooted' title='Xposed module'>
				<ResultBody
					id='android-rooted'
					actions={<FileButton builds={builds} kind='xposed' />}
				>
					<p>
						Enable it in Vector or LSPosed, scope it to Discord, then restart Discord.
					</p>
				</ResultBody>
			</InstallResult>
		</InstallQuiz>
	);
}

export default DownloadQuiz;
