import { getRouteApi, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { IconArchive } from 'nucleo-micro-bold';
import { useEffect, useState } from 'react';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { reviewQueueQuery } from '~/queries/review/review';
import PageHeader from '~/components/page-header';
import Spinner from '~/components/ui/spinner';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

import ReviewPane from './review-pane';

const FILTERS = [
	{ label: 'All', value: 'all', kind: undefined },
	{ label: 'New listings', value: 'listing', kind: 'listing' },
	{ label: 'Updates', value: 'update', kind: 'update' },
] as const;

const NEXT_KEYS = new Set(['j', 'ArrowDown']);

const PREV_KEYS = new Set(['k', 'ArrowUp']);

const route = getRouteApi('/_site/_staff/lab/$variant/review');

function formatAge(value: Date | string): string {
	const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));

	if (minutes < 60) {
		return `${minutes}m`;
	}

	const hours = Math.round(minutes / 60);

	if (hours < 48) {
		return `${hours}h`;
	}

	return `${Math.round(hours / 24)}d`;
}

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

function ReviewPage() {
	const search = route.useSearch();
	const { variant } = route.useParams();
	const { kind } = search;
	const { data: entries, isPlaceholderData } = useQuery(reviewQueueQuery(search));
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [paneOpen, setPaneOpen] = useState(false);
	const ids = entries?.map((entry) => entry.submission.id) ?? [];
	const index = Math.max(0, selectedId ? ids.indexOf(selectedId) : 0);
	const selected = entries?.[index];

	// Plain keys move through the queue unless a field or a dialog has focus.
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;

			if (document.querySelector('[role=dialog], [role=alertdialog]')) return;

			const step = NEXT_KEYS.has(event.key) ? 1 : PREV_KEYS.has(event.key) ? -1 : 0;

			if (step === 0 || ids.length === 0) return;

			event.preventDefault();

			const next = ids[Math.min(ids.length - 1, Math.max(0, index + step))];

			setSelectedId(next ?? null);
			document.getElementById(`lab-a-queue-${next}`)?.scrollIntoView({ block: 'nearest' });
		}

		window.addEventListener('keydown', onKey);

		return () => window.removeEventListener('keydown', onKey);
	}, [ids, index]);

	return (
		<div className='flex flex-col gap-6 pb-24'>
			<PageHeader
				title='Review Queue'
				description='Pick a submission on the left, check it on the right, then decide at the bottom.'
			/>

			{!entries ? <Spinner className='m-auto size-6' /> : null}

			{entries ? (
				<div className='items-start gap-4 grid md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]'>
					<div className={cn('flex flex-col gap-3', paneOpen ? 'hidden md:flex' : null)}>
						<div className='flex items-center gap-2'>
							<Segmented value={kind ?? 'all'}>
								{FILTERS.map((filter) => (
									<SegmentedItem
										key={filter.value}
										value={filter.value}
										className='px-3 text-sm'
										asChild
									>
										<Link
											to='/lab/$variant/review'
											params={{ variant }}
											search={{ kind: filter.kind }}
										>
											<span className='relative'>{filter.label}</span>
										</Link>
									</SegmentedItem>
								))}
							</Segmented>
							{isPlaceholderData ? <Spinner /> : null}
						</div>

						{entries.length === 0 ? null : (
							<Card className='gap-0 p-1.5'>
								<ul className='flex flex-col gap-0.5' aria-label='Submissions'>
									{entries.map((entry) => {
										const active = entry === selected;

										return (
											<li key={entry.submission.id}>
												<button
													id={`lab-a-queue-${entry.submission.id}`}
													type='button'
													aria-current={active}
													onClick={() => {
														setSelectedId(entry.submission.id);
														setPaneOpen(true);
													}}
													className={cn(
														'flex flex-col gap-0.5 hover:bg-accent/50 px-3 py-2 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo w-full text-left press-flat',
														active ? 'bg-accent' : null,
													)}
												>
													<span className='flex items-center gap-2'>
														<span className='flex-1 font-semibold text-sm truncate'>
															{entry.name}
														</span>
														<span
															suppressHydrationWarning
															className='text-muted-foreground text-xs tabular-nums'
														>
															{formatAge(entry.submittedAt)}
														</span>
													</span>
													<span className='flex items-center gap-2 text-muted-foreground text-xs'>
														<span className='font-mono truncate'>
															{entry.submission.version}
														</span>
														<span>·</span>
														<span
															className={
																entry.submission.kind === 'listing'
																	? 'text-primary'
																	: undefined
															}
														>
															{entry.submission.kind === 'listing'
																? 'New listing'
																: 'Update'}
														</span>
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							</Card>
						)}
						{entries.length > 1 ? (
							<Text variant='text-xs' color='muted' className='hidden md:block px-1'>
								Press J and K, or the arrow keys, to move through the queue.
							</Text>
						) : null}
					</div>

					{selected ? (
						<ReviewPane
							key={selected.submission.id}
							entry={selected}
							onBack={() => setPaneOpen(false)}
							className={paneOpen ? 'flex' : 'hidden md:flex'}
						/>
					) : (
						<Empty className='md:col-span-2 border'>
							<EmptyHeader>
								<EmptyMedia variant='icon'>
									<IconArchive size={24} />
								</EmptyMedia>
								<EmptyTitle>Nothing to review</EmptyTitle>
								<EmptyDescription>
									{kind
										? 'No submissions of this kind are waiting.'
										: 'The queue is empty.'}
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
			) : null}
		</div>
	);
}

export default ReviewPage;
