import type { Submission } from '@unbound-app/contracts/publish';
import { IconRefresh, IconUpload } from '@tabler/icons-react';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import SubmitForm from '~/components/submit/submit-form';
import type { SubmitIntent } from '~/lib/dashboard';
import { Button } from '~/components/ui/button';

type SubmitDialogProps = {
	addonId: string;
	intent: SubmitIntent;
	githubLinked: boolean;
	variant?: 'default' | 'outline';
};

type IntentCopy = {
	label: string;
	icon: ReactNode;
	description: string;
};

const INTENTS: Record<SubmitIntent, IntentCopy> = {
	republish: {
		label: 'Republish',
		icon: <IconRefresh />,
		description:
			'Pick the rebuilt manifest and bundle. The new submission replaces the one with changes requested and goes back into the review queue.',
	},
	restart: {
		label: 'Restart upload',
		icon: <IconRefresh />,
		description:
			'Pick the manifest and bundle again. The new submission replaces the upload that never finished.',
	},
	update: {
		label: 'Submit update',
		icon: <IconUpload />,
		description:
			'Pick the manifest and bundle of the new version. The live version stays until reviewers approve it.',
	},
};

function SubmitDialog({ addonId, intent, githubLinked, variant = 'default' }: SubmitDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const copy = INTENTS[intent];

	async function handleSubmitted(submitted: Submission) {
		setOpen(false);
		toast.success(`Submitted ${submitted.addonId} ${submitted.version} for review`);
		await router.invalidate();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} size='sm'>
					{copy.icon}
					{copy.label}
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-xl'>
				<DialogHeader>
					<DialogTitle>
						{copy.label}: {addonId}
					</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>
				<SubmitForm
					githubLinked={githubLinked}
					addonId={addonId}
					onSubmitted={handleSubmitted}
				/>
			</DialogContent>
		</Dialog>
	);
}

export default SubmitDialog;
