//! The signature card's content: the call's parameter list with the argument being typed picked
//! out, read from tsrs's signature help, and when typing should ask for it.

use std::ops::Range;

use gpui::SharedString;
use lsp_types::{Documentation, ParameterLabel, SignatureHelp, SignatureInformation};

pub struct SignatureCard {
	pub label: SharedString,
	/// The active parameter's bytes in `label`; empty when the call takes none.
	pub active: Range<usize>,
	/// The active parameter's docs, then the signature's, as markdown.
	pub docs: Option<SharedString>,
	/// Which overload shows, and how many there are.
	pub index: usize,
	pub count: usize,
}

/// Whether the last thing typed before `offset` opens a call or starts its next argument.
pub fn opens_arguments(text: &str, offset: usize) -> bool {
	text.get(..offset)
		.and_then(|before| before.trim_end_matches([' ', '\t']).chars().last())
		.is_some_and(|c| matches!(c, '(' | ','))
}

/// The byte offset `units` UTF-16 code units into `label`.
fn utf16_byte(label: &str, units: u32) -> Option<usize> {
	let mut counted = 0;
	for (at, c) in label.char_indices() {
		if counted == units {
			return Some(at);
		}
		counted += c.len_utf16() as u32;
	}

	(counted == units).then_some(label.len())
}

/// Byte range of a UTF-16 span in `label`, as LSP counts offsets.
fn utf16_range(label: &str, [start, end]: [u32; 2]) -> Option<Range<usize>> {
	Some(utf16_byte(label, start)?..utf16_byte(label, end)?)
}

/// Where each parameter sits in the signature's label, searched left to right after the `(`.
fn parameter_ranges(signature: &SignatureInformation) -> Vec<Range<usize>> {
	let label = &signature.label;
	let mut from = label.find('(').unwrap_or(0);
	signature
		.parameters
		.iter()
		.flatten()
		.map(|parameter| match &parameter.label {
			ParameterLabel::LabelOffsets(offsets) => utf16_range(label, *offsets).unwrap_or(0..0),
			ParameterLabel::Simple(name) => match label[from..].find(name.as_str()) {
				Some(at) => {
					let start = from + at;
					from = start + name.len();
					start..from
				}
				None => 0..0,
			},
		})
		.collect()
}

fn documentation_text(docs: &Documentation) -> &str {
	match docs {
		Documentation::String(text) => text,
		Documentation::MarkupContent(markup) => &markup.value,
	}
}

/// The card for tsrs's answer; `None` when it found no call.
pub fn card(help: SignatureHelp) -> Option<SignatureCard> {
	let count = help.signatures.len();
	let index = (help.active_signature.unwrap_or(0) as usize).min(count.checked_sub(1)?);
	let signature = help.signatures.into_iter().nth(index)?;
	let active_index = signature
		.active_parameter
		.or(help.active_parameter)
		.unwrap_or(0) as usize;
	let active = parameter_ranges(&signature)
		.get(active_index)
		.cloned()
		.unwrap_or(0..0);
	let parameter_docs = signature
		.parameters
		.as_ref()
		.and_then(|parameters| parameters.get(active_index))
		.and_then(|parameter| parameter.documentation.as_ref())
		.map(documentation_text);
	let docs: Vec<&str> = [
		parameter_docs,
		signature.documentation.as_ref().map(documentation_text),
	]
	.into_iter()
	.flatten()
	.map(str::trim)
	.filter(|text| !text.is_empty())
	.collect();

	Some(SignatureCard {
		label: signature.label.into(),
		active,
		docs: (!docs.is_empty()).then(|| docs.join("\n\n").into()),
		index,
		count,
	})
}

#[cfg(test)]
mod tests {
	use lsp_types::ParameterInformation;

	use super::*;

	fn help(label: &str, parameters: &[&str], active: u32) -> SignatureHelp {
		SignatureHelp {
			signatures: vec![SignatureInformation {
				label: label.to_owned(),
				documentation: None,
				parameters: Some(
					parameters
						.iter()
						.map(|name| ParameterInformation {
							label: ParameterLabel::Simple((*name).to_owned()),
							documentation: None,
						})
						.collect(),
				),
				active_parameter: None,
			}],
			active_signature: Some(0),
			active_parameter: Some(active),
		}
	}

	#[test]
	fn picks_out_the_active_parameter() {
		let label = "getStore(name: string, fallback: string): Store";
		let card = card(help(label, &["name: string", "fallback: string"], 1)).unwrap();
		assert_eq!(&label[card.active], "fallback: string");
	}

	#[test]
	fn finds_a_repeated_type_in_its_own_parameter() {
		let label = "f(a: a, b: a): a";
		let card = card(help(label, &["a: a", "b: a"], 0)).unwrap();
		assert_eq!(card.active, 2..6);
	}

	#[test]
	fn reads_utf16_offsets() {
		assert_eq!(utf16_range("f(é: 1)", [2, 6]), Some(2..7));
	}

	#[test]
	fn opens_on_a_paren_or_comma() {
		assert!(opens_arguments("foo(", 4));
		assert!(opens_arguments("foo(a, ", 7));
		assert!(!opens_arguments("foo(a", 5));
		assert!(!opens_arguments("", 0));
	}
}
