//! The checker against the real tsrs server and the embedded declarations.

use lsp_types::{CompletionResponse, HoverContents, MarkupContent, Position};
use unbound_devtools_repl::checker;

fn labels(response: CompletionResponse) -> Vec<String> {
	let items = match response {
		CompletionResponse::Array(items) => items,
		CompletionResponse::List(list) => list.items,
	};
	items.into_iter().map(|item| item.label).collect()
}

fn end_of(text: &str) -> Position {
	let line = text.lines().count().saturating_sub(1) as u32;
	let character = text.lines().last().unwrap_or("").chars().count() as u32;
	Position { line, character }
}

#[test]
fn types_the_buffer_against_the_api_history_and_results() {
	let checker = checker::shared().expect("the checker starts");

	let buffer = "unbound.";
	let api = labels(checker.completions(buffer, end_of(buffer)).unwrap());
	assert!(api.iter().any(|label| label == "metro"), "{api:?}");

	let buffer = "const store = unbound.flux.getStore('User');";
	let hover = checker
		.hover(
			buffer,
			Position {
				line: 0,
				character: 8,
			},
		)
		.unwrap()
		.expect("a hover");
	let HoverContents::Markup(MarkupContent { value, .. }) = hover.contents else {
		panic!("markdown hover");
	};
	assert!(value.contains("UserStore"), "{value}");

	checker.set_history("var greeting = 'hi';\n");
	let buffer = "greeting.";
	let history = labels(checker.completions(buffer, end_of(buffer)).unwrap());
	assert!(
		history.iter().any(|label| label == "toUpperCase"),
		"{history:?}"
	);

	checker.set_results("declare var $1: { id: string; getName(...args: any[]): any };\n");
	let buffer = "$1.";
	let result = labels(checker.completions(buffer, end_of(buffer)).unwrap());
	assert!(result.iter().any(|label| label == "getName"), "{result:?}");

	let errors = checker.diagnostics("const n: number = 'one';").unwrap();
	assert_eq!(errors.len(), 1, "{errors:?}");
	assert!(
		checker
			.diagnostics("const greeting = 'again';")
			.unwrap()
			.is_empty()
	);
}

#[test]
fn allows_top_level_await() {
	let checker = checker::shared().expect("the checker starts");

	let errors = checker
		.diagnostics("const waited = await Promise.resolve(1);\nfor await (const n of [waited]) n;")
		.unwrap();
	assert!(errors.is_empty(), "{errors:?}");
}

#[test]
fn shows_the_signature_of_the_call_being_typed() {
	let checker = checker::shared().expect("the checker starts");

	let buffer = "unbound.flux.getStore()";
	let open = Position {
		line: 0,
		character: 22,
	};
	let help = checker
		.signature_help(buffer, open, false)
		.unwrap()
		.expect("signature help");
	let signature = &help.signatures[help.active_signature.unwrap_or(0) as usize];
	assert!(signature.label.starts_with("getStore("), "{help:?}");
	assert_eq!(help.active_parameter, Some(0), "{help:?}");

	let buffer = "'text'.slice(1, )";
	let second = Position {
		line: 0,
		character: 16,
	};
	let help = checker
		.signature_help(buffer, second, true)
		.unwrap()
		.expect("signature help");
	assert_eq!(help.active_parameter, Some(1), "{help:?}");

	let outside = checker
		.signature_help("'text'.slice(1)", end_of("'text'.slice(1)"), true)
		.unwrap();
	assert!(outside.is_none(), "{outside:?}");
}

#[test]
fn counts_columns_in_characters_past_an_emoji() {
	let checker = checker::shared().expect("the checker starts");

	let buffer = "const face = '😀'; face.";
	let members = labels(checker.completions(buffer, end_of(buffer)).unwrap());
	assert!(
		members.iter().any(|label| label == "codePointAt"),
		"{members:?}"
	);

	// `face` after the emoji starts at character 18, UTF-16 unit 19.
	let hover = checker
		.hover(
			buffer,
			Position {
				line: 0,
				character: 18,
			},
		)
		.unwrap()
		.expect("a hover");
	let range = hover.range.expect("a range");
	assert_eq!((range.start.character, range.end.character), (18, 22));

	let errors = checker
		.diagnostics("const face = '😀'; face.nope;")
		.unwrap();
	assert_eq!(errors.len(), 1, "{errors:?}");
	assert_eq!(errors[0].range.start.character, 23, "{errors:?}");
}
