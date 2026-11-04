// Type-level test: `bun run typecheck` checks this file against the generated `unbound-i18n.d.ts` beside it.
import { format, messages, useMessages } from '@unbound-app/i18n';

export const title: string = messages.GREETING_TITLE;
export const body: string = format('GREETING_BODY', { name: 'Wumpus' });
export const unread: string = format('UNREAD_COUNT', { count: 3 });
export const plain: string = format('GREETING_TITLE');
export const locale: string = useMessages();

// @ts-expect-error a wrong placeholder name
format('GREETING_BODY', { nmae: 'Wumpus' });

// @ts-expect-error a key with placeholders needs its values
format('GREETING_BODY');

// @ts-expect-error a plural takes a number
format('UNREAD_COUNT', { count: 'three' });

// @ts-expect-error a key en-US does not have
format('GREETING_FOOTER');

// @ts-expect-error a key en-US does not have
void messages.GREETING_FOOTER;
