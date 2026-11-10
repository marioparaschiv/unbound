import { createFileRoute } from '@tanstack/react-router';
import type { ComponentProps, ReactNode } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import { ProseItem, ProseList } from '~/components/prose';
import PageHeader from '~/components/page-header';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type FaqLinkProps = {
	href: string;
	children: ReactNode;
};

type FaqAnswerProps = {
	children: ReactNode;
	className?: string;
};

function FaqLink({ href, children }: FaqLinkProps) {
	return (
		<a
			href={href}
			target='_blank'
			rel='noopener noreferrer'
			className='text-link underline-offset-4 hover:underline'
		>
			{children}
		</a>
	);
}

/* A ghost row whose card swells out behind it on hover. The card grows its real box, not a scale, so its corners keep their radius. */
const faqItemClass =
	'group/faq relative isolate border-b-0 before:absolute before:inset-x-0 before:inset-y-2 before:-z-10 before:rounded-surface before:border before:border-border before:bg-card before:shadow-float before:opacity-0 before:transition-[opacity,inset-inline,inset-block] before:duration-280 before:ease-expo hover:before:opacity-100 hover:before:-inset-x-5 hover:before:inset-y-0 has-[:focus-visible]:before:opacity-100 has-[:focus-visible]:before:-inset-x-5 has-[:focus-visible]:before:inset-y-0 motion-reduce:before:transition-opacity';

/* The answer fades and settles in step with the disclosure's 280ms expo height. */
const faqContentClass =
	'pb-5 duration-280 ease-expo group-data-[state=open]/faq:animate-in group-data-[state=open]/faq:fade-in-0 group-data-[state=open]/faq:slide-in-from-top-1 group-data-[state=closed]/faq:animate-out group-data-[state=closed]/faq:fade-out-0 group-data-[state=closed]/faq:slide-out-to-top-1 motion-reduce:animate-none';

function FaqItem({ className, ...props }: ComponentProps<typeof AccordionItem>) {
	return <AccordionItem className={cn(faqItemClass, className)} {...props} />;
}

function FaqTrigger({ className, ...props }: ComponentProps<typeof AccordionTrigger>) {
	return (
		<AccordionTrigger
			className={cn('py-5 hover:no-underline focus-visible:ring-0', className)}
			{...props}
		/>
	);
}

function FaqContent({ className, ...props }: ComponentProps<typeof AccordionContent>) {
	return <AccordionContent className={cn(faqContentClass, className)} {...props} />;
}

function FaqAnswer({ children, className }: FaqAnswerProps) {
	return (
		<Text variant='text-sm' color='muted' className={className}>
			{children}
		</Text>
	);
}

