type SourceBadgeProps = {
	/** The app's icon under `public/`. */
	icon: string;
	name: string;
	href: string;
	/** The line above the name. */
	action?: string;
	/** Opens the link in a new tab, for a web page rather than an app link. */
	external?: boolean;
};

/**
 * @description A store-style badge that opens an app with Unbound's source or repo filled in.
 * @param props The app's icon, name and link, what the badge does and whether it opens a web page.
 * @returns The badge.
 */
function SourceBadge({ icon, name, href, action = 'Add to', external = false }: SourceBadgeProps) {
	return (
		<a
			href={href}
			target={external ? '_blank' : undefined}
			rel={external ? 'noopener noreferrer' : undefined}
			className='inline-flex items-center gap-2.5 bg-secondary hover:bg-accent [--ledge:var(--ledge-secondary)] py-1.5 pr-4 pl-1.5 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-12 transition-colors press'
		>
			<img
				src={icon}
				alt=''
				width={32}
				height={32}
				className='shadow-key rounded-[9px] size-8 shrink-0'
			/>
			<span className='flex flex-col leading-tight'>
				<span className='text-[10px] text-muted-foreground'>{action}</span>
				<span className='font-semibold text-foreground text-sm'>{name}</span>
			</span>
		</a>
	);
}

export default SourceBadge;
