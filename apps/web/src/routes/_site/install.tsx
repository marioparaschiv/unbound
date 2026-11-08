import { Link, createFileRoute } from '@tanstack/react-router';
import { IconArrowUpRight, IconBook } from 'nucleo-micro-bold';

import DownloadChannels from '~/components/download/download-channels';
import { fetchDownloads } from '~/lib/downloads/download-functions';
import DownloadQuiz from '~/components/download/download-quiz';
import { RELEASES_URL } from '~/lib/downloads/install-links';
import PageHeader from '~/components/page-header';
import { Button } from '~/components/ui/button';

function DownloadPage() {
	const downloads = Route.useLoaderData();

	return (
		<div className='flex flex-col flex-1 gap-10 page-frame'>
			<PageHeader
				title='Download Unbound'
				description='Discord with Unbound built in, for iPhone, iPad and Android.'
			>
				<Button asChild variant='secondary'>
					<Link to='/docs/user/$' params={{ _splat: 'installing' }}>
						<IconBook aria-hidden />
						Installation guide
					</Link>
				</Button>
			</PageHeader>

			<section aria-labelledby='quiz-heading' className='flex flex-col gap-4'>
				<div className='flex flex-col gap-1'>
					<h2 id='quiz-heading' className='font-semibold text-foreground text-xl'>
						Find the right download
					</h2>
					<p className='text-muted-foreground text-sm'>
						Not sure which file you need? Answer two or three questions about your
						device.
					</p>
				</div>
				<DownloadQuiz builds={downloads.stable} />
			</section>

			{/* Splits the guided path from the full list, so a newcomer stops at the quiz. */}
			<div role='separator' className='flex items-center gap-4 my-8'>
				<span className='bg-border h-px grow' />
				<span className='font-medium text-muted-foreground text-sm'>
					Know what you need? Pick a file yourself
				</span>
				<span className='bg-border h-px grow' />
			</div>

			<DownloadChannels downloads={downloads} />

			<p className='text-muted-foreground text-sm text-center'>
				Stuck? The{' '}
				<Link
					to='/docs/user/$'
					params={{ _splat: 'installing' }}
					className='text-link underline-offset-4 hover:underline'
				>
					installation guide
				</Link>{' '}
				walks through every step. Every build is also on the{' '}
				<a
					href={RELEASES_URL}
					target='_blank'
					rel='noopener noreferrer'
					className='inline-flex items-center gap-0.5 text-link underline-offset-4 hover:underline'
				>
					GitHub releases page
					<IconArrowUpRight size={12} aria-hidden />
				</a>
			</p>
		</div>
	);
}

export const Route = createFileRoute('/_site/install')({
	head: () => ({
		meta: [
			{ title: 'Unbound | Install' },
			{
				name: 'description',
				content: 'Download Unbound for iOS and Android: stable and nightly builds.',
			},
		],
	}),
	loader: () => fetchDownloads(),
	component: DownloadPage,
});
