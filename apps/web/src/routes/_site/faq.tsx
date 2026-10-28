import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import { ProseItem, ProseList } from '~/components/prose';
import PageHeader from '~/components/page-header';
import Text from '~/components/ui/text';

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

			<Accordion type='multiple'>
				<AccordionItem value='what-is'>
					<AccordionTrigger>What is Unbound?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							Unbound is a mobile-only client modification for Discord that supports
							both Android and iOS platforms. It allows you to customize your Discord
							experience with plugins and themes. It's open-source and
							community-driven, providing a platform for developers to create and
							share enhancements.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='safe'>
					<AccordionTrigger>Is Unbound safe to use?</AccordionTrigger>
					<AccordionContent>
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
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='banned'>
					<AccordionTrigger>Will I get banned for using Unbound?</AccordionTrigger>
					<AccordionContent>
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
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='install'>
					<AccordionTrigger>How do I install Unbound?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							For detailed installation instructions specific to your platform
							(Android or iOS), please visit our{' '}
							<FaqLink href='https://docs.unbound.rip/installation'>
								installation guide
							</FaqLink>
							. The installation process varies depending on your device and setup
							method.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='install-plugins'>
					<AccordionTrigger>How do I install plugins and themes?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							Once Unbound is installed, you can browse and install plugins and themes
							from this website. Simply click the install button on any plugin or
							theme page, and Unbound will handle the rest. You can manage your
							installed plugins and themes from the Unbound settings panel within
							Discord.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='create'>
					<AccordionTrigger>Can I create my own plugins and themes?</AccordionTrigger>
					<AccordionContent>
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
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='uninstall'>
					<AccordionTrigger>How do I uninstall Unbound?</AccordionTrigger>
					<AccordionContent>
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
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='mobile'>
					<AccordionTrigger>Does Unbound work on mobile?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							Yes! Unbound is a mobile-only modification that supports both Android
							and iOS platforms. It is designed specifically for mobile Discord
							clients.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='compatibility'>
					<AccordionTrigger>
						Is Unbound compatible with other Discord client mods?
					</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							Unbound is designed to be standalone and may conflict with other client
							modifications. We recommend using only one client modification at a time
							to avoid compatibility issues and unexpected behavior.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='bug-report'>
					<AccordionTrigger>How do I report a bug or request a feature?</AccordionTrigger>
					<AccordionContent>
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
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='free'>
					<AccordionTrigger>Is Unbound free?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							Yes! Unbound is completely free and open-source software licensed under
							the GNU General Public License v3.0. You can use, modify, and distribute
							it freely. We do not charge for any features or plugins.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='support'>
					<AccordionTrigger>How can I support Unbound?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer className='mb-2'>You can support Unbound by:</FaqAnswer>
						<ProseList>
							<ProseItem>Contributing code, plugins, or themes</ProseItem>
							<ProseItem>Reporting bugs and helping test new features</ProseItem>
							<ProseItem>Helping other users in our Discord server</ProseItem>
							<ProseItem>Spreading the word about Unbound</ProseItem>
							<ProseItem>Starring our repository on GitHub</ProseItem>
						</ProseList>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value='more-questions'>
					<AccordionTrigger>Still have questions?</AccordionTrigger>
					<AccordionContent>
						<FaqAnswer>
							If you couldn't find the answer to your question, feel free to reach out
							to us on our{' '}
							<FaqLink href='https://discord.gg/rMdzhWUaGT'>Discord server</FaqLink>{' '}
							or check our{' '}
							<FaqLink href='https://docs.unbound.rip'>documentation</FaqLink>.
						</FaqAnswer>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}

export const Route = createFileRoute('/_site/faq')({
	head: () => ({ meta: [{ title: 'Unbound | FAQ' }] }),
	component: FaqPage,
});
