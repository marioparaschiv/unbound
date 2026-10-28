import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronUp,
} from 'nucleo-micro-bold';
import type { ChevronProps, DayButtonProps, RootProps, WeekNumberProps } from 'react-day-picker';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';

import { buttonVariants } from '~/components/ui/button';
import cn from '~/lib/cn';

const CHEVRONS = {
	left: IconChevronLeft,
	right: IconChevronRight,
	up: IconChevronUp,
	down: IconChevronDown,
};

const NAV_BUTTON = cn(
	buttonVariants({ variant: 'ghost' }),
	'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
);

function CalendarRoot({ className, rootRef, ...props }: RootProps) {
	return <div data-slot='calendar' ref={rootRef} className={className} {...props} />;
}

function CalendarChevron({ className, orientation = 'left', size: _size, ...props }: ChevronProps) {
	const Icon = CHEVRONS[orientation];

	return <Icon className={cn('size-4', className)} {...props} />;
}

function CalendarWeekNumber({ children, ...props }: WeekNumberProps) {
	return (
		<td {...props}>
			<div className='flex size-(--cell-size) items-center justify-center text-center'>
				{children}
			</div>
		</td>
	);
}

function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
	const ref = useRef<HTMLButtonElement>(null);
	const ranged = modifiers.range_start || modifiers.range_end || modifiers.range_middle;

	// Replacing the default day button drops its focus handling, so follow keyboard focus here.
	useEffect(() => {
		if (modifiers.focused) {
			ref.current?.focus();
		}
	}, [modifiers.focused]);

	return (
		<button
			ref={ref}
			data-day={day.isoDate}
			data-selected-single={Boolean(modifiers.selected && !ranged)}
			data-range-start={Boolean(modifiers.range_start)}
			data-range-end={Boolean(modifiers.range_end)}
			data-range-middle={Boolean(modifiers.range_middle)}
			className={cn(
				'press-flat hover:bg-accent hover:text-accent-foreground focus-visible:ring-halo inline-flex items-center justify-center rounded-item text-sm outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50',
				'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:ring-halo flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-4 data-[range-end=true]:rounded-item data-[range-end=true]:rounded-r-item data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-item data-[range-start=true]:rounded-l-item',
				className,
			)}
			{...props}
		/>
	);
}

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	components,
	...props
}: ComponentProps<typeof DayPicker>) {
	const defaults = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				'bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=popover-content]_&]:bg-transparent',
				className,
			)}
			classNames={{
				root: cn('w-fit', defaults.root),
				months: cn('relative flex flex-col gap-4 md:flex-row', defaults.months),
				month: cn('flex w-full flex-col gap-4', defaults.month),
				nav: cn(
					'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
					defaults.nav,
				),
				button_previous: cn(NAV_BUTTON, defaults.button_previous),
				button_next: cn(NAV_BUTTON, defaults.button_next),
				month_caption: cn(
					'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
					defaults.month_caption,
				),
				caption_label: cn('text-sm font-medium select-none', defaults.caption_label),
				month_grid: 'w-full border-collapse',
				weekdays: cn('flex', defaults.weekdays),
				weekday: cn(
					'text-muted-foreground flex-1 rounded-item text-[0.8rem] font-normal select-none',
					defaults.weekday,
				),
				week: cn('mt-2 flex w-full', defaults.week),
				week_number_header: cn('w-(--cell-size) select-none', defaults.week_number_header),
				week_number: cn(
					'text-muted-foreground text-[0.8rem] select-none',
					defaults.week_number,
				),
				day: cn(
					'group/day relative aspect-square h-full w-full p-0 text-center select-none [&:first-child[data-selected=true]_button]:rounded-l-item [&:last-child[data-selected=true]_button]:rounded-r-item',
					defaults.day,
				),
				range_start: cn('bg-accent rounded-l-item', defaults.range_start),
				range_middle: cn('rounded-none', defaults.range_middle),
				range_end: cn('bg-accent rounded-r-item', defaults.range_end),
				today: cn(
					'bg-accent text-accent-foreground rounded-item data-[selected=true]:rounded-none',
					defaults.today,
				),
				outside: cn(
					'text-muted-foreground aria-selected:text-muted-foreground',
					defaults.outside,
				),
				disabled: cn('text-muted-foreground opacity-50', defaults.disabled),
				hidden: cn('invisible', defaults.hidden),
				...classNames,
			}}
			components={{
				Root: CalendarRoot,
				Chevron: CalendarChevron,
				DayButton: CalendarDayButton,
				WeekNumber: CalendarWeekNumber,
				...components,
			}}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };

export default { Calendar, CalendarDayButton };