function FaqPage() {
	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<PageHeader
				title='Frequently Asked Questions'
				description='Find answers to common questions about Unbound.'
			/>

			<Accordion type='multiple' className='flex flex-col gap-2'>
				<FaqItem value='what-is'>
					<FaqTrigger>What is Unbound?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							Unbound is a mobile-only client modification for Discord that supports
							both Android and iOS platforms. It allows you to customize your Discord
							experience with plugins and themes. It's open-source and
							community-driven, providing a platform for developers to create and
							share enhancements.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='safe'>
					<FaqTrigger>Is Unbound safe to use?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>
							Unbound itself is open-source and auditable. However, you should be
							aware that:
						</FaqAnswer>
						<ProseList>
							<ProseItem>
								Using any client modification violates Discord's Terms of Service
							</ProseItem>
							<ProseItem>Your Discord account could be suspended or banned</ProseItem>
							<ProseItem>
								You should review any plugins or themes before installing them
							</ProseItem>
							<ProseItem>Use Unbound at your own risk</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='banned'>
					<FaqTrigger>Will I get banned for using Unbound?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>
							Using client modifications violates Discord's Terms of Service, and
							Discord has the right to suspend or ban accounts that use them. While we
							cannot guarantee that you won't face consequences, we recommend:
						</FaqAnswer>
						<ProseList>
							<ProseItem>
								Only installing plugins and themes from trusted developers
							</ProseItem>
							<ProseItem>Avoiding plugins that automate actions or spam</ProseItem>
							<ProseItem>
								Being aware of the risks before using any client modification
							</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='install'>
					<FaqTrigger>How do I install Unbound?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							For detailed installation instructions specific to your platform
							(Android or iOS), please visit our{' '}
							<FaqLink href='https://docs.unbound.rip/installation'>
								installation guide
							</FaqLink>
							. The installation process varies depending on your device and setup
							method.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='install-plugins'>
					<FaqTrigger>How do I install plugins and themes?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							Once Unbound is installed, you can browse and install plugins and themes
							from this website. Simply click the install button on any plugin or
							theme page, and Unbound will handle the rest. You can manage your
							installed plugins and themes from the Unbound settings panel within
							Discord.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='create'>
					<FaqTrigger>Can I create my own plugins and themes?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>
							Yes! Unbound is designed to be extensible, and we encourage developers
							to create plugins and themes. To get started:
						</FaqAnswer>
						<ProseList>
							<ProseItem>
								Check out our developer documentation for API references and guides
							</ProseItem>
							<ProseItem>
								Join our Discord server to connect with other developers
							</ProseItem>
							<ProseItem>
								Submit your creations to our platform for others to use
							</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='uninstall'>
					<FaqTrigger>How do I uninstall Unbound?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>
							To uninstall Unbound, follow the steps for your platform:
						</FaqAnswer>
						<ProseList>
							<ProseItem>
								<strong>iOS (Jailbroken):</strong> Remove the tweak from your
								package manager
							</ProseItem>
							<ProseItem>
								<strong>iOS (Jailed):</strong> Delete the sideloaded app from your
								device
							</ProseItem>
							<ProseItem>
								<strong>Android (Manager):</strong> Delete the app using the manager
							</ProseItem>
							<ProseItem>
								<strong>Android (Magisk):</strong> Delete the Xposed module from
								Magisk
							</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='mobile'>
					<FaqTrigger>Does Unbound work on mobile?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							Yes! Unbound is a mobile-only modification that supports both Android
							and iOS platforms. It is designed specifically for mobile Discord
							clients.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='compatibility'>
					<FaqTrigger>Is Unbound compatible with other Discord client mods?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							Unbound is designed to be standalone and may conflict with other client
							modifications. We recommend using only one client modification at a time
							to avoid compatibility issues and unexpected behavior.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='bug-report'>
					<FaqTrigger>How do I report a bug or request a feature?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>
							You can report bugs and request features through:
						</FaqAnswer>
						<ProseList>
							<ProseItem>
								Our{' '}
								<FaqLink href='https://github.com/marioparaschiv/unbound'>
									GitHub repository
								</FaqLink>{' '}
								by opening an issue
							</ProseItem>
							<ProseItem>
								Our{' '}
								<FaqLink href='https://discord.gg/rMdzhWUaGT'>
									Discord server
								</FaqLink>{' '}
								in the appropriate channels
							</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='free'>
					<FaqTrigger>Is Unbound free?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							Yes! Unbound is completely free and open-source software licensed under
							the GNU General Public License v3.0. You can use, modify, and distribute
							it freely. We do not charge for any features or plugins.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>

				<FaqItem value='support'>
					<FaqTrigger>How can I support Unbound?</FaqTrigger>
					<FaqContent>
						<FaqAnswer className='mb-2'>You can support Unbound by:</FaqAnswer>
						<ProseList>
							<ProseItem>Contributing code, plugins, or themes</ProseItem>
							<ProseItem>Reporting bugs and helping test new features</ProseItem>
							<ProseItem>Helping other users in our Discord server</ProseItem>
							<ProseItem>Spreading the word about Unbound</ProseItem>
							<ProseItem>Starring our repository on GitHub</ProseItem>
						</ProseList>
					</FaqContent>
				</FaqItem>

				<FaqItem value='more-questions'>
					<FaqTrigger>Still have questions?</FaqTrigger>
					<FaqContent>
						<FaqAnswer>
							If you couldn't find the answer to your question, feel free to reach out
							to us on our{' '}
							<FaqLink href='https://discord.gg/rMdzhWUaGT'>Discord server</FaqLink>{' '}
							or check our{' '}
							<FaqLink href='https://docs.unbound.rip'>documentation</FaqLink>.
						</FaqAnswer>
					</FaqContent>
				</FaqItem>
			</Accordion>
		</div>
	);
}

export const Route = createFileRoute('/_site/faq')({
	head: () => ({ meta: [{ title: 'Unbound | FAQ' }] }),
	component: FaqPage,
});
