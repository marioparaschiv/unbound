import type { ReactNode } from 'react';

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '~/components/ui/card';

type SubmitSectionProps = {
	title: ReactNode;
	description?: ReactNode;
	footer?: ReactNode;
	children?: ReactNode;
};

/**
 * @description One titled step of the submit form, as a card.
 * @param props The title, description, footer and content.
 * @returns The section.
 */
export function SubmitSection({ title, description, footer, children }: SubmitSectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			{children ? <CardContent>{children}</CardContent> : null}
			{footer ? <CardFooter>{footer}</CardFooter> : null}
		</Card>
	);
}

export default { SubmitSection };
