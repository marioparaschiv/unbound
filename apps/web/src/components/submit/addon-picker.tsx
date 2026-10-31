import type { ListRepositoryAddonsResponse, RepositoryAddon } from '@unbound-app/contracts/source';
import {
	IconBox,
	IconCheck,
	IconCircleCheck,
	IconCodeBranch,
	IconRefresh,
} from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '~/components/ui/input-group';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import {
	repositoryAddonsQuery,
	submissionPreviewQuery,
	toPreviewRequest,
} from '~/queries/submissions/submissions';
import { SubmitCallout, SubmitIssue } from '~/components/submit/submit-callout';
import { SubmitSection } from '~/components/submit/submit-section';
import type { PreviewRequest } from '~/queries/submissions/submissions';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import type { ApiErrorDetails } from '~/lib/api/error-details';
import { getTreeUrl, shortSha } from '~/lib/github-urls';
import { Field, FieldLabel } from '~/components/ui/field';
import { TONES } from '~/components/dashboard/status';
import AddonIcon from '~/components/addon-icon';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonPickerProps = {
	listing: ListRepositoryAddonsResponse;
	lockedAddonId?: string;
	selected: string | null;
	disabled: boolean;
	/** What the picker last asked for, while it loads. */
	busy: 'ref' | 'preview' | null;
	/** Why the last read or preview failed. */
	error: ApiErrorDetails | null;
	onRefChange: (ref: string) => void;
	onPick: (addon: RepositoryAddon) => void;
};

type AddonOptionProps = {
	addon: RepositoryAddon;
	/** The preview the Select button reads, or `null` when the addon cannot be previewed. */
	request: PreviewRequest | null;
	selected: boolean;
	busy: boolean;
	disabled: boolean;
	onPick: () => void;
};

type AddonOptionsProps = Pick<
	AddonPickerProps,
	'listing' | 'lockedAddonId' | 'selected' | 'disabled' | 'busy' | 'onPick'
>;

type SkippedDirectoriesProps = {
	listing: ListRepositoryAddonsResponse;
};

const LINK_CLASS = 'font-mono underline-offset-4 hover:underline';

function AddonOption({ addon, request, selected, busy, disabled, onPick }: AddonOptionProps) {
	const prefetch = usePrefetchIntent(submissionPreviewQuery(request));
	const [issue] = addon.issues;
	const dimmed = Boolean(issue) || addon.upToDate;

	return (
		<li>
			<button
				type='button'
				disabled={disabled}
				aria-pressed={selected}
				onClick={onPick}
				className={cn(
					'flex items-center gap-3 px-3 py-2.5 rounded-control w-full text-left transition-colors press-flat [--press-depth:0.25]',
					'hover:bg-accent/40 disabled:hover:bg-transparent disabled:cursor-not-allowed',
					'outline-none focus-visible:ring-[3px] focus-visible:ring-halo',
					selected ? 'bg-accent hover:bg-accent' : null,
				)}
				{...prefetch}
			>
				<span
					className={cn(
						'flex justify-center items-center rounded-control size-9 shrink-0 transition-colors',
						selected ? 'bg-background/60' : 'bg-accent',
						dimmed ? 'opacity-50' : null,
					)}
				>
					<AddonIcon type={addon.kind} svg={null} className='size-4.5' />
				</span>

				<span className='flex flex-col flex-1 min-w-0'>
					<span className='flex items-baseline gap-2 min-w-0'>
						<Text
							as='span'
							variant='text-sm'
							className={cn('font-semibold truncate', dimmed ? 'opacity-60' : null)}
						>
							{addon.name ?? addon.id}
						</Text>
						{addon.version ? (
							<Text as='span' variant='text-xs' color='muted' className='font-mono'>
								v{addon.version}
							</Text>
						) : null}
					</span>
					{issue ? (
						<SubmitIssue issue={issue} />
					) : (
						<Text
							as='span'
							variant='text-xs'
							color='muted'
							className='font-mono truncate'
						>
							{addon.id}
						</Text>
					)}
				</span>

				{addon.upToDate && !issue ? (
					<span
						className={cn(
							'flex items-center gap-1 text-xs shrink-0',
							TONES.success.text,
						)}
					>
						<IconCheck size={12} />
						Up to date
					</span>
				) : (
					<span
						aria-hidden
						className={cn(
							'flex justify-center items-center border rounded-full size-5 shrink-0 transition-colors',
							selected ? 'bg-primary border-primary text-primary-foreground' : null,
							issue ? 'opacity-0' : null,
						)}
					>
						{busy ? (
							<Spinner className='size-3' />
						) : selected ? (
							<IconCheck className='size-3' />
						) : null}
					</span>
				)}
			</button>
		</li>
	);
}

