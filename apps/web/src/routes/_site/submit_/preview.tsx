import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IconFaceNeutral } from 'nucleo-micro-bold';
import { z } from 'zod/mini';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import type { SourcePreviewPage } from '~/queries/submissions/submissions';
import { sourcePreviewPageQuery } from '~/queries/submissions/submissions';
import PreviewBanner from '~/components/addon/preview-banner';
import AddonPageView from '~/components/addon/addon-page';
import { Button } from '~/components/ui/button';
import { splitList } from '~/lib/addon-filters';
import { shortSha } from '~/lib/github-urls';

/** The addon directory the submit form previews, pinned to the commit it read. */
const previewSearchSchema = z.object({
	repository: z.string(),
	path: z.string(),
	ref: z.string(),
	commitSha: z.string(),
	/** The icon picked on the form, not saved yet. */
	icon: z.catch(z.optional(z.string()), undefined),
	/** The tag ids picked on the form, not saved yet, comma-separated like the listing filters. */
	tags: z.catch(z.optional(z.string()), undefined),
});

type PreviewSearch = z.infer<typeof previewSearchSchema>;

function toPreviewPage({ tags, ...search }: PreviewSearch): SourcePreviewPage {
	return { ...search, tags: tags === undefined ? undefined : splitList(tags) };
}

// The submit form opens this page in a new tab, so closing the tab returns to the form as it was.
function ClosePreview() {
	return (
		<Button variant='outline' size='sm' onClick={() => window.close()}>
			Close preview
		</Button>
	);
}

function SourcePreviewPage() {
	const search = Route.useSearch();
	const { data: addon } = useSuspenseQuery(sourcePreviewPageQuery(toPreviewPage(search)));

	if (!addon) {
		throw redirect({ to: '/login' });
	}

	return (
		<AddonPageView
			addon={addon}
			banner={
				<PreviewBanner action={<ClosePreview />}>
					Previewing {addon.name} v{addon.version} from {search.repository} at{' '}
					<span className='font-mono'>{shortSha(search.commitSha)}</span>. Nothing is
					submitted yet.
				</PreviewBanner>
			}
		/>
	);
}

function PreviewUnavailable({ error }: ErrorComponentProps) {
	return (
		<Empty className='flex-1 my-auto'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<IconFaceNeutral size={24} />
				</EmptyMedia>
				<EmptyTitle>Preview Unavailable</EmptyTitle>
				<EmptyDescription>
					{error instanceof Error ? error.message : 'This addon could not be read.'}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to='/submit'>Back to Submit</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export const Route = createFileRoute('/_site/submit_/preview')({
	validateSearch: previewSearchSchema,
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const addon = await context.queryClient.ensureQueryData(
			sourcePreviewPageQuery(toPreviewPage(deps)),
		);

		return addon;
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: loaderData ? `Unbound | Preview ${loaderData.name}` : 'Unbound | Preview' },
		],
	}),
	component: SourcePreviewPage,
	errorComponent: PreviewUnavailable,
});
