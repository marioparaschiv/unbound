package main

import (
	"os"
	"regexp"
	"testing"
)

func TestUnboundURLSchemeMatchesTheRelayAppAndTheClient(t *testing.T) {
	data, err := os.ReadFile("../ios/link-helper/Resources/Info.plist")
	if err != nil {
		t.Fatal(err)
	}
	info, err := readPlist(data)
	if err != nil {
		t.Fatal(err)
	}
	urlTypes := info.get("CFBundleURLTypes")
	if urlTypes == nil || len(urlTypes.values) != 1 {
		t.Fatal("the relay app must declare exactly one URL type")
	}
	schemes := urlTypes.values[0].get("CFBundleURLSchemes")
	if schemes == nil || len(schemes.values) != 1 || schemes.values[0].text != unboundURLScheme {
		t.Fatalf("the relay app must claim only %q", unboundURLScheme)
	}

	source, err := os.ReadFile("../../contracts/src/links.ts")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`export const UNBOUND_SCHEME = '([^']*)';`).FindSubmatch(source)
	if match == nil {
		t.Fatal("contracts/src/links.ts no longer declares UNBOUND_SCHEME")
	}
	if string(match[1]) != unboundURLScheme {
		t.Fatalf("UNBOUND_SCHEME is %q, the IPA patch registers %q", match[1], unboundURLScheme)
	}
}
