import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '~/components/ui/card';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

/** `page` gives each section a card; `dialog` drops the chrome, since the dialog is already a surface. */
export type SubmitVariant = 'page' | 'dialog';

type SlotProps = {
	className?: string;
	children?: ReactNode;
};

type Slot = ComponentType<SlotProps>;

type SectionChrome = {
	Root: Slot;
	Header: Slot;
	Title: Slot;
	Content: Slot;
	Footer: Slot;
};

type SubmitSectionProps = {
	title: ReactNode;
	description?: ReactNode;
	/** Sits beside the title. */
	action?: ReactNode;
	footer?: ReactNode;
	className?: string;
	children?: ReactNode;
};

function DialogRoot({ className, ...props }: ComponentProps<'div'>) {
	return (
		<section
			className={cn(
				'flex flex-col gap-4 pt-6 first:pt-0 border-t first:border-t-0 min-w-0',
				className,
			)}
			{...props}
		/>
	);
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'items-start gap-1.5 grid has-data-[slot=card-action]:grid-cols-[1fr_auto] auto-rows-min',
				className,
			)}
			{...props}
		/>
	);
}

function DialogTitle({ className, children }: SlotProps) {
	return (
		<Text as='h3' variant='text-md' className={cn('font-semibold', className)}>
			{children}
		</Text>
	);
}

function DialogContent(props: ComponentProps<'div'>) {
	return <div {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
	return <div className={cn('flex items-center', className)} {...props} />;
}

const CHROME: Record<SubmitVariant, SectionChrome> = {
	page: {
		Root: Card,
		Header: CardHeader,
		Title: CardTitle,
		Content: CardContent,
		Footer: CardFooter,
	},
	dialog: {
		Root: DialogRoot,
		Header: DialogHeader,
		Title: DialogTitle,
		Content: DialogContent,
		Footer: DialogFooter,
	},
};

export const SubmitVariantContext = createContext<SubmitVariant>('page');

/**
 * @description The surface a submit section sits on: a card on the page, nothing extra in a dialog.
 * @param props The surface's class name and children.
 * @returns The section's root.
 */
export function SubmitSurface(props: SlotProps) {
	const { Root } = CHROME[useContext(SubmitVariantContext)];

	return <Root {...props} />;
}

/**
 * @description One titled step of the submit form, dressed for the variant it renders in.
 * @param props The title, description, header action, footer and content.
 * @returns The section.
 */
export function SubmitSection({
	title,
	description,
	action,
	footer,
	className,
	children,
}: SubmitSectionProps) {
	const { Root, Header, Title, Content, Footer } = CHROME[useContext(SubmitVariantContext)];

	return (
		<Root className={className}>
			<Header>
				<Title>{title}</Title>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{action ? <CardAction>{action}</CardAction> : null}
			</Header>
			{children ? <Content>{children}</Content> : null}
			{footer ? <Footer>{footer}</Footer> : null}
		</Root>
	);
}

export default { SubmitVariantContext, SubmitSurface, SubmitSection };
