use super::*;
use serde_json::Value;

fn fixture() -> Value {
	let path = concat!(
		env!("CARGO_MANIFEST_DIR"),
		"/../../../../packages/debugger-protocol/tests/fixtures/devtools-contract.json"
	);
	let text =
		std::fs::read_to_string(path).expect("the DevTools contract fixture is readable");

	serde_json::from_str(&text).expect("the DevTools contract fixture is JSON")
}

fn frame(contract: &Value, name: &str) -> BridgeFrame {
	serde_json::from_value(contract["frames"][name].clone()).expect("the frame deserializes")
}

#[test]
fn names_the_protocol_constants() {
	let contract = fixture();

	assert_eq!(
		contract["defaultBridgePort"],
		u64::from(crate::DEFAULT_BRIDGE_PORT)
	);
	assert_eq!(
		contract["controllerEndpointMarker"],
		CONTROLLER_ENDPOINT_MARKER
	);
}

#[test]
fn sends_the_protocols_eval_request() {
	let contract = fixture();
	let expected = &contract["frames"]["evalRequest"];
	let request = eval_request(
		expected["id"].as_str().unwrap(),
		expected["code"].as_str().unwrap(),
		expected["timeout"].as_u64().unwrap(),
	);
	let sent: Value = serde_json::from_str(request.to_text().expect("the request is text"))
		.expect("the request is JSON");

	assert_eq!(&sent, expected);
}

#[test]
fn reads_the_protocols_reply_frames() {
	let contract = fixture();

	assert!(matches!(
		frame(&contract, "evalOk"),
		BridgeFrame::EvalResult {
			ok: true,
			value: Some(_),
			..
		}
	));
	assert!(matches!(
		frame(&contract, "evalError"),
		BridgeFrame::EvalResult {
			ok: false,
			error: Some(_),
			code: Some(code),
			..
		} if code == "timeout"
	));
	assert!(matches!(
		frame(&contract, "deviceConnected"),
		BridgeFrame::DeviceStatus {
			connected: true,
			..
		}
	));
	assert!(matches!(
		frame(&contract, "deviceDisconnected"),
		BridgeFrame::DeviceStatus {
			connected: false,
			..
		}
	));
}

#[test]
fn sends_the_protocols_view_requests() {
	let contract = fixture();
	let with_id = |mut request: Value, expected: &Value| {
		request["id"] = expected["id"].clone();
		request
	};
	let page = &contract["frames"]["viewsRequest"];
	let details = &contract["frames"]["viewDetailsRequest"];
	let offset = u32::try_from(page["offset"].as_u64().unwrap()).unwrap();

	assert_eq!(
		&with_id(
			crate::views::views_request(page["parent"].as_str().map(str::to_owned), offset),
			page
		),
		page
	);
	assert_eq!(
		&with_id(
			crate::views::view_details_request(details["node"].as_str().unwrap()),
			details
		),
		details
	);
}

#[test]
fn reads_the_protocols_view_replies() {
	let contract = fixture();

	let BridgeFrame::ViewsResult {
		ok: true,
		nodes,
		total: Some(240),
		..
	} = frame(&contract, "viewsPage")
	else {
		panic!("a page of views with its total");
	};
	assert_eq!(nodes.len(), 1);

	let BridgeFrame::ViewDetailsResult {
		ok: true,
		details: Some(details),
		..
	} = frame(&contract, "viewDetailsOk")
	else {
		panic!("a view's details");
	};
	let properties = &details.sections[0].properties;
	assert_eq!(details.class_chain[0], "UILabel");
	assert_eq!(
		properties[0].value,
		crate::views::PropertyValue::Number(16.0)
	);
	assert_eq!(properties[0].unit.as_deref(), Some("pt"));
	assert_eq!(properties[1].kind, Some(crate::views::PropertyKind::Color));
	assert_eq!(
		properties[2].value,
		crate::views::PropertyValue::Bool(false)
	);
	assert_eq!(properties[3].value, crate::views::PropertyValue::Null);

	assert!(matches!(
		frame(&contract, "viewDetailsError"),
		BridgeFrame::ViewDetailsResult {
			ok: false,
			error: Some(_),
			..
		}
	));
}

