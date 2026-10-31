import { IconRefresh, IconUpload } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { SubmitIntent } from '~/lib/dashboard';
import { Button } from '~/components/ui/button';

type SubmitButtonProps = {
	addonId: string;
	intent: SubmitIntent;
	variant?: 'default' | 'outline';
};

type IntentCopy = {
	label: string;
	icon: ReactNode;
};

const INTENTS: Record<SubmitIntent, IntentCopy> = {
	republish: { label: 'Republish', icon: <IconRefresh size={24} /> },
	update: { label: 'Submit update', icon: <IconUpload size={24} /> },
};

/** Opens `/submit` on the addon; hovering preloads the page and the repository it reads. */
function SubmitButton({ addonId, intent, variant = 'default' }: SubmitButtonProps) {
	const copy = INTENTS[intent];

	return (
		<Button asChild variant={variant} size='sm'>
			<Link to='/submit' search={{ addon: addonId }}>
				{copy.icon}
				{copy.label}
			</Link>
		</Button>
	);
}

export default SubmitButton;
