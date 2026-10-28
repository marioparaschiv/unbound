import type { DateRange } from 'react-day-picker';
import { IconCalendar } from 'nucleo-micro-bold';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { describeDate, describeRange, EMPTY_RANGE, nextRange } from '~/lib/date-selection';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { selectTriggerVariants } from '~/components/ui/select';
import { Calendar } from '~/components/ui/calendar';
import { Button } from '~/components/ui/button';
import cn from '~/lib/cn';

type SingleDatePickerProps = {
	mode: 'single';
	value: Date | undefined;
	onChange: (date: Date | undefined) => void;
};

type RangeDatePickerProps = {
	mode: 'range';
	/** Either bound may be unset on its own. */
	value: DateRange;
	onChange: (range: DateRange) => void;
};

type DatePickerProps = (SingleDatePickerProps | RangeDatePickerProps) & {
	id?: string;
	/** The label shown while nothing is picked. */
	placeholder?: string;
	className?: string;
};

type DatePickerView = {
	label: string;
	popoverLabel: string;
	empty: boolean;
	calendar: ReactNode;
	clear: () => void;
};

function singleView(
	{ value, onChange }: SingleDatePickerProps,
	close: () => void,
	placeholder: string = 'Pick a date',
): DatePickerView {
	return {
		label: describeDate(value, placeholder),
		popoverLabel: 'Choose a date',
		empty: !value,
		calendar: (
			<Calendar
				autoFocus
				mode='single'
				defaultMonth={value}
				selected={value}
				onSelect={(date) => {
					onChange(date);
					close();
				}}
			/>
		),
		clear: () => onChange(undefined),
	};
}

function rangeView(
	{ value, onChange }: RangeDatePickerProps,
	placeholder: string = 'Any date',
): DatePickerView {
	return {
		label: describeRange(value, placeholder),
		popoverLabel: 'Choose dates',
		empty: !value.from && !value.to,
		calendar: (
			<Calendar
				autoFocus
				mode='range'
				numberOfMonths={2}
				defaultMonth={value.from ?? value.to}
				selected={value}
				onSelect={(_range, day) => onChange(nextRange(value, day))}
			/>
		),
		clear: () => onChange(EMPTY_RANGE),
	};
}

function DatePicker({ id, placeholder, className, ...props }: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const valueId = useId();
	const view =
		props.mode === 'single'
			? singleView(props, () => setOpen(false), placeholder)
			: rangeView(props, placeholder);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				id={id}
				data-slot='date-picker-trigger'
				data-placeholder={view.empty ? '' : undefined}
				aria-describedby={valueId}
				className={cn(selectTriggerVariants(), className)}
			>
				<IconCalendar size={24} className='text-muted-foreground -ml-1' />
				<span id={valueId} className='single-line min-w-0 flex-1 text-left'>
					{view.label}
				</span>
			</PopoverTrigger>
			<PopoverContent align='start' aria-label={view.popoverLabel} className='w-auto p-0'>
				{view.calendar}
				<div className='flex justify-end border-t p-2'>
					<Button
						variant='ghost'
						size='sm'
						disabled={view.empty}
						onClick={() => {
							view.clear();
							setOpen(false);
						}}
					>
						Clear
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type { DatePickerProps };

export default DatePicker;
