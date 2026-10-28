import { useState } from 'react';

import AddonMdDiffView from '~/components/review/addon-md-diff-view';
import type { AddonMdDiff } from '~/lib/addon-md-diff';
import type { ReviewEntry } from '~/lib/review-entry';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonMdReviewProps = {
	entry: ReviewEntry;
};

type View = 'rendered' | 'changes';

const SUMMARIES: Record<AddonMdDiff['state'], string> = {
	none: 'No ADDON.md; the manifest description is shown.',
	new: 'New ADDON.md',
	unchanged: 'ADDON.md unchanged',
	removed: 'ADDON.md removed; the manifest description is shown.',
	changed: 'ADDON.md changed',
};

const VIEW_LABELS: Record<View, string> = { rendered: 'Rendered', changes: 'Changes' };

/** The submitted ADDON.md, rendered from the stored copy and diffed against the approved one. */
function AddonMdReview({ entry }: AddonMdReviewProps) {
	const { addonMd, addonMdDiff: diff, source } = entry;
	const views: View[] = [
		...(addonMd === null ? [] : ['rendered' as const]),
		...('lines' in diff ? ['changes' as const] : []),
	];
	const [selected, setSelected] = useState<View>(views.at(-1) ?? 'rendered');
	const view = views.includes(selected) ? selected : views[0];

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex flex-wrap items-center gap-2'>
				<Text variant='text-xs' color='muted'>
					{SUMMARIES[diff.state]}
				</Text>
				{views.length > 1 ? (
					<div
						role='tablist'
						className='flex gap-1 bg-muted shadow-field ml-auto p-1 rounded-control'
					>
						{views.map((candidate) => (
							<button
								key={candidate}
								type='button'
								role='tab'
								aria-selected={candidate === view}
								onClick={() => setSelected(candidate)}
								className={cn(
									'px-3 py-1 rounded-item font-semibold text-muted-foreground text-xs press-flat',
									candidate === view &&
										'bg-background text-foreground shadow-surface',
								)}
							>
								{VIEW_LABELS[candidate]}
							</button>
						))}
					</div>
				) : null}
			</div>

			{view === 'rendered' && addonMd !== null ? (
				<div className='p-4 border border-border rounded-control max-h-[32rem] overflow-auto'>
					<Markdown source={addonMd} pin={source} />
				</div>
			) : null}
			{view === 'changes' && 'lines' in diff ? <AddonMdDiffView lines={diff.lines} /> : null}
		</div>
	);
}

export default AddonMdReview;
