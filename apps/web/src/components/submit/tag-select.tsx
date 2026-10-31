import { MAX_SUBMISSION_TAGS } from '@unbound-app/contracts/tags';
import type { AddonType } from '@unbound-app/contracts/addons';
import { IconCheck, IconPlus } from 'nucleo-micro-bold';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { TagDot } from '~/components/addon-filters/filter-parts';
import { tagsQuery } from '~/queries/marketplace/tags';
import type { AddonTag } from '~/lib/addon-tags';
import cn from '~/lib/cn';

type TagSelectProps = {
	id: string;
	/** Which listing's tags to offer. */
	type: AddonType;
	/** The chosen tag ids, in menu order. */
	value: string[];
	onChange: (value: string[]) => void;
	disabled: boolean;
};

type TagsState = {
	isPending: boolean;
	isError: boolean;
};

type TagRowProps = {
	tag: AddonTag;
	checked: boolean;
	disabled: boolean;
	onToggle: (id: string) => void;
};

// The same pill tags wear on addon cards, at a fixed height so the cutout trigger lines up with it.
const PILL_CLASS =
	'inline-flex items-center gap-1.5 h-6 px-2 border rounded-full font-medium text-[11px] whitespace-nowrap shrink-0';

const FOCUS_CLASS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-halo';

function getEmptyText({ isPending, isError }: TagsState): string {
	if (isPending) {
		return 'Loading tags...';
	}

	return isError ? 'Could not load tags.' : 'No tags yet.';
}

function TagRow({ tag, checked, disabled, onToggle }: TagRowProps) {
	return (
		<button
			type='button'
			role='menuitemcheckbox'
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onToggle(tag.id)}
			className={cn(
				'relative flex items-center gap-2 py-1.5 pr-2 pl-8 rounded-menu-item corner-continuous w-full text-sm text-left select-none',
				'transition-colors press-flat [--press-depth:0.25] hover:bg-accent/40 focus-visible:bg-accent/40 outline-none',
				'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
			)}
		>
			<span className='left-2 absolute flex justify-center items-center size-4 pointer-events-none'>
				{checked ? <IconCheck size={16} /> : null}
			</span>
			<TagDot color={tag.color} />
			<span className='truncate'>{tag.label}</span>
		</button>
	);
}

/** Picks up to `MAX_SUBMISSION_TAGS` of the site's tags; the menu stays open so several go in one pass. */
function TagSelect({ id, type, value, onChange, disabled }: TagSelectProps) {
	const [open, setOpen] = useState(false);
	const tags = useQuery(tagsQuery(type));
	const options = tags.data ?? [];
	const chosen = new Set(value);
	const selected = options.filter((tag) => chosen.has(tag.id));
	const full = chosen.size >= MAX_SUBMISSION_TAGS;

	function toggle(tagId: string) {
		const next = new Set(chosen);

		if (!next.delete(tagId)) {
			next.add(tagId);
		}

		onChange(options.filter((tag) => next.has(tag.id)).map((tag) => tag.id));
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<div className='flex flex-wrap items-center gap-1.5'>
				{selected.map((tag) => (
					<button
						key={tag.id}
						type='button'
						tabIndex={-1}
						disabled={disabled}
						onClick={() => setOpen(true)}
						className={cn(PILL_CLASS, 'border-border text-muted-foreground press-flat')}
					>
						<TagDot color={tag.color} className='size-1.5' />
						{tag.label}
					</button>
				))}
				<PopoverTrigger
					id={id}
					disabled={disabled}
					aria-label={selected.length > 0 ? 'Edit tags' : 'Add tag'}
					className={cn(
						PILL_CLASS,
						FOCUS_CLASS,
						'bg-transparent border-dashed border-muted-foreground/40 text-muted-foreground transition-colors press-flat',
						'hover:border-muted-foreground/70 hover:text-foreground disabled:opacity-50 disabled:pointer-events-none',
						selected.length > 0 ? 'justify-center px-0 w-6' : null,
					)}
				>
					<IconPlus size={12} />
					{selected.length > 0 ? null : 'Add Tag'}
				</PopoverTrigger>
			</div>
			<PopoverContent align='start' sideOffset={6} className='p-1.5 w-60'>
				<p className='px-2 pt-1 pb-1.5 text-muted-foreground text-xs'>
					{chosen.size} of {MAX_SUBMISSION_TAGS} selected
				</p>
				<div role='menu' aria-label='Tags' className='max-h-64 overflow-y-auto'>
					{options.map((tag) => (
						<TagRow
							key={tag.id}
							tag={tag}
							checked={chosen.has(tag.id)}
							disabled={full && !chosen.has(tag.id)}
							onToggle={toggle}
						/>
					))}
				</div>
				{options.length === 0 ? (
					<p className='px-2 py-4 text-muted-foreground text-sm text-center'>
						{getEmptyText(tags)}
					</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

export default TagSelect;
