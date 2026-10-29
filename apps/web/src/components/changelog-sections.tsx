import type { ChangeType, Changelog } from '@unbound-app/contracts/changelog';
import { CHANGE_LABELS } from '@unbound-app/contracts/changelog';

import type { Tone } from '~/components/dashboard/status';
import { TONES } from '~/components/dashboard/status';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type ChangelogSectionsProps = {
	changelog: Changelog;
};

const CHANGE_TONES: Record<ChangeType, Tone> = {
	added: 'success',
	changed: 'info',
	fixed: 'warning',
	removed: 'danger',
};

/** A release's typed changelog: one marked, labelled list per change type. */
function ChangelogSections({ changelog }: ChangelogSectionsProps) {
	return (
		<div className='flex flex-col gap-3'>
			{changelog.sections.map((section) => (
				<div key={section.type} className='flex flex-col gap-1.5'>
					{/* Small and tinted by change type: the entries under it are what a reader came for. */}
					<Text
						variant='text-xs'
						className={cn(
							'font-medium text-[11px] uppercase tracking-wider',
							TONES[CHANGE_TONES[section.type]].text,
						)}
					>
						{CHANGE_LABELS[section.type]}
					</Text>
					<Text
						as='ul'
						variant='text-sm'
						className='flex flex-col gap-1 pl-5 text-foreground/85 marker:text-muted-foreground/50 list-disc'
					>
						{section.items.map((item, index) => (
							<li key={index}>{item}</li>
						))}
					</Text>
				</div>
			))}
		</div>
	);
}

export default ChangelogSections;
