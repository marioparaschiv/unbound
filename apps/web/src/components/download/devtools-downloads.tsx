import {
	IconApple,
	IconArchive,
	IconArrowUpRight,
	IconDownload,
	IconTerminal,
	IconWindow,
} from 'nucleo-micro-bold';

import { DEVTOOLS_ASSETS, DEVTOOLS_RELEASES_URL } from '~/lib/downloads/devtools';
import type { DevToolsAsset, DevToolsOs } from '~/lib/downloads/devtools';
import { staggerStyle } from '~/components/motion/reveal-style';
import Tag from '~/components/tag';

type DevToolsTileProps = {
	asset: DevToolsAsset;
};

type OsInfo = {
	label: string;
	icon: typeof IconApple;
};

const OS_INFO: Record<DevToolsOs, OsInfo> = {
	macos: { label: 'macOS', icon: IconApple },
	windows: { label: 'Windows', icon: IconWindow },
	linux: { label: 'Linux', icon: IconTerminal },
};

// Stagger slots after the loader downloads' heading.
const FIRST_SLOT = 6;

const WINDOWS = DEVTOOLS_ASSETS.filter((asset) => asset.os === 'windows');
const OTHERS = DEVTOOLS_ASSETS.filter((asset) => asset.os !== 'windows');

const TILE =
	'group/file flex items-center gap-3.5 p-3.5 border rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-halo transition-colors press-flat';

const BADGE =
	'flex justify-center items-center bg-accent shadow-key rounded-full size-10 text-foreground shrink-0';

function DevToolsTile({ asset }: DevToolsTileProps) {
	const info = OS_INFO[asset.os];

	return (
		<a
			href={asset.url}
			download
			className={`${TILE} bg-card hover:bg-accent/40 shadow-surface`}
		>
			<span className={BADGE}>
				<info.icon size={16} aria-hidden />
			</span>
			<span className='flex flex-col gap-0.5 min-w-0 grow'>
				<span className='flex items-center gap-2 font-semibold text-foreground text-sm'>
					{info.label}
					<span className='font-normal text-muted-foreground'>{asset.arch}</span>
					<Tag>{asset.extension}</Tag>
				</span>
				<span className='text-muted-foreground text-xs truncate'>
					Contains <span className='font-mono'>{asset.contents}</span>
				</span>
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

// Fills the Windows column's third row, so both columns end level.
function OlderVersionsTile() {
	return (
		<a
			href={DEVTOOLS_RELEASES_URL}
			target='_blank'
			rel='noopener noreferrer'
			className={`${TILE} border-dashed hover:bg-accent/40`}
		>
			<span className={BADGE}>
				<IconArchive size={16} aria-hidden />
			</span>
			<span className='font-semibold text-foreground text-sm grow'>Older versions</span>
			<IconArrowUpRight size={14} className='text-muted-foreground shrink-0' aria-hidden />
		</a>
	);
}

/**
 * @description The DevTools desktop app's newest archive for each system, in a Windows column and a macOS and Linux column.
 * @returns The DevTools download section.
 */
function DevToolsDownloads() {
	return (
		<section aria-labelledby='devtools-heading' className='flex flex-col gap-6 pt-8 border-t'>
			<div className='flex flex-col gap-1 animate-reveal' style={staggerStyle(FIRST_SLOT)}>
				<h2 id='devtools-heading' className='font-semibold text-foreground text-xl'>
					DevTools
				</h2>
				<p className='text-muted-foreground text-sm'>
					A desktop app for building on Unbound: inspect components, browse native views
					and Metro modules, and let an agent join over MCP. Each download is an archive
					with the app inside.
				</p>
			</div>
			{/* Column-first on wide screens: Windows on the left, macOS then Linux on the right. */}
			<div className='gap-3 grid sm:grid-cols-2 sm:grid-rows-3 sm:grid-flow-col'>
				{WINDOWS.map((asset, index) => (
					<div
						key={asset.url}
						className='grid animate-reveal'
						style={staggerStyle(FIRST_SLOT + 1 + index)}
					>
						<DevToolsTile asset={asset} />
					</div>
				))}
				<div
					className='grid order-last sm:order-none animate-reveal'
					style={staggerStyle(FIRST_SLOT + 1 + DEVTOOLS_ASSETS.length)}
				>
					<OlderVersionsTile />
				</div>
				{OTHERS.map((asset, index) => (
					<div
						key={asset.url}
						className='grid animate-reveal'
						style={staggerStyle(FIRST_SLOT + 1 + WINDOWS.length + index)}
					>
						<DevToolsTile asset={asset} />
					</div>
				))}
			</div>
			<p className='text-muted-foreground text-sm'>
				On macOS, move the app to Applications, then run{' '}
				<code className='font-mono text-xs'>
					xattr -dr com.apple.quarantine "/Applications/Unbound DevTools.app"
				</code>{' '}
				once.
			</p>
		</section>
	);
}

export default DevToolsDownloads;
