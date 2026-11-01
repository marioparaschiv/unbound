import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';

import { Accordion, AccordionGroup } from '~/components/guides/accordion';
import { ParamField, ResponseField } from '~/components/guides/field';
import { Note, Tip, Warning } from '~/components/guides/callout';
import { Card, CardGroup } from '~/components/guides/card';
import Expandable from '~/components/guides/expandable';
import { Step, Steps } from '~/components/guides/steps';
import CodeBlock from '~/components/guides/code-block';
import GuideLink from '~/components/guides/guide-link';
import { Tab, Tabs } from '~/components/guides/tabs';
import Heading from '~/components/guides/heading';
import Icon from '~/components/guides/icon';

function H2(props: ComponentProps<'h2'>) {
	return (
		<Heading level='h2' id={props.id}>
			{props.children}
		</Heading>
	);
}

function H3(props: ComponentProps<'h3'>) {
	return (
		<Heading level='h3' id={props.id}>
			{props.children}
		</Heading>
	);
}

function H4(props: ComponentProps<'h4'>) {
	return (
		<Heading level='h4' id={props.id}>
			{props.children}
		</Heading>
	);
}

function Paragraph(props: ComponentProps<'p'>) {
	return <p className='text-foreground/80 leading-7' {...props} />;
}

function UnorderedList(props: ComponentProps<'ul'>) {
	return (
		<ul
			className='flex flex-col gap-1.5 pl-6 text-foreground/80 list-disc leading-7'
			{...props}
		/>
	);
}

function OrderedList(props: ComponentProps<'ol'>) {
	return (
		<ol
			className='flex flex-col gap-1.5 pl-6 text-foreground/80 list-decimal leading-7'
			{...props}
		/>
	);
}

function ListItem(props: ComponentProps<'li'>) {
	return <li className='pl-1 marker:text-muted-foreground/70' {...props} />;
}

function Strong(props: ComponentProps<'strong'>) {
	return <strong className='font-semibold text-foreground' {...props} />;
}

function Blockquote(props: ComponentProps<'blockquote'>) {
	return <blockquote className='flex flex-col gap-3 pl-4 border-border border-l-2' {...props} />;
}

function Rule() {
	return <hr className='border-border' />;
}

function Image({ alt = '', ...props }: ComponentProps<'img'>) {
	return <img alt={alt} className='border rounded-control max-w-full h-auto' {...props} />;
}

// Wide tables scroll inside their frame instead of widening the page.
function Table(props: ComponentProps<'table'>) {
	return (
		<div className='border rounded-control min-w-0 overflow-x-auto'>
			<table className='w-full text-sm border-collapse' {...props} />
		</div>
	);
}

function TableHead(props: ComponentProps<'thead'>) {
	return <thead className='bg-muted/50' {...props} />;
}

function TableRow(props: ComponentProps<'tr'>) {
	return <tr className='border-b last:border-b-0' {...props} />;
}

function HeaderCell(props: ComponentProps<'th'>) {
	return (
		<th
			className='px-3 py-2 font-medium text-foreground text-left whitespace-nowrap'
			{...props}
		/>
	);
}

function Cell(props: ComponentProps<'td'>) {
	return <td className='px-3 py-2 text-muted-foreground align-top' {...props} />;
}

/** What each element and Mintlify component in a guide renders as. */
export const GUIDE_COMPONENTS: MDXComponents = {
	Accordion,
	AccordionGroup,
	Card,
	CardGroup,
	Expandable,
	Icon,
	Note,
	ParamField,
	ResponseField,
	Step,
	Steps,
	Tab,
	Tabs,
	Tip,
	Warning,
	a: GuideLink,
	pre: CodeBlock,
	h2: H2,
	h3: H3,
	h4: H4,
	p: Paragraph,
	ul: UnorderedList,
	ol: OrderedList,
	li: ListItem,
	strong: Strong,
	blockquote: Blockquote,
	hr: Rule,
	img: Image,
	table: Table,
	thead: TableHead,
	tr: TableRow,
	th: HeaderCell,
	td: Cell,
};

export default GUIDE_COMPONENTS;
