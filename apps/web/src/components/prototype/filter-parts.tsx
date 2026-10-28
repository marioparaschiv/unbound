import {
	IconCalendar,
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
	IconTag,
	IconUser,
} from 'nucleo-micro-bold';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import type { FilterField, FilterOption, TaggedAddon } from '~/lib/prototype/addon-filters';
import { EndSentinel, SkeletonRows } from '~/components/prototype/skeleton-rows';
import { getTag } from '~/lib/prototype/addon-filters';
import UserAvatar from '~/components/user-avatar';
import cn from '~/lib/cn';

export type CommandItem = {
	key: string;
	label: string;
	mark: ReactNode;
	/** `undefined` renders no checkbox, for rows that navigate instead of toggle. */
	checked?: boolean;
	count?: number;
	/** Muted text before the label, such as the field a cross-field match belongs to. */
	prefix?: string;
	submenu?: boolean;
	onSelect: () => void;
	/** Runs when the row becomes highlighted, by pointer or keyboard; used to prefetch what it opens. */
	onHighlight?: () => void;
};

export type CommandListProps = {
	items: CommandItem[];
	placeholder: string;
	query: string;
	onQueryChange: (query: string) => void;
	/** Backspace in an empty input, Linear's way back to the field list. */
	onBack?: () => void;
	/** Phone layout: 48px rows, 16px text and no autofocus. */
	touch?: boolean;
	/** Skeleton rows shown under the items while the next page loads. */
	pending?: number;
	/** Asks for the next page once the list's end scrolls near; omit when nothing more remains. */
	onEndReached?: () => void;
	/** Every matching row, loaded or not, so a screen reader announces "3 of 54" rather than "3 of 12". */
	total?: number;
	/** False while the view fades out: it stops taking clicks, and coming back refocuses its input. */
	present?: boolean;
};

type FieldIconProps = {
	field: FilterField;
	className?: string;
};

type OptionMarkProps = {
	field: FilterField;
	option: Pick<FilterOption, 'color' | 'avatarUrl' | 'label'>;
	/** Menu rows show avatars larger than chips do; touch rows larger still. */
	size?: 'sm' | 'md' | 'lg';
};

const AVATAR_SIZES = { sm: 'size-4 text-[8px]', md: 'size-5 text-[10px]', lg: 'size-6 text-xs' };

type TagDotProps = {
	color: string;
	className?: string;
};

type TagListProps = {
	addon: TaggedAddon;
};

const FIELD_ICONS = { tag: IconTag, author: IconUser, updated: IconCalendar };

/**
 * @description The icon that stands for a filter field.
 * @param props The field and extra classes.
 * @returns The icon.
 */
export function FieldIcon({ field, className }: FieldIconProps) {
	const Icon = FIELD_ICONS[field];

	return <Icon className={cn('size-3.5 text-muted-foreground shrink-0', className)} />;
}

/**
 * @description A tag's colour dot.
 * @param props The Tailwind background class and extra classes.
 * @returns The dot.
 */
export function TagDot({ color, className }: TagDotProps) {
	return <span className={cn('rounded-full size-2 shrink-0', color, className)} />;
}

/**
 * @description The mark before an option: a tag dot, an author avatar or the field icon.
 * @param props The field and the option.
 * @returns The mark.
 */
export function OptionMark({ field, option, size = 'sm' }: OptionMarkProps) {
	if (option.color) {
		return <TagDot color={option.color} className={size === 'lg' ? 'size-2.5' : undefined} />;
	}

	if (option.avatarUrl) {
		return (
			<UserAvatar
				src={option.avatarUrl}
				name={option.label}
				size='xs'
				className={AVATAR_SIZES[size]}
			/>
		);
	}

	return <FieldIcon field={field} className={size === 'lg' ? 'size-5' : undefined} />;
}

/**
 * @description The tags under an addon card, each a coloured dot and its name.
 * @param props The addon whose tags to show.
 * @returns The tag row.
 */
export function TagList({ addon }: TagListProps) {
	return (
		<div className='flex gap-1.5 min-w-0 overflow-hidden'>
			{addon.tags.map((id) => {
				const tag = getTag(id);

				if (!tag) return null;

				return (
					<span
						key={id}
						className='inline-flex items-center gap-1.5 px-2 py-0.5 border border-border rounded-full font-medium text-[11px] text-muted-foreground'
					>
						<TagDot color={tag.color} className='size-1.5' />
						{tag.label}
					</span>
				);
			})}
		</div>
	);
}

/**
 * @description A Linear-style command list: a search input over keyboard-navigable rows.
 * @param props The rows, the controlled query and the back handler.
 * @returns The list.
 */
