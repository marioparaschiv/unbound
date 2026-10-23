import type { ReactNode } from 'react';

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '~/components/ui/card';

type SettingsPanelProps = {
	title: string;
	description: string;
	/** A muted hint under the fields, on its own bordered strip. */
	hint?: ReactNode;
	children: ReactNode;
};

function SettingsPanel({ title, description, hint, children }: SettingsPanelProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
			{hint ? (
				<CardFooter className='border-t text-muted-foreground text-sm'>{hint}</CardFooter>
			) : null}
		</Card>
	);
}

export default SettingsPanel;
