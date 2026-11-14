//! What the console sends to run an entry, and how it reads the answer. The helper in `device.js`
//! goes over once per device session; later entries call it by name, so each request carries only
//! the entry, and each answer at most a 16 KB preview and a 6 KB type.

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
}

/// Reads the helper's answer: a preview, or what the entry threw. Anything else, such as an older
/// helper's answer, shows as raw text.
pub fn parse(reply: &str) -> Result<Preview, String> {
	let Ok(serde_json::Value::Object(fields)) = serde_json::from_str(reply) else {
		return Ok(Preview {
			text: reply.to_owned(),
			ty: "any".to_owned(),
			truncated: false,
		});
	};
	let text = |name: &str| {
		fields
			.get(name)
			.and_then(|value| value.as_str())
			.map(str::to_owned)
	};
	if let Some(error) = text("error") {
		return Err(error);
	}

	Ok(Preview {
		text: text("text").unwrap_or_default(),
		ty: text("type").unwrap_or_else(|| "any".to_owned()),
		truncated: fields.get("truncated").and_then(serde_json::Value::as_bool) == Some(true),
	})
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
	fn knows_a_device_without_the_helper() {
		assert!(is_missing_helper(
			"ReferenceError: Property '__unboundRepl' doesn't exist"
		));
		assert!(!is_missing_helper("TypeError: x is not a function"));
	}
}
