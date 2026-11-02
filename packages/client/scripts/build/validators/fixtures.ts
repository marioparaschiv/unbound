import { Type } from 'typebox';

/** An object with an optional field, a nullable union, arrays, literals, a record and a nested object. */
export const personSchema = Type.Object({
	name: Type.String({ minLength: 1, maxLength: 40 }),
	age: Type.Optional(Type.Integer({ minimum: 0, maximum: 150 })),
	nickname: Type.Union([Type.String({ minLength: 2 }), Type.Null()]),
	tags: Type.Array(Type.String({ maxLength: 12 }), { maxItems: 3 }),
	role: Type.Enum({ admin: 'admin', member: 'member' }),
	scores: Type.Record(Type.String(), Type.Number()),
	address: Type.Object({
		city: Type.String(),
		zip: Type.Optional(Type.String({ pattern: '^\\d{5}$' })),
	}),
});

/** String formats, which code inlines as small local checkers. */
export const contactSchema = Type.Object({
	email: Type.String({ format: 'email' }),
	url: Type.String({ format: 'url' }),
	uuid: Type.String({ format: 'uuid' }),
	created: Type.String({ format: 'date-time' }),
});

/** `uniqueItems` compares through typebox's `Hashing.Hash`. */
export const lotterySchema = Type.Object({
	draws: Type.Array(Type.Integer({ minimum: 1, maximum: 49 }), { uniqueItems: true }),
});

/** A pattern compiles to a `RegExp` external; a record key pattern does too. */
export const slugSchema = Type.Object({
	slug: Type.String({ pattern: '^[a-z][a-z0-9-]*$' }),
	headers: Type.Record(Type.String({ pattern: '^x-' }), Type.String()),
});

/** `minLength` counts Unicode code points through `Guard.CodePointCount`. */
export const emojiSchema = Type.Object({
	message: Type.String({ minLength: 3, maxLength: 5 }),
});

/** A tuple, an intersection and a bare array. */
export const shapeSchema = Type.Intersect([
	Type.Object({ point: Type.Tuple([Type.Number(), Type.Number()]) }),
	Type.Object({ labels: Type.Array(Type.String(), { minItems: 1 }) }),
]);

/** An object that rejects undeclared keys. */
export const strictSchema = Type.Object(
	{ id: Type.Integer({ minimum: 1 }) },
	{ additionalProperties: false },
);
