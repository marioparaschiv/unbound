import { animated, useReducedMotion, useTransition } from '@react-spring/web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddonType } from '@unbound-app/contracts/addons';
import { cloneElement, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { IconChevronLeft } from 'nucleo-micro-bold';

import {
	BottomSheet,
	BottomSheetClose,
	BottomSheetContent,
	BottomSheetTitle,
	BottomSheetTrigger,
} from '~/components/ui/bottom-sheet';
import {
	FIELD_ORDER,
	FIELDS,
	tagOptions,
	toggleFilterValue,
	UPDATED_WINDOWS,
	type AddonFilter,
	type FilterField,
	type FilterOption,
} from '~/lib/addon-filters';
import MorphHeight, { MORPH_EXPO, MORPH_SPRING } from '~/components/addon-filters/morph-height';
import { CommandList, FieldIcon, OptionMark } from '~/components/addon-filters/filter-parts';
import type { CommandItem, CommandListProps } from '~/components/addon-filters/filter-parts';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import useAuthorPages from '~/queries/marketplace/use-author-pages';
import { authorsQuery } from '~/queries/marketplace/authors';
import { tagsQuery } from '~/queries/marketplace/tags';
import { buttonVariants } from '~/components/ui/button';
import useIsMobile from '~/hooks/use-is-mobile';
import cn from '~/lib/cn';

type MenuView = {
	key: string;
	list: ReactElement<CommandListProps>;
};

type ViewStyle = {
	opacity: number;
	blur: number;
};

// Enough to soften the swap without smearing the text it passes through.
const VIEW_BLUR = 3;

type FilterMenuProps = {
	/** The listing's addon type, which scopes the tag counts and the author search. */
	type: AddonType;
	filters: AddonFilter[];
	onChange: (filters: AddonFilter[]) => void;
	/** Opens straight into one field's values, as a chip's value segment does. */
	field?: FilterField;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	triggerClassName: string;
	triggerLabel: string;
	children: ReactNode;
};

/** Linear's filter menu: pick a field, then tick its values; typing at the top level searches every value. */
function FilterMenu({
	type,
	filters,
	onChange,
	field: fixedField,
	open,
	onOpenChange,
	triggerClassName,
	triggerLabel,
	children,
}: FilterMenuProps) {
	const [field, setField] = useState<FilterField | null>(fixedField ?? null);
	const [query, setQuery] = useState('');
	const reduced = useReducedMotion();
	const mobile = useIsMobile();
	// Authors can run to thousands, so their list pages in from the server instead of arriving whole.
	// Typing at the top level searches them through the same endpoint.
	const authors = useAuthorPages(
		type,
		open && (field === 'author' || (field === null && query.trim() !== '')),
		query,
	);
	const tags = useQuery({ ...tagsQuery(type), select: tagOptions });
	const queryClient = useQueryClient();
	const options: Record<FilterField, FilterOption[]> = {
		tag: tags.data ?? [],
		author: authors.options,
		updated: UPDATED_WINDOWS,
	};

	// Fills the cache the Author view reads, so opening it after a hover shows rows, not skeletons.
	function prefetchAuthors() {
		void queryClient.prefetchInfiniteQuery(authorsQuery(type, ''));
	}

	// Phones have no hover to predict a tap, so the sheet warms the author list as it opens.
	useEffect(() => {
		if (open && mobile) {
			void queryClient.prefetchInfiniteQuery(authorsQuery(type, ''));
		}
	}, [open, mobile, queryClient, type]);

	function changeOpen(next: boolean) {
		onOpenChange(next);

		if (next) return;

		setField(fixedField ?? null);
		setQuery('');
	}

	function valueItems(target: FilterField, prefixed: boolean): CommandItem[] {
		const picked = filters.find((filter) => filter.field === target)?.values ?? [];

		return options[target].map((option) => ({
			key: `${target}:${option.value}`,
			label: option.label,
			prefix: prefixed ? `${FIELDS[target].label} ›` : undefined,
			mark: <OptionMark field={target} option={option} size={mobile ? 'lg' : 'md'} />,
			checked: picked.includes(option.value),
			count: option.count,
			onSelect: () => {
				onChange(toggleFilterValue(filters, target, option.value));

				if (!FIELDS[target].multi) {
					changeOpen(false);
				}
			},
		}));
	}

	const fieldItems: CommandItem[] = FIELD_ORDER.map((candidate) => ({
		key: candidate,
		label: FIELDS[candidate].label,
		// 20px on phones, so the icon sits level with 16px text instead of shrinking beside it.
		mark: <FieldIcon field={candidate} className={mobile ? 'size-5' : undefined} />,
		submenu: true,
		onHighlight: candidate === 'author' ? prefetchAuthors : undefined,
		onSelect: () => {
			setField(candidate);
			setQuery('');
		},
	}));

	const back = field && !fixedField ? () => setField(null) : undefined;
	const paged = field === 'author';
	const items = field
		? valueItems(field, false)
		: query
			? [...fieldItems, ...FIELD_ORDER.flatMap((candidate) => valueItems(candidate, true))]
			: fieldItems;

	const view = field ?? 'root';
	const list = (
		<CommandList
			key={view}
			items={items}
			placeholder={field ? `Search ${FIELDS[field].plural}...` : 'Filter...'}
			query={query}
			onQueryChange={setQuery}
			onBack={back}
			touch={mobile}
			pending={paged ? authors.pending : 0}
			onEndReached={paged && authors.hasMore ? authors.loadMore : undefined}
			total={paged ? authors.total : undefined}
		/>
	);

	// Linear swaps a menu's views in place: a quick crossfade while the height springs, no sideways travel.
	// Each item carries its own rows, so a leaving view keeps showing what it showed while it fades.
	const transitions = useTransition<MenuView, ViewStyle>([{ key: view, list }], {
		keys: (item) => item.key,
		from: { opacity: 0, blur: VIEW_BLUR },
		enter: { opacity: 1, blur: 0 },
		leave: { opacity: 0, blur: VIEW_BLUR },
		initial: null,
		// The fade runs on the height's timing, so the new rows and the new edge arrive together.
		config: mobile ? { ...MORPH_SPRING, clamp: true } : MORPH_EXPO,
		immediate: Boolean(reduced),
	});

	const views = (
		<MorphHeight config={mobile ? MORPH_SPRING : MORPH_EXPO}>
			{transitions(({ opacity, blur }, item, { phase }) => {
				const leaving = phase === 'leave';

				// Each view is its own layer (will-change), so opacity and blur run on the compositor.
				// Phones skip the blur: a filter over a full list costs more than a phone GPU spares.
				return (
					<animated.div
						style={{
							opacity,
							filter: mobile ? undefined : blur.to((value) => `blur(${value}px)`),
						}}
						className={cn(
							'[will-change:opacity,filter]',
							// The fading view lets the pointer through, so rows of the arriving view take hover while it resizes.
							leaving ? 'top-0 absolute inset-x-0 pointer-events-none' : 'w-full',
						)}
					>
						{leaving ? cloneElement(item.list, { present: false }) : item.list}
					</animated.div>
				);
			})}
		</MorphHeight>
	);

	if (mobile) {
		return (
			<BottomSheet open={open} onOpenChange={changeOpen}>
				<BottomSheetTrigger aria-label={triggerLabel} className={triggerClassName}>
					{children}
				</BottomSheetTrigger>
				<BottomSheetContent>
					{/* On a phone the way back sits with the title, as in iOS sheets, not inside the search field. */}
					<div className={cn('flex items-center gap-1 pr-2', back ? 'pl-1' : 'pl-5')}>
						{back ? (
							<button
								type='button'
								aria-label='Back to filters'
								onClick={back}
								className='flex justify-center items-center rounded-full size-11 text-muted-foreground active:text-foreground transition-colors shrink-0'
							>
								<IconChevronLeft className='size-5' />
							</button>
						) : null}
						<BottomSheetTitle className='flex-1'>
							{field ? FIELDS[field].label : 'Filter'}
						</BottomSheetTitle>
						<BottomSheetClose
							className={cn(buttonVariants({ variant: 'ghost' }), 'text-base')}
						>
							Done
						</BottomSheetClose>
					</div>
					{views}
				</BottomSheetContent>
			</BottomSheet>
		);
	}

	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<PopoverTrigger aria-label={triggerLabel} className={triggerClassName}>
				{children}
			</PopoverTrigger>
			<PopoverContent
				align='start'
				className='p-0 rounded-menu corner-continuous w-64 overflow-hidden'
			>
				{views}
			</PopoverContent>
		</Popover>
	);
}

export default FilterMenu;
