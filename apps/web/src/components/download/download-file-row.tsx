import { IconBox, IconDownload, IconMobile, IconPuzzlePiece, IconWrench } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import type { DownloadFile, DownloadKind } from '~/lib/downloads/builds';
import { formatBytes } from '~/components/addon/format';
import Tag from '~/components/tag';

type KindIconProps = {
	size?: number;
};

type KindInfo = {
	label: string;
	detail: string;
	extension: string;
	icon: ComponentType<KindIconProps>;
};

type DownloadFileRowProps = {
	file: DownloadFile;
};

const KIND_INFO: Record<DownloadKind, KindInfo> = {
	ipa: {
		label: 'iOS IPA',
		detail: 'For SideStore, Feather, AltStore and other sideloaders',
		extension: '.ipa',
		icon: IconMobile,
	},
	deb: {
		label: 'iOS Deb',
		detail: 'Rootless jailbreaks, via Sileo or Zebra',
		extension: '.deb',
		icon: IconWrench,
	},
	apks: {
		label: 'APK',
		detail: 'Replaces Discord, via Obtainium or SAI',
		extension: '.apks',
		icon: IconBox,
	},
	xposed: {
		label: 'Xposed module',
		detail: 'Rooted devices with Vector or LSPosed',
		extension: '.apk',
		icon: IconPuzzlePiece,
	},
};

/**
 * @description One downloadable file of a build as a tile: what it installs as, its type and size.
 * @param props The file.
 * @returns A link that downloads the file.
 */
function DownloadFileRow({ file }: DownloadFileRowProps) {
	const info = KIND_INFO[file.kind];

	return (
		<a
			href={file.url}
			download
			className='group/file flex items-center gap-3.5 bg-card hover:bg-accent/40 p-3.5 border rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-halo shadow-surface transition-colors press-flat'
		>
			<span className='flex justify-center items-center bg-accent shadow-key rounded-full size-10 text-foreground shrink-0'>
				<info.icon size={16} aria-hidden />
			</span>
			<span className='flex flex-col gap-0.5 min-w-0 grow'>
				<span className='flex items-center gap-2 font-semibold text-foreground text-sm'>
					{info.label}
					<Tag>{info.extension}</Tag>
					<span className='font-normal text-muted-foreground text-xs tabular-nums'>
						{formatBytes(file.size)}
					</span>
				</span>
				<span className='text-muted-foreground text-xs leading-5'>{info.detail}</span>
			</span>
			<span
				aria-hidden
				className='flex justify-center items-center bg-primary group-hover/file:bg-primary/90 rounded-full size-9 text-primary-foreground transition-colors shrink-0'
			>
				<IconDownload
					size={14}
					className='group-hover/file:translate-y-0.5 transition-transform'
				/>
			</span>
		</a>
	);
}

export default DownloadFileRow;
