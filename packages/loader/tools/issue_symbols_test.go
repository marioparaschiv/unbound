package main

import (
	"strings"
	"testing"
)

const iosIssueBody = "- **Unbound:** loader 1.3.0 (`Unbound.dylib`, `ElleKit 1.2`)\n" +
	"- **Device:** iPhone SE (2nd generation) on iOS 26.0.1 (23A355)\n\n" +
	"### What happened\n```\nDiscord crashed.\n```\n\n" +
	"### Native stack\n```\nSignal 11\nAddon Chat Bubbles\n#0 0x100a0 Unbound.dylib + 0x1a2b\n#1 0x18c00 UIKitCore + 0x40\n#2 0x100b0 Unbound.dylib + 0x2000 loader::run\n```\n\n" +
	"### Previous launch log\n```\nline\n```\n"

func TestParsesTheCrashIssue(t *testing.T) {
	crash, ok := parseIssueCrash(iosIssueBody)
	if !ok || crash.platform != "ios" || crash.version != "1.3.0" {
		t.Fatalf("parsed %+v, %v", crash, ok)
	}
	if !strings.HasPrefix(crash.stack, "Signal 11") || strings.Contains(crash.stack, "Previous launch log") {
		t.Fatalf("stack section %q", crash.stack)
	}
	if _, ok := parseIssueCrash(iosIssueBody + "\n" + symbolicatedMarker); ok {
		t.Fatal("a symbolicated issue was parsed again")
	}
	if _, ok := parseIssueCrash("- **Unbound:** loader 1.3.0\nno stack"); ok {
		t.Fatal("an issue without a native stack was parsed")
	}
}

func TestPicksTheReleaseCarryingTheLoaderVersion(t *testing.T) {
	releases := []symbolRelease{
		{TagName: "newest", Assets: []releaseAsset{{Name: "app.unbound.ios_1.4.0_iphoneos-arm64.deb"}, {Name: "unbound-ios-symbols.zip"}}},
		{TagName: "match", Assets: []releaseAsset{{Name: "app.unbound.ios_1.3.0_iphoneos-arm64.deb"}, {Name: "unbound-ios-symbols.zip"}}},
		{TagName: "android", Assets: []releaseAsset{{Name: "unbound-android-symbols.zip"}}},
	}
	if tag, ok := pickSymbolRelease(releases, issueCrash{platform: "ios", version: "1.3.0"}); !ok || tag != "match" {
		t.Fatalf("picked %q", tag)
	}
	if _, ok := pickSymbolRelease(releases, issueCrash{platform: "ios", version: "9.9.9"}); ok {
		t.Fatal("picked a release for an unknown version")
	}
	if tag, _ := pickSymbolRelease(releases, issueCrash{platform: "android", version: "1.3.0"}); tag != "android" {
		t.Fatalf("picked %q for Android", tag)
	}
}

func TestNamesOnlyUnboundFrames(t *testing.T) {
	crash, _ := parseIssueCrash(iosIssueBody)
	var asked []uint64
	symbolize := func(object string, addresses []uint64) ([][]sourceLocation, error) {
		asked = addresses
		return [][]sourceLocation{
			{{function: "loader::hook", file: "/ci/packages/loader/core/src/Hook.cpp", line: 42}},
			{{function: "loader::run"}},
		}, nil
	}
	output, count, err := symbolicateLoaderStack(crash.stack, "Unbound.dylib", symbolize)
	if err != nil || count != 2 {
		t.Fatalf("count %d, err %v", count, err)
	}
	if asked[0] != 0x1a2b || asked[1] != 0x2000 {
		t.Fatalf("asked for %x", asked)
	}
	if !strings.Contains(output, "#0 0x100a0 Unbound.dylib + 0x1a2b\n    loader::hook at packages/loader/core/src/Hook.cpp:42\n") {
		t.Fatalf("output %q", output)
	}
	if strings.Contains(output, "UIKitCore + 0x40\n    ") {
		t.Fatal("a system frame was annotated")
	}
	comment := issueSymbolsComment("discord-355.0-ios", "1.3.0", output)
	if !strings.HasPrefix(comment, symbolicatedMarker) || !strings.Contains(comment, "`discord-355.0-ios`") {
		t.Fatalf("comment %q", comment)
	}
}
