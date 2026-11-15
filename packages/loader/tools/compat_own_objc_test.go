package main

import "testing"

func TestSwiftOwnObjCClasses(t *testing.T) {
	classes := parseSwiftObjCClasses(`import Foundation

@objc(UnboundLiveActivities)
final class UnboundLiveActivities: NSObject {
    @objc static func isAvailable() -> Bool { true }
    @objc static func start(_ json: String) -> String? { nil }
    @objc static func update(_ id: String, json: String) -> Bool { true }
    @objc static func load(from path: String) {}
    @objc(endAll) static func stopEverything() {}
    private static func decode(_ json: String) -> Int? { nil }
}
`)

	if len(classes) != 1 || classes[0].Name != "UnboundLiveActivities" || classes[0].Super != "NSObject" {
		t.Fatalf("class was not read: %+v", classes)
	}

	for _, selector := range []string{"isAvailable", "start:", "update:json:", "loadFrom:", "endAll"} {
		if !classes[0].Methods[selector] {
			t.Fatalf("missing selector %s in %v", selector, classes[0].Methods)
		}
	}

	if classes[0].Methods["decode:"] {
		t.Fatalf("a private Swift method was read as an Objective-C selector")
	}

	index := newObjCIndex()
	mergeOwnObjCClasses(index, classes)

	if index.Classes["UnboundLiveActivities"] == nil || !index.Selectors["update:json:"] {
		t.Fatalf("own classes were not merged: %+v", index)
	}
}
