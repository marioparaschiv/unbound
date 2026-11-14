use serde_json::{Value as Json, json};
use unbound_devtools_core::react_protocol::{OverrideTarget, ReactOutbound, encode};
use unbound_devtools_core::{ElementId, PathSegment, RendererId};

fn sent(message: &ReactOutbound) -> (String, Json) {
	let frame: Json = serde_json::from_str(&encode(message)).expect("frame is JSON");

	(
		frame["event"].as_str().expect("event").to_owned(),
		frame["payload"].clone(),
	)
}

fn key(name: &str) -> PathSegment {
	PathSegment::Key(name.into())
}

#[test]
fn an_undefined_override_carries_no_value() {
	let (event, payload) = sent(&ReactOutbound::OverrideValueAtPath {
		target: OverrideTarget::State,
		id: ElementId(4),
		renderer: RendererId(1),
		path: vec![key("label")],
		value: None,
	});

	assert_eq!(event, "overrideValueAtPath");
	assert!(payload.get("value").is_none(), "{payload}");
	assert_eq!(payload["path"], json!(["label"]));
}

#[test]
fn hook_edits_address_the_hook_by_id() {
	let (event, payload) = sent(&ReactOutbound::RenamePath {
		target: OverrideTarget::Hooks,
		id: ElementId(4),
		renderer: RendererId(1),
		old_path: vec![PathSegment::Index(2), key("a")],
		new_path: vec![PathSegment::Index(2), key("b")],
	});

	assert_eq!(event, "renamePath");
	assert_eq!(payload["hookID"], json!(2));
	assert_eq!(payload["oldPath"], json!(["a"]));
	assert_eq!(payload["newPath"], json!(["b"]));

	let (event, payload) = sent(&ReactOutbound::DeletePath {
		target: OverrideTarget::Props,
		id: ElementId(4),
		renderer: RendererId(1),
		path: vec![key("style"), PathSegment::Index(0)],
	});

	assert_eq!(event, "deletePath");
	assert_eq!(payload["hookID"], Json::Null);
	assert_eq!(payload["path"], json!(["style", 0]));
	assert_eq!(payload["type"], json!("props"));
}

#[test]
fn boundary_toggles_name_their_flag() {
	let (event, payload) = sent(&ReactOutbound::OverrideSuspense {
		id: ElementId(9),
		renderer: RendererId(1),
		force_fallback: true,
	});
	assert_eq!(event, "overrideSuspense");
	assert_eq!(
		payload,
		json!({ "forceFallback": true, "id": 9, "rendererID": 1 })
	);

	let (event, payload) = sent(&ReactOutbound::OverrideError {
		id: ElementId(9),
		renderer: RendererId(1),
		force_error: false,
	});
	assert_eq!(event, "overrideError");
	assert_eq!(
		payload,
		json!({ "forceError": false, "id": 9, "rendererID": 1 })
	);
}