/// The fixture's frames of one `type`, whatever their keys are named.
fn frames_of(contract: &Value, kind: &str) -> Vec<Value> {
	let frames = contract["frames"]
		.as_object()
		.expect("the fixture has frames");
	let found: Vec<Value> = frames
		.values()
		.filter(|frame| frame["type"] == kind)
		.cloned()
		.collect();
	assert!(!found.is_empty(), "the fixture has a {kind} frame");
	found
}

#[test]
fn sends_the_protocols_explorer_requests() {
	use crate::explorer::{
		ExplorerMemberKind, classes_request, members_request, object_request, values_request,
	};
	let contract = fixture();
	let text = |frame: &Value, key: &str| frame[key].as_str().unwrap_or_default().to_owned();
	let offset = |frame: &Value| u32::try_from(frame["offset"].as_u64().unwrap_or(0)).unwrap();
	let kind = |frame: &Value| -> ExplorerMemberKind {
		serde_json::from_value(frame["kind"].clone()).expect("a member kind")
	};
	let check = |mut sent: Value, expected: &Value| {
		sent["id"] = expected["id"].clone();
		assert_eq!(&sent, expected);
	};

	for expected in frames_of(&contract, "explorer-object-request") {
		let target = serde_json::from_value(expected["target"].clone()).expect("a target");
		check(object_request(&target), &expected);
	}
	for expected in frames_of(&contract, "explorer-members-request") {
		let request = members_request(
			&text(&expected, "className"),
			kind(&expected),
			offset(&expected),
			&text(&expected, "filter"),
		);
		check(request, &expected);
	}
	for expected in frames_of(&contract, "explorer-values-request") {
		let names: Vec<String> =
			serde_json::from_value(expected["names"].clone()).expect("names");
		let request = values_request(
			&text(&expected, "object"),
			&text(&expected, "className"),
			kind(&expected),
			&names,
			expected["invokeGetters"] == true,
		);
		check(request, &expected);
	}
	for expected in frames_of(&contract, "explorer-classes-request") {
		let request = classes_request(
			expected["image"].as_str(),
			&text(&expected, "filter"),
			offset(&expected),
		);
		check(request, &expected);
	}
}

#[test]
fn reads_the_protocols_explorer_replies() {
	let contract = fixture();
	let parse = |frame: Value| -> BridgeFrame {
		serde_json::from_value(frame).expect("the explorer frame deserializes")
	};

	for frame in frames_of(&contract, "explorer-object-result") {
		let ok = frame["ok"] == true;
		let BridgeFrame::ExplorerObjectResult {
			object,
			error,
			code,
			..
		} = parse(frame)
		else {
			panic!("an explorer object result");
		};
		if ok {
			assert!(!object.expect("an object").chain.is_empty());
		} else {
			assert!(error.is_some() && code.is_some());
		}
	}
	for frame in frames_of(&contract, "explorer-members-result") {
		let ok = frame["ok"] == true;
		let BridgeFrame::ExplorerMembersResult {
			members,
			total,
			error,
			..
		} = parse(frame)
		else {
			panic!("an explorer members result");
		};
		assert!(!ok || (!members.is_empty() && total.is_some()));
		assert!(ok || error.is_some());
	}
	for frame in frames_of(&contract, "explorer-values-result") {
		let ok = frame["ok"] == true;
		let BridgeFrame::ExplorerValuesResult { values, error, .. } = parse(frame) else {
			panic!("an explorer values result");
		};
		assert!(!ok || !values.is_empty());
		assert!(ok || error.is_some());
	}
	for frame in frames_of(&contract, "explorer-classes-result") {
		let ok = frame["ok"] == true;
		let BridgeFrame::ExplorerClassesResult {
			images,
			classes,
			error,
			..
		} = parse(frame)
		else {
			panic!("an explorer classes result");
		};
		assert!(!ok || images.is_some() || classes.is_some());
		assert!(ok || error.is_some());
	}
}

