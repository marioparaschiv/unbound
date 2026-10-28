//! Drives a real react-devtools-core 8 backend: `harness/device.mjs` runs Unbound's devtools.js
//! against react-test-renderer and dials the session under test.

mod common;

use std::time::Duration;

use serde_json::json;
use unbound_devtools_core::query::{self, FindQuery, NameMatch};
use unbound_devtools_core::{ConnectionState, ElementKind, PathSegment, Section, Value};

use common::{connected_session, find_one, key, wait_for};

#[tokio::test(flavor = "multi_thread")]
async fn inspects_edits_and_filters_a_live_backend() {
	let Some((devtools, mut device)) = connected_session().await else {
		return;
	};

	wait_for(&devtools, "the backend version", |devtools| {
		matches!(
			devtools.status().connection,
			ConnectionState::Connected {
				backend_version: Some(_),
				..
			}
		)
	})
	.await;

	let row = find_one(&devtools, "MessageRow", Some("m0"));
	let inspected = devtools.inspect(row).await.expect("MessageRow inspects");
	let props = inspected.props.as_ref().expect("props");

	assert_eq!(inspected.name, "MessageRow");
	assert_eq!(
		props.get(&[key("message"), key("content")]),
		Some(&Value::String("hello 0".into()))
	);
	assert!(inspected.hooks.iter().any(|hook| hook.name == "State"));

	let author = devtools
		.inspect_path(row, vec![key("props"), key("message"), key("author")])
		.await
		.expect("author hydrates");
	assert_eq!(
		author.get(&[key("username")]),
		Some(&Value::String("user0".into()))
	);

	let counter = find_one(&devtools, "Counter", None);
	let count = |element: &unbound_devtools_core::InspectedElement| {
		element
			.state
			.as_ref()
			.and_then(|state| state.get(&[key("count")]).cloned())
	};
	let before = devtools.inspect(counter).await.expect("Counter inspects");
	assert_eq!(count(&before), Some(Value::Number(1.0)));

	devtools
		.override_value(counter, Section::State, vec![key("count")], json!(42))
		.await
		.expect("override sends");
	let after = devtools
		.inspect(counter)
		.await
		.expect("Counter re-inspects");
	assert_eq!(count(&after), Some(Value::Number(42.0)));

	let hook_override = devtools
		.override_value(row, Section::Hooks, vec![key("x")], json!(1))
		.await;
	assert!(
		hook_override.is_err(),
		"a hook path must start with the hook id"
	);

	assert!(!devtools.status().show_host_components);
	assert!(
		devtools
			.store()
			.walk(None)
			.all(|element| element.kind != ElementKind::Host)
	);
	devtools.set_show_host_components(true);
	wait_for(&devtools, "host components", |devtools| {
		devtools
			.store()
			.walk(None)
			.any(|element| &*element.name == "View")
	})
	.await;
	assert!(devtools.status().show_host_components);

	let rows = FindQuery {
		name: Some(NameMatch::Exact("MessageRow".into())),
		..Default::default()
	};
	let matches = query::find_by_props(&devtools, &rows, r#".props.message.content == "hello 1""#)
		.await
		.expect("predicate runs");
	assert_eq!((matches.candidates, matches.inspected), (3, 3));
	assert_eq!(matches.ids, [find_one(&devtools, "MessageRow", Some("m1"))]);
	assert!(
		query::find_by_props(&devtools, &rows, "select(")
			.await
			.is_err()
	);

	device.kill();
	wait_for(&devtools, "the disconnect", |devtools| {
		matches!(
			devtools.status().connection,
			ConnectionState::Listening { .. }
		) && devtools.store().is_empty()
	})
	.await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_hook_override_rerenders_with_the_new_state() {
	let Some((devtools, _device)) = connected_session().await else {
		return;
	};
	let row = find_one(&devtools, "MessageRow", Some("m2"));
	let hovered =
		|element: &unbound_devtools_core::InspectedElement| element.hooks[0].value.clone();

	let before = devtools.inspect(row).await.expect("inspects");
	assert_eq!(hovered(&before), Value::Bool(false));

	devtools
		.override_value(
			row,
			Section::Hooks,
			vec![PathSegment::Index(0)],
			json!(true),
		)
		.await
		.expect("override sends");

	let deadline = tokio::time::Instant::now() + Duration::from_secs(5);

	loop {
		let after = devtools.inspect(row).await.expect("re-inspects");

		if hovered(&after) == Value::Bool(true) {
			break;
		}

		assert!(
			tokio::time::Instant::now() < deadline,
			"hook state never became true"
		);
		tokio::time::sleep(Duration::from_millis(50)).await;
	}
}
