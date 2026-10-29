import { Segmented, SegmentedItem } from '~/components/ui/segmented';

type Tab<T extends string> = {
	value: T;
	label: string;
	/** Marks the tab with a dot, e.g. for unsaved changes inside it. */
	marked?: boolean;
};

type TabStripProps<T extends string> = {
	tabs: Tab<T>[];
	value: T;
	onChange: (value: T) => void;
};

function TabStrip<T extends string>({ tabs, value, onChange }: TabStripProps<T>) {
	return (
		<div className='max-w-full overflow-x-auto'>
			<Segmented value={value} role='tablist'>
				{tabs.map((tab) => (
					<SegmentedItem key={tab.value} value={tab.value} asChild className='text-sm'>
						<button
							type='button'
							role='tab'
							aria-selected={tab.value === value}
							onClick={() => onChange(tab.value)}
						>
							<span className='inline-flex items-center gap-1.5'>
								{tab.label}
								{tab.marked ? (
									<span
										title='Unsaved changes'
										className='bg-primary rounded-full size-1.5'
									/>
								) : null}
							</span>
						</button>
					</SegmentedItem>
				))}
			</Segmented>
		</div>
	);
}

export type { Tab };

export default TabStrip;
