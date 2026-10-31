import type { ListRepositoryAddonsResponse, RepositoryAddon } from '@unbound-app/contracts/source';
import { IconBox, IconCheck, IconCodeBranch, IconRefresh } from 'nucleo-micro-bold';
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
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { SubmitSection } from '~/components/submit/submit-section';
import type { PreviewRequest } from '~/queries/submissions/submissions';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import { getTreeUrl, shortSha } from '~/lib/github-urls';
import AddonIcon from '~/components/addon-icon';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type AddonPickerProps = {
	listing: ListRepositoryAddonsResponse;
	lockedAddonId?: string;
	selected: string | null;
	disabled: boolean;
	/** What the picker last asked for, while it loads. */
	busy: 'ref' | 'preview' | null;
	/** Why the last read or preview failed. */
	error: string | null;
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

type SkippedDirectoriesProps = {
	listing: ListRepositoryAddonsResponse;
};

const LINK_CLASS = 'font-mono underline-offset-4 hover:underline';

function AddonOption({ addon, request, selected, busy, disabled, onPick }: AddonOptionProps) {
	const prefetch = usePrefetchIntent(submissionPreviewQuery(request));

	return (
		<li className='flex items-center gap-4 py-4 first:pt-0 last:pb-0'>
			<div
				className={cn(
					'hidden sm:flex justify-center items-center bg-accent rounded-control size-10 shrink-0',
					addon.issues.length > 0 ? 'opacity-60' : null,
				)}
			>
				<AddonIcon type={addon.kind} svg={null} className='size-5' />
			</div>

			<div className='flex flex-col flex-1 gap-1 min-w-0'>
				<div className='flex flex-wrap items-center gap-2'>
					<Text as='span' variant='text-md' className='font-semibold'>
						{addon.name ?? addon.id}
					</Text>
					<Tag className='capitalize'>{addon.kind}</Tag>
				</div>
				<Text variant='text-xs' color='muted' className='truncate'>
					<span className='font-mono'>{addon.id}</span>
					{addon.version ? ` · ${addon.version}` : null}
				</Text>
				<Text variant='text-xs' color='muted' className='font-mono break-all'>
					{addon.bundle}
				</Text>
				{addon.issues.map((issue) => (
					<Text key={issue} variant='text-xs' color='destructive'>
						{issue}
					</Text>
				))}
			</div>

			<Button
				type='button'
				size='sm'
				variant={selected ? 'default' : 'outline'}
				disabled={disabled}
				aria-pressed={selected}
				onClick={onPick}
				className='shrink-0'
				{...prefetch}
			>
				{busy ? <Spinner /> : selected ? <IconCheck size={24} /> : null}
				{selected ? 'Selected' : 'Select'}
			</Button>
		</li>
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

				{listing.addons.length === 0 ? (
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
				) : (
					<ul className='flex flex-col divide-y'>
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
									(lockedAddonId !== undefined && addon.id !== lockedAddonId)
								}
								onPick={() => onPick(addon)}
							/>
						))}
					</ul>
				)}

				<FieldError className='whitespace-pre-wrap'>{error}</FieldError>
			</div>

			{listing.skipped.length > 0 ? <SkippedDirectories listing={listing} /> : null}
		</SubmitSection>
	);
}

export default AddonPicker;
