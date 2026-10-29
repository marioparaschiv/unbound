import type { ReactNode } from 'react';

import Text from '~/components/ui/text';
import cn from '~/lib/cn';

import useScrollSpy from './use-scroll-spy';

export type DocSection = {
	id: string;
	title: string;
};

type SettingsDocProps = {
	sections: DocSection[];
	children: ReactNode;
};

type SettingsSectionProps = {
	id: string;
	title: string;
	description?: ReactNode;
	/** Marks the section as holding destructive actions. */
	danger?: boolean;
	/** Sits beside the title, such as a link out. */
	action?: ReactNode;
	children: ReactNode;
};

/**
 * @description A settings document: a sticky sub-nav of the page's sections beside one readable column.
 * @param props The sections the nav lists and the section elements.
 * @returns The document.
 */
function SettingsDoc({ sections, children }: SettingsDocProps) {
	const [active, setActive] = useScrollSpy(sections.map((section) => section.id));

	return (
		<div className='items-start gap-10 grid grid-cols-[minmax(0,1fr)] md:grid-cols-[10rem_minmax(0,1fr)]'>
			<nav aria-label='On this page' className='hidden md:flex flex-col gap-0.5 top-6 sticky'>
				{sections.map((section) => (
					<a
						key={section.id}
						href={`#${section.id}`}
						onClick={() => setActive(section.id)}
						aria-current={active === section.id ? 'location' : undefined}
						className={cn(
							'flex items-center px-3 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-9 font-semibold text-muted-foreground hover:text-foreground text-sm transition-colors press-flat',
							active === section.id
								? 'bg-accent text-foreground'
								: 'hover:bg-accent/50',
						)}
					>
						{section.title}
					</a>
				))}
			</nav>
			<div className='flex flex-col max-w-3xl'>{children}</div>
		</div>
	);
}

/**
 * @description One section of a settings document: a heading, a plain-words description and its content, ruled off from the previous one.
 * @param props The anchor id, the heading, the description and the content.
 * @returns The section.
 */
export function SettingsSection({
	id,
	title,
	description,
	danger = false,
	action,
	children,
}: SettingsSectionProps) {
	return (
		<section
			id={id}
			className='flex flex-col gap-4 py-8 first:pt-0 border-t first:border-t-0 scroll-mt-6'
		>
			<div className='flex flex-wrap justify-between items-start gap-x-4 gap-y-2'>
				<div className='flex flex-col gap-1 min-w-0'>
					<Text variant='heading-sm' className={danger ? 'text-destructive' : undefined}>
						{title}
					</Text>
					{description ? (
						<Text variant='text-sm' color='muted'>
							{description}
						</Text>
					) : null}
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

type FactProps = {
	label: string;
	children: ReactNode;
};

/**
 * @description A label and value row for a settings document's facts list.
 * @param props The label and the value.
 * @returns The row.
 */
export function Fact({ label, children }: FactProps) {
	return (
		<div className='flex justify-between items-baseline gap-4 py-2.5 min-w-0'>
			<Text as='dt' variant='text-sm' color='muted' className='shrink-0'>
				{label}
			</Text>
			<Text as='dd' variant='text-sm' className='min-w-0 text-right break-words'>
				{children}
			</Text>
		</div>
	);
}

export default SettingsDoc;
