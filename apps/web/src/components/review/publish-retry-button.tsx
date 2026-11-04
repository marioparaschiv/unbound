import { useMutation } from '@tanstack/react-query';
import { IconRefresh } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import { reviewDecisionMutation } from '~/queries/review/review';
import getApiErrorMessage from '~/lib/api/error-message';
import type { ReviewEntry } from '~/lib/review-entry';
import { Button } from '~/components/ui/button';

type PublishRetryButtonProps = {
	entry: ReviewEntry;
};

/** Repeats the approval of a version whose files failed to publish, which writes them again. */
function PublishRetryButton({ entry }: PublishRetryButtonProps) {
	const { submission } = entry;
	const { mutate, isPending } = useMutation(reviewDecisionMutation(submission.id));

	return (
		<Button
			disabled={isPending}
			onClick={() =>
				mutate(
					{ decision: 'approved' },
					{
						onSuccess: () =>
							toast.success(`Published ${entry.name} ${submission.version}`),
						onError: (error) => toast.error(getApiErrorMessage(error)),
					},
				)
			}
		>
			<IconRefresh size={24} />
			Retry publishing
		</Button>
	);
}

export default PublishRetryButton;
