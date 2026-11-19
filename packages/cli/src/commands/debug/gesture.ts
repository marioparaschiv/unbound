import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	fromX: Type.Number({ description: 'Where the drag starts, in points (iOS) or dp (Android).' }),
	fromY: Type.Number({ description: 'Where the drag starts, in points (iOS) or dp (Android).' }),
	dx: defaulted(
		Type.Number({ description: 'How far it moves right; negative moves left.' }),
		-100,
	),
	dy: defaulted(Type.Number({ description: 'How far it moves down; negative moves up.' }), 0),
	duration: defaulted(
		Type.Number({ description: 'How long the move takes, in milliseconds.' }),
		300,
	),
	hold: defaulted(
		Type.Number({ description: 'How long the finger stays down at the end, in milliseconds.' }),
		0,
	),
	steps: defaulted(Type.Number({ description: 'How many moves the drag is split into.' }), 12),
	port: bridgePortField,
});

const gestureCommand: CommandDefinition<typeof schema> = {
	name: 'gesture',
	description:
		'Drive a drag on the connected device and hold it as long as asked, which replayed touches cannot: ' +
		'swipe to reply, drag a sheet, scrub a slider. Android sends real touch events to the current ' +
		'activity. iOS drives the first pan gesture recognizer above the point through its own targets, ' +
		"so it reaches the view's pan handler but not UIKit's scroll views.",
	summary: 'Drive a held drag on a view.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./gesture-handler')),
};

export default gestureCommand;
