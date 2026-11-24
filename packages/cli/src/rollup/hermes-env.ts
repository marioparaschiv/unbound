/**
 * The language level Discord's Hermes compiles from source, the client's `.swcrc` env; parameters are lowered
 * because Hermes loses the return value of async arrows with destructured, default or rest parameters.
 */
export const HERMES_SOURCE_ENV = {
	targets: 'fully supports es6',
	include: [
		'transform-block-scoping',
		'transform-async-generator-functions',
		'transform-parameters',
	],
	exclude: [
		'transform-async-to-generator',
		'transform-class-properties',
		'transform-private-methods',
		'transform-class-static-block',
		'transform-private-property-in-object',
		'transform-typeof-symbol',
		'transform-template-literals',
		'transform-exponentiation-operator',
		'transform-named-capturing-groups-regex',
		'transform-nullish-coalescing-operator',
		'transform-object-rest-spread',
		'transform-optional-chaining',
		'transform-logical-assignment-operators',
	],
};

export default { HERMES_SOURCE_ENV };
