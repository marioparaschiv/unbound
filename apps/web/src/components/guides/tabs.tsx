import { Children, isValidElement, useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';

type TabsProps = {
	children: ReactNode;
};

type TabProps = {
	title: string;
	children?: ReactNode;
};

/**
 * @description Alternatives side by side, such as per-platform instructions, switched by a segmented control
 * that scrolls sideways when its titles overflow.
 * @param props The `Tab` children.
 * @returns The tabs.
 */
export function Tabs({ children }: TabsProps) {
	const id = useId();
	const [active, setActive] = useState(0);
	const tabs = Children.toArray(children).filter((child): child is ReactElement<TabProps> =>
		isValidElement<TabProps>(child),
	);

	return (
		<div className='flex flex-col gap-4 min-w-0'>
			<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
				<Segmented value={String(active)} role='tablist'>
					{tabs.map((tab, index) => (
						<SegmentedItem
							key={tab.props.title}
							value={String(index)}
							className='text-sm whitespace-nowrap'
							asChild
						>
							<button
								type='button'
								role='tab'
								id={`${id}-tab-${index}`}
								aria-selected={index === active}
								aria-controls={`${id}-panel-${index}`}
								onClick={() => setActive(index)}
							>
								{tab.props.title}
							</button>
						</SegmentedItem>
					))}
				</Segmented>
			</div>
			{/* Every panel renders so find-in-page and the server HTML cover all of them. */}
			{tabs.map((tab, index) => (
				<div
					key={tab.props.title}
					role='tabpanel'
					id={`${id}-panel-${index}`}
					aria-labelledby={`${id}-tab-${index}`}
					hidden={index !== active}
					className='flex flex-col gap-4 min-w-0'
				>
					{tab.props.children}
				</div>
			))}
		</div>
	);
}

/**
 * @description One alternative of {@link Tabs}; `Tabs` reads its title and renders its content.
 * @param props The title and content.
 * @returns The content.
 */
export function Tab({ children }: TabProps) {
	return <>{children}</>;
}

export default { Tabs, Tab };