#[test]
fn sends_the_protocols_metro_requests() {
	use crate::metro::{
		MetroModuleStatus, MetroTarget, children_request, files_request, load_all_request,
		load_request, modules_request, read_request, search_request,
	};
	let contract = fixture();
	let offset = |frame: &Value| u32::try_from(frame["offset"].as_u64().unwrap_or(0)).unwrap();
	let check = |mut sent: Value, expected: &Value| {
		sent["id"] = expected["id"].clone();
		assert_eq!(&sent, expected);
	};

	for expected in frames_of(&contract, "metro-modules-request") {
		let status: Option<MetroModuleStatus> =
			serde_json::from_value(expected["status"].clone()).expect("a status");
		let filter = expected["filter"].as_str().unwrap_or_default();
		check(
			modules_request(filter, status, offset(&expected)),
			&expected,
		);
	}
	for expected in frames_of(&contract, "metro-load-request") {
		let module = u32::try_from(expected["module"].as_u64().unwrap()).unwrap();
		check(load_request(module), &expected);
	}
	for expected in frames_of(&contract, "metro-children-request") {
		let target: MetroTarget =
			serde_json::from_value(expected["target"].clone()).expect("a target");
		check(children_request(&target, offset(&expected)), &expected);
	}
	for expected in frames_of(&contract, "metro-read-request") {
		check(read_request(expected["ref"].as_str().unwrap()), &expected);
	}
	for expected in frames_of(&contract, "metro-files-request") {
		check(files_request(), &expected);
	}
	for expected in frames_of(&contract, "metro-load-all-request") {
		check(load_all_request(), &expected);
	}
	for expected in frames_of(&contract, "metro-search-request") {
		let cursor = u32::try_from(expected["cursor"].as_u64().unwrap_or(0)).unwrap();
		check(
			search_request(expected["query"].as_str().unwrap(), cursor),
			&expected,
		);
	}
}

#[test]
fn reads_the_protocols_metro_replies() {
	let contract = fixture();

	let BridgeFrame::MetroModulesResult {
		ok: true,
		modules,
		count: Some(21034),
		..
	} = frame(&contract, "metroModulesOk")
	else {
		panic!("a page of modules with the registry's count");
	};
	assert_eq!(modules[1].label, None);

	assert!(matches!(
		frame(&contract, "metroLoadOk"),
		BridgeFrame::MetroLoadResult {
			ok: true,
			module: Some(MetroModule {
				status: crate::metro::MetroModuleStatus::Failed,
				..
			}),
			..
		}
	));

	let BridgeFrame::MetroChildrenResult {
		ok: true,
		children,
		internal,
		..
	} = frame(&contract, "metroChildrenOk")
	else {
		panic!("a value's children");
	};
	assert_eq!(children[2].kind, crate::metro::MetroValueKind::Getter);
	assert!(internal[0].internal);

	assert!(matches!(
		frame(&contract, "metroChildrenStale"),
		BridgeFrame::MetroChildrenResult {
			ok: false,
			code: Some(MetroErrorCode::Stale),
			..
		}
	));
	assert!(matches!(
		frame(&contract, "metroReadOk"),
		BridgeFrame::MetroReadResult {
			ok: true,
			value: Some(_),
			..
		}
	));
	assert!(matches!(
		frame(&contract, "metroLoadAllOk"),
		BridgeFrame::MetroLoadAllResult {
			ok: true,
			remaining: Some(15904),
			..
		}
	));

	let BridgeFrame::MetroSearchResult {
		ok: true,
		matches,
		cursor: Some(1302),
		..
	} = frame(&contract, "metroSearchOk")
	else {
		panic!("a page of search matches with a cursor");
	};
	assert_eq!(
		matches[0].path,
		["default", "[[Prototype]]", "getUserProfile"]
	);
	assert_eq!(matches[0].module.id, 1544);

	let BridgeFrame::MetroFilesResult {
		ok: true,
		files,
		unloaded: Some(15904),
		..
	} = frame(&contract, "metroFilesOk")
	else {
		panic!("the loaded modules' file paths");
	};
	assert_eq!(files[1].path, "modules/user_profile/native/UserProfile.tsx");
}