function AddonOptions({
	listing,
	lockedAddonId,
	selected,
	disabled,
	busy,
	onPick,
}: AddonOptionsProps) {
	if (listing.addons.length === 0) {
		return (
			<Empty className='border p-6 md:p-6'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconBox />
					</EmptyMedia>
					<EmptyTitle>No addons found</EmptyTitle>
					<EmptyDescription>
						{listing.repository} registers no addons at this commit.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const locked = listing.addons.find((addon) => addon.id === lockedAddonId);

	if (locked?.upToDate) {
		return (
			<Empty className='p-6 md:p-6'>
				<EmptyHeader>
					<EmptyMedia variant='icon' className={TONES.success.text}>
						<IconCircleCheck />
					</EmptyMedia>
					<EmptyTitle>Everything is up to date</EmptyTitle>
					<EmptyDescription>
						Bump the version in manifest.json and commit it to submit an update.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<ul className='flex flex-col gap-1'>
			{listing.addons.map((addon) => (
				<AddonOption
					key={addon.path}
					addon={addon}
					request={toPreviewRequest(listing, addon.path)}
					selected={selected === addon.path}
					busy={busy === 'preview' && selected === addon.path}
					disabled={
						disabled ||
						addon.issues.length > 0 ||
						addon.upToDate ||
						(lockedAddonId !== undefined && addon.id !== lockedAddonId)
					}
					onPick={() => onPick(addon)}
				/>
			))}
		</ul>
	);
}

function SkippedDirectories({ listing }: SkippedDirectoriesProps) {
	const count = listing.skipped.length;

	return (
		<Accordion type='single' collapsible className='mt-2 border-t'>
			<AccordionItem value='skipped'>
				<AccordionTrigger className='pb-0 text-muted-foreground'>
					{count === 1 ? '1 directory skipped' : `${count} directories skipped`}
				</AccordionTrigger>
				<AccordionContent className='flex flex-col gap-1 pt-3 pb-0'>
					{listing.skipped.map((entry) => (
						<Text key={entry.path} variant='text-xs' color='muted'>
							<a
								href={getTreeUrl({ ...listing, path: entry.path })}
								target='_blank'
								rel='noopener noreferrer'
								className={LINK_CLASS}
							>
								{entry.path || '/'}
							</a>
							: {entry.reason}
						</Text>
					))}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function AddonPicker({
	listing,
	lockedAddonId,
	selected,
	disabled,
	busy,
	error,
	onRefChange,
	onPick,
}: AddonPickerProps) {
	const id = useId();
	const release = listing.details.latestRelease?.tag;
	const releaseSource =
		release && release !== listing.ref
			? { repository: listing.repository, ref: release }
			: null;
	const prefetchRelease = usePrefetchIntent(repositoryAddonsQuery(releaseSource));
	const form = useForm({
		defaultValues: { ref: listing.ref },
		onSubmit: ({ value }) => onRefChange(value.ref),
	});

	const description = (
		<>
			Read at{' '}
			<a
				href={getTreeUrl({ ...listing, path: '' })}
				target='_blank'
				rel='noopener noreferrer'
				className={LINK_CLASS}
			>
				{shortSha(listing.commitSha)}
			</a>
			{releaseSource ? (
				<>
					{' · '}Latest release{' '}
					<Button
						type='button'
						variant='link'
						className='px-0 h-auto font-mono text-sm'
						disabled={disabled}
						onClick={() => {
							form.setFieldValue('ref', releaseSource.ref);
							void form.handleSubmit();
						}}
						{...prefetchRelease}
					>
						{releaseSource.ref}
					</Button>
				</>
			) : null}
		</>
	);

	return (
		<SubmitSection title='Addon' description={description}>
			<div className='flex flex-col gap-5'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field name='ref'>
						{(field) => (
							<Field>
								<FieldLabel htmlFor={`${id}-ref`} className='sr-only'>
									Branch, tag or commit
								</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<IconCodeBranch />
									</InputGroupAddon>
									<InputGroupInput
										id={`${id}-ref`}
										value={field.state.value}
										onChange={(event) => field.handleChange(event.target.value)}
										onBlur={field.handleBlur}
										placeholder='Branch, tag or commit'
										className='font-mono'
										disabled={disabled}
										required
									/>
									<InputGroupAddon align='inline-end'>
										<InputGroupButton
											type='submit'
											size='sm'
											disabled={disabled}
										>
											{busy === 'ref' ? (
												<Spinner />
											) : (
												<IconRefresh size={24} />
											)}
											Read
										</InputGroupButton>
									</InputGroupAddon>
								</InputGroup>
							</Field>
						)}
					</form.Field>
				</form>

				<AddonOptions
					listing={listing}
					lockedAddonId={lockedAddonId}
					selected={selected}
					disabled={disabled}
					busy={busy}
					onPick={onPick}
				/>

				<SubmitCallout error={error} />
			</div>

			{listing.skipped.length > 0 ? <SkippedDirectories listing={listing} /> : null}
		</SubmitSection>
	);
}

export default AddonPicker;
