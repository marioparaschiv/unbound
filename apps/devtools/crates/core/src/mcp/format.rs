//! Text the MCP tools return: compact lines an agent can act on.

use serde_json::Value as Json;

use crate::query::{MAX_PROPS_CANDIDATES, PropsMatches};
use crate::store::{ElementId, Store};

pub(super) const KIND_LABELS: &str = "function, class, memo, forward_ref, host, context, \
	suspense, suspense_list, profiler, activity, view_transition, tracing_marker, virtual, other";

/// `#42 <MessageRow key="m1"> memo  in ScrollView > Channel > App`, one per id.
pub(super) fn matches(store: &Store, ids: &[ElementId], props: Option<&PropsMatches>) -> String {
	let mut lines = vec![match ids.len() {
		0 => "No matches.".to_owned(),
		1 => "1 match:".to_owned(),
		n => format!("{n} matches:"),
	}];

	lines.extend(ids.iter().filter_map(|id| element_line(store, *id)));

	if let Some(props) = props {
		lines.push(format!(
			"Inspected {} of {} candidates.",
			props.inspected, props.candidates
		));

		if props.capped() {
			lines.push(format!(
				"Capped at {MAX_PROPS_CANDIDATES} inspections; narrow with name, kind, key or within."
			));
		}

		if let Some((id, error)) = props.failures.first() {
			lines.push(format!(
				"{} candidates failed (first: #{} {error}).",
				props.failures.len(),
				id.0
			));
		}
	}

	lines.join("\n")
}

fn element_line(store: &Store, id: ElementId) -> Option<String> {
	let element = store.get(id)?;
	let key = element
		.key
		.as_deref()
		.map(|key| format!(" key={}", Json::from(key)))
		.unwrap_or_default();
	let ancestors: Vec<&str> = store
		.ancestors(id)
		.filter(|ancestor| ancestor.parent.is_some())
		.map(|ancestor| &*ancestor.name)
		.collect();
	let mut line = format!("#{} <{}{key}> {}", id.0, element.name, element.kind.label());

	if !ancestors.is_empty() {
		line.push_str("  in ");
		line.push_str(&ancestors.join(" > "));
	}

	Some(line)
}

pub(super) fn selection(store: &Store, id: Option<ElementId>) -> String {
	match id {
		None => "Nothing is selected.".to_owned(),
		Some(id) => element_line(store, id).map_or_else(
			|| format!("#{} is selected but no longer in the tree.", id.0),
			|line| format!("Selected {line}"),
		),
	}
}

pub(super) fn pretty(json: &Json) -> String {
	serde_json::to_string_pretty(json).unwrap_or_else(|_| json.to_string())
}

pub(super) fn cap(text: String, max_chars: usize) -> String {
	if text.len() <= max_chars {
		return text;
	}

	let cut = text
		.char_indices()
		.nth(max_chars)
		.map_or(text.len(), |(index, _)| index);
	format!(
		"{}\n… cut at {max_chars} characters; narrow the request.",
		&text[..cut]
	)
}
