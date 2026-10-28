import type { ReactNode } from 'react';

import Text from '~/components/ui/text';

type ProsePageProps = {
	title: string;
	description: string;
	footer: ReactNode;
	children: ReactNode;
};

type ProseSectionProps = {
	title: string;
	children: ReactNode;
};

type ProseChildrenProps = {
	children: ReactNode;
};

/** A long-form page (terms, privacy, license): a title block, then sections, then a footnote. */
function ProsePage({ title, description, footer, children }: ProsePageProps) {
	return (
		<div className='flex flex-col flex-1 gap-4 mb-12 page-frame'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>{title}</Text>
				<Text variant='text-md' color='muted'>
					{description}
				</Text>
			</div>

			<div className='flex flex-col gap-6 max-w-4xl'>
				{children}

				<div className='mt-4 pt-4 border-t'>
					<Text variant='text-sm' color='muted'>
						{footer}
					</Text>
				</div>
			</div>
		</div>
	);
}

function ProseSection({ title, children }: ProseSectionProps) {
	return (
		<section className='flex flex-col gap-3'>
			<Text variant='heading-md'>{title}</Text>
			{children}
		</section>
	);
}

function ProseParagraph({ children }: ProseChildrenProps) {
	return (
		<Text variant='text-md' color='muted'>
			{children}
		</Text>
	);
}

function ProseList({ children }: ProseChildrenProps) {
	return (
		<Text
			as='ul'
			variant='text-sm'
			color='muted'
			className='space-y-2 ml-4 list-disc list-inside'
		>
			{children}
		</Text>
	);
}

function ProseItem({ children }: ProseChildrenProps) {
	return (
		<Text as='li' variant='text-sm' color='muted'>
			{children}
		</Text>
	);
}

export { ProsePage, ProseSection, ProseParagraph, ProseList, ProseItem };

export default { ProsePage, ProseSection, ProseParagraph, ProseList, ProseItem };
