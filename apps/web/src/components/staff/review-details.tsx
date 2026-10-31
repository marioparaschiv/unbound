import { IconDownload, IconSquareCode } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import ManifestDiffTable from '~/components/review/manifest-diff-table';
import AddonMdDiffView from '~/components/review/addon-md-diff-view';
import type { FieldDiff, ReviewEntry } from '~/lib/review-entry';
import ChangelogSections from '~/components/changelog-sections';
import { getBundleUrl, shortSha } from '~/lib/github-urls';
import SourcePinLink from '~/components/source-pin-link';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';

type ReviewDetailsProps = {
	entry: ReviewEntry;
};

type SectionTitleProps = {
	title: string;
	summary: string;
};

type ChangedFieldsProps = {
	rows: FieldDiff[];
	previousVersion: string;
};

type Section = {
	id: string;
	title: string;
	summary: string;
	body: ReactNode;
};

function SectionTitle({ title, summary }: SectionTitleProps) {
	return (
		<span className='flex flex-1 items-baseline gap-2 min-w-0'>
			<span className='font-semibold'>{title}</span>
			<span className='font-normal text-muted-foreground truncate'>{summary}</span>
		</span>
	);
}

/** Only the manifest fields an update changed, old value over new. */
function ChangedFields({ rows, previousVersion }: ChangedFieldsProps) {
	if (rows.length === 0) {
		return (
			<Text variant='text-sm' color='muted'>
				Nothing changed besides the version.
			</Text>
		);
	}

	return (
		<div className='border rounded-control overflow-x-auto'>
			<table className='w-full text-sm'>
				<thead className='bg-muted/50 border-b text-muted-foreground'>
					<tr>
						<th className='px-3 py-2 font-medium text-left'>Field</th>
						<th className='px-3 py-2 font-medium text-left'>{previousVersion}</th>
						<th className='px-3 py-2 font-medium text-left'>Submitted</th>
					</tr>
				</thead>
				<tbody className='divide-y'>
					{rows.map((row) => (
						<tr key={row.field}>
							<td className='px-3 py-2 font-medium whitespace-nowrap align-top'>
								{row.field}
							</td>
							<td className='px-3 py-2 font-mono text-muted-foreground text-xs line-through break-all align-top'>
								{row.previous ?? 'Not set'}
							</td>
							<td className='px-3 py-2 font-mono text-xs break-all align-top'>
								{row.next ?? 'Not set'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * @description Builds the review sections a submission needs; an update drops whatever it left unchanged.
 * @param entry The queued submission.
 * @returns The sections, in reading order.
 */
function buildSections(entry: ReviewEntry): Section[] {
	const { previousVersion, addonMd, addonMdDiff: diff, changelog, source } = entry;
	const sections: Section[] = [];

	if (changelog) {
		const count = changelog.sections.reduce(
			(total, section) => total + section.items.length,
			0,
		);

		sections.push({
			id: 'changelog',
			title: 'Changelog',
			summary: `${count} ${count === 1 ? 'entry' : 'entries'}`,
			body: <ChangelogSections changelog={changelog} />,
		});
	}

	if (previousVersion) {
		const changed = entry.fields.filter((row) => row.changed && row.field !== 'version');

		sections.push({
			id: 'manifest',
			title: 'Manifest changes',
			summary: `${changed.length} since ${previousVersion}`,
			body: <ChangedFields rows={changed} previousVersion={previousVersion} />,
		});
	} else {
		sections.push({
			id: 'manifest',
			title: 'Manifest details',
			summary: `${entry.fields.length} fields`,
			body: <ManifestDiffTable entry={entry} />,
		});
	}

	if (previousVersion && 'lines' in diff) {
		sections.push({
			id: 'addon-md',
			title: 'ADDON.md',
			summary: diff.state === 'removed' ? 'removed, the description is shown' : 'changed',
			body: <AddonMdDiffView lines={diff.lines} />,
		});
	} else if (previousVersion && diff.state === 'new' && addonMd) {
		sections.push({
			id: 'addon-md',
			title: 'ADDON.md',
			summary: 'added',
			body: (
				<div className='p-4 border rounded-control max-h-[32rem] overflow-auto'>
					<Markdown source={addonMd} pin={source} />
				</div>
			),
		});
	} else if (!previousVersion) {
		sections.push({
			id: 'addon-md',
			title: 'ADDON.md',
			summary: addonMd ? 'included' : 'none, the description is shown',
			body: addonMd ? (
				<div className='p-4 border rounded-control max-h-[32rem] overflow-auto'>
					<Markdown source={addonMd} pin={source} />
				</div>
			) : (
				<Text variant='text-sm' color='muted'>
					The store page shows the manifest description instead.
				</Text>
			),
		});
	}

	sections.push({
		id: 'source',
		title: 'Source and bundle',
		summary: `${source.path || '/'} at ${shortSha(source.commitSha)}`,
		body: (
			<div className='flex flex-col gap-3'>
				<Text variant='text-sm' color='muted' className='break-all'>
					<SourcePinLink pin={source} /> · {source.path || '/'} · {source.ref}
				</Text>
				<div className='flex flex-wrap gap-2'>
					<Button asChild variant='outline' size='sm'>
						<a href={entry.artifact.url} target='_blank' rel='noopener noreferrer'>
							<IconDownload />
							Download staged bundle
						</a>
					</Button>
					<Button asChild variant='outline' size='sm'>
						<a href={getBundleUrl(source)} target='_blank' rel='noopener noreferrer'>
							<IconSquareCode />
							Bundle at {shortSha(source.commitSha)}
						</a>
					</Button>
				</div>
			</div>
		),
	});

	return sections;
}

/** The review sections of a submission as an accordion that keeps one section open at a time. */
function ReviewDetails({ entry }: ReviewDetailsProps) {
	const sections = buildSections(entry);
	const first = entry.previousVersion
		? sections.find((section) => section.id === 'manifest')
		: sections[0];

	return (
		<Accordion type='single' collapsible defaultValue={first?.id}>
			{sections.map((section) => (
				<AccordionItem key={section.id} value={section.id}>
					<AccordionTrigger className='hover:no-underline'>
						<SectionTitle title={section.title} summary={section.summary} />
					</AccordionTrigger>
					<AccordionContent>{section.body}</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}

export default ReviewDetails;
