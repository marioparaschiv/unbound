const STEPS = [
	'DevTools checks for a new version each time it opens. Turn this off under Settings, Updates.',
	'When one is out, a notice offers it. Press Update; DevTools downloads it and verifies its checksum.',
	'Press Restart. The new version replaces the old one in place, including the whole .app on macOS.',
];

/**
 * @description How the DevTools app keeps itself current, so the download above is needed only once.
 * @returns The updater's explainer.
 */
function DevToolsUpdates() {
	return (
		<section
			aria-labelledby='devtools-updates-heading'
			className='flex flex-col gap-3 bg-card p-4 border rounded-surface shadow-surface'
		>
			<div className='flex flex-col gap-1'>
				<h3 id='devtools-updates-heading' className='font-semibold text-foreground'>
					Updates
				</h3>
				<p className='text-muted-foreground text-sm'>
					Download once. DevTools updates itself from unbound.rip after that.
				</p>
			</div>
			<ol className='flex flex-col gap-2 text-sm'>
				{STEPS.map((step, index) => (
					<li key={step} className='flex gap-3'>
						<span className='flex justify-center items-center bg-accent rounded-full size-5 font-semibold text-foreground text-xs shrink-0'>
							{index + 1}
						</span>
						<span className='text-muted-foreground'>{step}</span>
					</li>
				))}
			</ol>
		</section>
	);
}

export default DevToolsUpdates;
