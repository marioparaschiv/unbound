import {
	IconApple,
	IconArrowUpRight,
	IconDownload,
	IconTerminal,
	IconWindow,
} from 'nucleo-micro-bold';

import { DEVTOOLS_ASSETS, DEVTOOLS_RELEASES_URL } from '~/lib/downloads/devtools';
import type { DevToolsAsset, DevToolsOs } from '~/lib/downloads/devtools';
import { staggerStyle } from '~/components/motion/reveal-style';
import Tag from '~/components/tag';

import DevToolsUpdates from './devtools-updates';

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

function DevToolsTile({ asset }: DevToolsTileProps) {
	const info = OS_INFO[asset.os];

	return (
		<a
			href={asset.url}
			download
			className='group/file flex items-center gap-3.5 bg-card hover:bg-accent/40 p-3.5 border rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-halo shadow-surface transition-colors press-flat'
		>
			<span className='flex justify-center items-center bg-accent shadow-key rounded-full size-10 text-foreground shrink-0'>
				<info.icon size={16} aria-hidden />
			</span>
			<span className='flex flex-col gap-0.5 min-w-0 grow'>
				<span className='flex items-center gap-2 font-semibold text-foreground text-sm'>
					{info.label}
					<span className='font-normal text-muted-foreground'>{asset.arch}</span>
					<Tag>{asset.extension}</Tag>
				</span>
				<span className='text-muted-foreground text-xs truncate'>
					Unpacks to <span className='font-mono'>{asset.contents}</span>
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

/**
 * @description The DevTools desktop app's newest archive for each system, for plugin developers, and how it updates.
 * @returns The DevTools download section.
 */
function DevToolsDownloads() {
	return (
		<section aria-labelledby='devtools-heading' className='flex flex-col gap-6 pt-8 border-t'>
			<div
				className='flex flex-wrap justify-between items-end gap-3 animate-reveal'
				style={staggerStyle(FIRST_SLOT)}
			>
				<div className='flex flex-col gap-1 max-w-2xl'>
					<h2 id='devtools-heading' className='font-semibold text-foreground text-xl'>
						DevTools
					</h2>
					<p className='text-muted-foreground text-sm'>
						A desktop app for inspecting Discord's React tree on a connected device.
						Each download is an archive: unpack it, then open the app inside. On macOS
						that is <span className='font-mono text-xs'>Unbound DevTools.app</span>;
						move it to Applications first. Builds are not notarized, so run{' '}
						<code className='font-mono text-xs'>
							xattr -dr com.apple.quarantine "/Applications/Unbound DevTools.app"
						</code>{' '}
						once before opening it.
					</p>
				</div>
				<a
					href={DEVTOOLS_RELEASES_URL}
					target='_blank'
					rel='noopener noreferrer'
					className='inline-flex items-center gap-0.5 text-link text-sm underline-offset-4 hover:underline'
				>
					Older versions
					<IconArrowUpRight size={12} aria-hidden />
				</a>
			</div>
			<div className='gap-3 grid sm:grid-cols-2'>
				{DEVTOOLS_ASSETS.map((asset, index) => (
					<div
						key={asset.url}
						className='grid animate-reveal'
						style={staggerStyle(FIRST_SLOT + 1 + index)}
					>
						<DevToolsTile asset={asset} />
					</div>
				))}
			</div>
			<div
				className='animate-reveal'
				style={staggerStyle(FIRST_SLOT + 1 + DEVTOOLS_ASSETS.length)}
			>
				<DevToolsUpdates />
			</div>
		</section>
	);
}

export default DevToolsDownloads;
