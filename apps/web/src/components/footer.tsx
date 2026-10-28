import { Link } from '@tanstack/react-router';

import DiscordIcon from '~/components/icons/discord';
import GitHubIcon from '~/components/icons/github';
import Separator from '~/components/ui/separator';
import Logo from '~/components/icons/logo';

type FooterLink = {
	label: string;
	href: string;
};

type FooterColumnProps = {
	title: string;
	links: FooterLink[];
};

const CURRENT_YEAR = new Date().getFullYear();

const PRODUCT_LINKS: FooterLink[] = [
	{ label: 'Plugins', href: '/plugins' },
	{ label: 'Themes', href: '/themes' },
	{ label: 'Developers', href: '/developers' },
];

const SUPPORT_LINKS: FooterLink[] = [
	{ label: 'FAQ', href: '/faq' },
	{ label: 'Documentation', href: 'https://docs.unbound.rip' },
	{ label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS: FooterLink[] = [
	{ label: 'Privacy Policy', href: '/privacy' },
	{ label: 'Terms of Service', href: '/terms' },
	{ label: 'License', href: '/license' },
];

const SOCIAL_LINKS = [
	{ icon: GitHubIcon, href: 'https://github.com/unbound-app', label: 'GitHub' },
	{ icon: DiscordIcon, href: 'https://discord.gg/rMdzhWUaGT', label: 'Discord' },
];

function FooterColumn({ title, links }: FooterColumnProps) {
	return (
		<div>
			<h3 className='mb-4 font-semibold text-sm'>{title}</h3>
			<ul className='space-y-3'>
				{links.map((link) => (
					<li key={link.href}>
						<Link
							to={link.href}
							className='text-muted-foreground hover:text-foreground text-sm transition-colors'
						>
							{link.label}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

function Footer() {
	return (
		<footer className='mt-auto bg-background border-t'>
			<div className='pt-6 pb-10 md:py-12 page-frame'>
				<div className='flex flex-col lg:flex-row gap-8'>
					<div className='lg:flex-1'>
						<Link to='/' className='inline-block'>
							<Logo className='size-16' />
						</Link>
						<p className='mb-4 max-w-xs text-muted-foreground text-sm'>
							Enhance your experience with our curated collection of plugins and
							themes.
						</p>
						<div className='flex gap-3'>
							{SOCIAL_LINKS.map((social) => (
								<a
									key={social.label}
									href={social.href}
									target='_blank'
									rel='noopener noreferrer'
									className='text-muted-foreground hover:text-foreground transition-colors'
									aria-label={social.label}
								>
									<social.icon className='size-6' />
								</a>
							))}
						</div>
					</div>

					<div className='grid grid-cols-3 gap-8 lg:flex-1'>
						<FooterColumn title='Product' links={PRODUCT_LINKS} />
						<FooterColumn title='Support' links={SUPPORT_LINKS} />
						<FooterColumn title='Legal' links={LEGAL_LINKS} />
					</div>
				</div>

				<Separator className='opacity-50 my-8' />

				<div className='flex md:flex-row flex-col justify-between items-center gap-4'>
					<p className='text-muted-foreground text-sm'>
						© {CURRENT_YEAR} Unbound. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	);
}

export default Footer;