export function CommandList({
	items,
	placeholder,
	query,
	onQueryChange,
	onBack,
	touch = false,
	pending = 0,
	onEndReached,
	total,
	present = true,
}: CommandListProps) {
	const [active, setActive] = useState(0);
	const input = useRef<HTMLInputElement>(null);

	// `autoFocus` would scroll the menu's clipped box to the new view mid-animation; this focuses in place.
	useLayoutEffect(() => {
		// On a phone, focusing would raise the keyboard over the list the user came to tap.
		if (present && !touch) {
			input.current?.focus({ preventScroll: true });
		}
	}, [present, touch]);
	const needle = query.trim().toLowerCase();
	const visible = needle
		? items.filter((item) =>
				`${item.prefix ?? ''} ${item.label}`.toLowerCase().includes(needle),
			)
		: items;
	const current = Math.min(active, Math.max(visible.length - 1, 0));
	const list = useRef<HTMLDivElement>(null);
	const listId = useId();
	const highlighted = visible[current];

	// Only a move of the highlight scrolls; a page arriving must not yank the list back to it.
	useLayoutEffect(() => {
		list.current?.querySelector('[data-active=true]')?.scrollIntoView({ block: 'nearest' });
	}, [current]);

	useEffect(() => {
		if (present) {
			highlighted?.onHighlight?.();
		}
	}, [present, highlighted]);

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();

			const step = event.key === 'ArrowDown' ? 1 : -1;

			setActive((current + step + visible.length) % Math.max(visible.length, 1));

			return;
		}

		const item = visible[current];

		// Right opens a field the way Enter does, but never toggles a value.
		if (event.key === 'Enter' || (event.key === 'ArrowRight' && item?.submenu)) {
			event.preventDefault();
			item?.onSelect();

			return;
		}

		// Left and Backspace only go back from an empty input, so they still edit the query.
		const back = event.key === 'Backspace' || event.key === 'ArrowLeft';

		if (!(back && query === '' && onBack)) return;

		event.preventDefault();
		onBack();
	}

	return (
		<div className={cn('flex flex-col', present ? null : 'pointer-events-none')}>
			<div className='flex items-center gap-1 border-b border-border'>
				{onBack && !touch ? (
					<button
						type='button'
						aria-label='Back to filters'
						title='Back (← or Backspace)'
						onClick={onBack}
						className={cn(
							'flex justify-center items-center outline-none text-muted-foreground hover:text-foreground focus-visible:text-foreground transition-colors shrink-0',
							touch ? 'ml-1 size-11' : 'ml-2 size-8',
						)}
					>
						<IconChevronLeft className={touch ? 'size-5' : 'size-4'} />
					</button>
				) : null}
				<input
					ref={input}
					role='combobox'
					aria-expanded
					aria-controls={listId}
					aria-activedescendant={highlighted ? `${listId}-${highlighted.key}` : undefined}
					value={query}
					placeholder={placeholder}
					onChange={(event) => {
						onQueryChange(event.target.value);
						setActive(0);
					}}
					onKeyDown={handleKeyDown}
					className={cn(
						'flex-1 bg-transparent pr-4 outline-none min-w-0 placeholder:text-muted-foreground',
						// 16px text keeps iOS from zooming the page when the field gains focus.
						touch ? 'h-12 text-base' : 'h-11 text-sm',
						touch ? 'pl-5' : onBack ? 'pl-1' : 'pl-4',
					)}
				/>
			</div>
			<div
				ref={list}
				id={listId}
				role='listbox'
				aria-multiselectable
				aria-busy={pending > 0}
				className={cn(
					// Contained: reaching the end of the list must not hand the wheel or swipe on to the page behind it.
					'flex flex-col p-1.5 overflow-y-auto overscroll-contain',
					touch ? 'max-h-[60dvh]' : 'max-h-72',
				)}
			>
				{visible.length === 0 && pending === 0 ? (
					<div
						className={cn(
							'flex justify-center items-center px-2 py-3 text-muted-foreground text-sm text-center shrink-0',
							// A paged list's search swaps a page of skeletons for this, so it fills the list's full height
							// (its max height less the 12px padding and the 1px end marker) instead of collapsing the menu.
							total === undefined
								? null
								: touch
									? 'h-[calc(60dvh-0.75rem-1px)]'
									: 'h-[calc(18rem-0.75rem-1px)]',
						)}
					>
						No results
					</div>
				) : null}
				{visible.map((item, index) => (
					<button
						key={item.key}
						id={`${listId}-${item.key}`}
						type='button'
						role='option'
						aria-selected={item.checked ?? false}
						aria-posinset={index + 1}
						aria-setsize={total ?? visible.length}
						data-active={index === current}
						onMouseMove={touch ? undefined : () => setActive(index)}
						// The browser re-hit-tests after the view swaps under a still pointer; enter picks that row up.
						onMouseEnter={touch ? undefined : () => setActive(index)}
						onClick={item.onSelect}
						className={cn(
							'flex items-center rounded-menu-item corner-continuous outline-none text-left cursor-default',
							// Touch rows are 48px tall, past the 44px minimum, and press like the site's buttons.
							touch
								? 'gap-3 active:bg-accent px-3.5 h-12 text-base transition-colors shrink-0'
								: 'gap-2 data-[active=true]:bg-accent px-2 h-8 text-sm shrink-0',
						)}
					>
						{item.checked === undefined ? null : (
							<span
								className={cn(
									'flex justify-center items-center border shrink-0',
									touch ? 'rounded-[6px] size-5' : 'rounded-[4px] size-3.5',
									item.checked
										? 'bg-primary border-primary text-primary-foreground'
										: 'border-muted-foreground/40',
								)}
							>
								{item.checked ? (
									<IconCheck className={touch ? 'size-3.5' : 'size-2.5'} />
								) : null}
							</span>
						)}
						{item.mark}
						{item.prefix ? (
							<span className='text-muted-foreground'>{item.prefix}</span>
						) : null}
						<span className='flex-1 truncate'>{item.label}</span>
						{item.count === undefined ? null : (
							<span
								className={cn(
									'tabular-nums text-muted-foreground',
									touch ? 'text-sm' : 'text-xs',
								)}
							>
								{item.count}
							</span>
						)}
						{item.submenu ? (
							<IconChevronRight
								className={cn(
									'text-muted-foreground',
									touch ? 'size-5' : 'size-3.5',
								)}
							/>
						) : null}
					</button>
				))}
				<SkeletonRows count={pending} touch={touch} />
				{/* Keyed by row count: a remount re-observes, so a page that still leaves the end in view asks for the next. */}
				<EndSentinel
					key={visible.length}
					onReached={pending === 0 ? onEndReached : undefined}
				/>
			</div>
		</div>
	);
}

export default { FieldIcon, TagDot, OptionMark, TagList, CommandList };
