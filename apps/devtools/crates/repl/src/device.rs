//! What the console sends to run an entry, and how it reads the answer. The helper in `device.js`
//! goes over once per device session; later entries call it by name, so each request carries only
//! the entry, and each answer at most a 16 KB preview and a 6 KB type. A value the preview folds
//! opens later by its path from `$n` ([`expand_request`]).

use std::ops::Range;

use serde_json::{Map, Value};

/// The helper's global on the device, which an error names when the device lost it.
const HELPER_GLOBAL: &str = "__unboundRepl";
const HELPER: &str = include_str!("device.js");

/// The code that runs `js` as entry `n`. `install` sends the helper too.
pub fn request(n: u32, js: &str, install: bool) -> String {
	let source = serde_json::Value::String(js.to_owned());
	if install {
		// The formatter ends the file with `;`, which can't sit inside the parentheses.
		let helper = HELPER.trim_end().trim_end_matches(';');
		format!("(globalThis.{HELPER_GLOBAL} = {helper})({n}, {source})")
	} else {
		format!("{HELPER_GLOBAL}({n}, {source})")
	}
}

/// Whether an error says the device has no helper, as after Discord restarts. Hermes says the
/// property "doesn't exist"; other engines that it "is not defined".
pub fn is_missing_helper(error: &str) -> bool {
	error.contains(HELPER_GLOBAL)
		&& (error.contains("doesn't exist") || error.contains("is not defined"))
}

/// A result as the device summarised it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Preview {
	pub text: String,
	/// The value's shape as a TypeScript type, for `$n`.
	pub ty: String,
	/// Whether the preview left something out.
	pub truncated: bool,
	/// The values it left folded, in text order.
	pub folds: Vec<Folded>,
}

/// A value a preview shows folded, as `{…}` or `Set(2) […]`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Folded {
	/// Its text in the preview, in bytes, on one line.
	pub range: Range<usize>,
	/// The steps to it from `$n`, as the helper wrote them; sent back unread.
	pub path: Vec<Value>,
}

/// The byte offset in `line` of UTF-16 column `column`.
fn byte_offset(line: &str, column: usize) -> usize {
	let mut units = 0;
	for (offset, c) in line.char_indices() {
		if units >= column {
			return offset;
		}
		units += c.len_utf16();
	}
	line.len()
}

/// The folds the helper listed, placed in `text` by byte. A fold that doesn't fit its line is dropped.
fn folds(text: &str, listed: Option<&Value>) -> Vec<Folded> {
	let Some(Value::Array(listed)) = listed else {
		return Vec::new();
	};
	let mut starts = vec![0];
	starts.extend(text.match_indices('\n').map(|(at, _)| at + 1));
	listed
		.iter()
		.filter_map(|fold| {
			let number = |name: &str| fold.get(name)?.as_u64().map(|n| n as usize);
			let line_start = *starts.get(number("line")?)?;
			let line = text[line_start..].split('\n').next().unwrap_or_default();
			let (start, end) = (number("start")?, number("end")?);
			let path = fold.get("path")?.as_array()?.clone();
			(start < end).then(|| Folded {
				range: line_start + byte_offset(line, start)..line_start + byte_offset(line, end),
				path,
			})
		})
		.collect()
}

/// A preview from the helper's answer fields.
fn preview(fields: &Map<String, Value>) -> Preview {
	let text = fields
		.get("text")
		.and_then(Value::as_str)
		.unwrap_or_default()
		.to_owned();
	Preview {
		folds: folds(&text, fields.get("folds")),
		text,
		ty: fields
			.get("type")
			.and_then(Value::as_str)
			.unwrap_or("any")
			.to_owned(),
		truncated: fields.get("truncated").and_then(Value::as_bool) == Some(true),
	}
}

/// Reads the helper's answer: a preview, or what the entry threw. Anything else, such as an older
/// helper's answer, shows as raw text.
pub fn parse(reply: &str) -> Result<Preview, String> {
	let Ok(Value::Object(fields)) = serde_json::from_str(reply) else {
		return Ok(Preview {
			text: reply.to_owned(),
			ty: "any".to_owned(),
			truncated: false,
			folds: Vec::new(),
		});
	};
	if let Some(error) = fields.get("error").and_then(Value::as_str) {
		return Err(error.to_owned());
	}

	Ok(preview(&fields))
}

/// The code that previews the values at `paths` from `$n`, in one answer.
pub fn expand_request(n: u32, paths: &[&[Value]]) -> String {
	let paths = serde_json::to_string(paths).unwrap_or_else(|_| "[]".to_owned());
	format!("{HELPER_GLOBAL}.expand({n}, {paths})")
}

/// Reads an [`expand_request`]'s answer: per path, its preview, what reading it threw, or `None`
/// when the answer ran out of room before it.
pub fn parse_expansions(reply: &str) -> Result<Vec<Option<Result<Preview, String>>>, String> {
	let Ok(Value::Array(items)) = serde_json::from_str(reply) else {
		return Err(reply.to_owned());
	};

	Ok(items
		.iter()
		.map(|item| {
			let fields = item.as_object()?;
			Some(match fields.get("error").and_then(Value::as_str) {
				Some(error) => Err(error.to_owned()),
				None => Ok(preview(fields)),
			})
		})
		.collect())
}

/// The declaration that types result `n` for later entries.
pub fn declaration(n: u32, ty: &str) -> String {
	format!("declare var ${n}: {ty};\n")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_later_request_carries_only_the_entry() {
		let first = request(1, "1 + 1", true);
		let later = request(2, "1 + 1", false);
		assert!(first.contains("PREVIEW_BUDGET"));
		assert_eq!(later, "__unboundRepl(2, \"1 + 1\")");
	}

	#[test]
	fn reads_the_helper_answer_or_falls_back_to_text() {
		let preview =
			parse(r#"{"text":"{ a: 1 }","truncated":true,"type":"{ a: number }"}"#).unwrap();
		assert_eq!(preview.ty, "{ a: number }");
		assert!(preview.truncated);
		assert_eq!(parse("2").unwrap().text, "2");
		assert_eq!(
			parse(r#"{"error":"TypeError: x"}"#),
			Err("TypeError: x".to_owned())
		);
	}

	#[test]
	fn places_folds_by_byte_and_reads_expansions() {
		let reply = r#"{"text":"{\n  \"é\": {…},\n}","folds":[{"line":1,"start":7,"end":10,"path":[{"k":"é"}]}]}"#;
		let preview = parse(reply).unwrap();
		let fold = &preview.folds[0];
		assert_eq!(&preview.text[fold.range.clone()], "{…}");
		assert_eq!(fold.path, vec![serde_json::json!({ "k": "é" })]);
		let path = fold.path.as_slice();
		assert_eq!(
			expand_request(3, &[path]),
			r#"__unboundRepl.expand(3, [[{"k":"é"}]])"#
		);
		let answers = parse_expansions(r#"[{"text":"1"},{"error":"x"},null]"#).unwrap();
		assert_eq!(answers[0].as_ref().unwrap().as_ref().unwrap().text, "1");
		assert_eq!(answers[1], Some(Err("x".to_owned())));
		assert_eq!(answers[2], None);
	}

	#[test]
	fn knows_a_device_without_the_helper() {
		assert!(is_missing_helper(
			"ReferenceError: Property '__unboundRepl' doesn't exist"
		));
		assert!(!is_missing_helper("TypeError: x is not a function"));
	}
}
