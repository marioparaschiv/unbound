import { IconBox, IconCheck, IconExternalLink, IconUpload } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { TONES } from '~/components/dashboard/status';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type FirstRunProps = {
	githubLinked: boolean;
	hasSubmitted: boolean;
};

type StepProps = {
	index: number;
	title: string;
	description: string;
	done: boolean;
	children: ReactNode;
};

function Step({ index, title, description, done, children }: StepProps) {
	return (
		<li className='flex flex-col gap-3 bg-card shadow-surface p-4 border rounded-surface text-left'>
			<div className='flex items-center gap-2'>
				<span
					className={cn(
						'place-items-center grid rounded-full size-6 font-medium text-xs shrink-0',
						done ? TONES.success.pill : 'bg-muted',
					)}
				>
					{done ? <IconCheck size={14} aria-label='Done' /> : index}
				</span>
				<Text as='span' variant='text-sm' className='font-medium'>
					{title}
				</Text>
			</div>
			<Text variant='text-xs' color='muted' className='flex-1'>
				{description}
			</Text>
			{children}
		</li>
	);
}

function FirstRun({ githubLinked, hasSubmitted }: FirstRunProps) {
	return (
		<section className='flex flex-col items-center gap-6 p-6 sm:p-10 border border-dashed rounded-surface text-center'>
			<div className='place-items-center grid bg-muted rounded-control size-12'>
				<IconBox className='size-6' />
			</div>
			<div className='flex flex-col gap-1'>
				<Text variant='heading-sm'>Publish your first addon</Text>
				<Text variant='text-sm' color='muted' className='max-w-md'>
					Three steps from code to the Unbound marketplace.
				</Text>
			</div>
			<ol className='gap-3 grid sm:grid-cols-3 w-full max-w-3xl'>
				<Step
					index={1}
					title='Link GitHub'
					description='Reviewers trust addons tied to a repository you can push to.'
					done={githubLinked}
				>
					{githubLinked ? null : (
						<Button asChild variant='outline' size='sm' className='self-start'>
							<Link to='/account'>Link on your account</Link>
						</Button>
					)}
				</Step>
				<Step
					index={2}
					title='Build with the CLI'
					description='Bundle your addon with the Unbound CLI, then publish with ubd publish or the web form.'
					done={hasSubmitted}
				>
					<Button asChild variant='outline' size='sm' className='self-start'>
						<a href='https://docs.unbound.rip' target='_blank' rel='noreferrer'>
							<IconExternalLink size={24} />
							Read the docs
						</a>
					</Button>
				</Step>
				<Step
					index={3}
					title='Submit for review'
					description='A moderator checks it. The decision and their notes show up here.'
					done={hasSubmitted}
				>
					<Button asChild size='sm' className='self-start'>
						<Link to='/submit'>
							<IconUpload size={24} />
							{hasSubmitted ? 'Submit an addon' : 'Submit your first addon'}
						</Link>
					</Button>
				</Step>
			</ol>
		</section>
	);
}

export default FirstRun;
