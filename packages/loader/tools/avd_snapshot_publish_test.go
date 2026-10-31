package main

import (
	"strings"
	"testing"
)

func TestRestoredAVDProgressNeedsPluginsAndBundle(t *testing.T) {
	if count, executed := restoredAVDProgress("I Unbound : [plugins] Loaded 32 plugins.\n"); count != 32 || executed {
		t.Fatalf("plugins without the bundle: %d %t", count, executed)
	}
	if count, executed := restoredAVDProgress("I Unbound : [plugins] Loaded 1 plugin.\nI Unbound : [default] Unbound's bundle was successfully executed.\n"); count != 1 || !executed {
		t.Fatalf("both milestones: %d %t", count, executed)
	}
}

func TestModulePropValue(t *testing.T) {
	prop := "id=zygisk_vector\nname=Vector\nversion=v2.2 (3080)\n"
	if got := modulePropValue(prop, "version"); got != "v2.2 (3080)" {
		t.Fatalf("unexpected version %q", got)
	}
	if modulePropValue(prop, "author") != "" {
		t.Fatal("a missing key is empty")
	}
}

func TestSnapshotReleaseNotesCarryTheRestoreCommand(t *testing.T) {
	profile := avdProfile{Name: "unbound_root", SystemImage: "system-images;android-35;google_apis;arm64-v8a", Device: "pixel_7"}
	notes := snapshotReleaseNotes(profile, "marioparaschiv/unbound", "avd-snapshot-20261101", "abc123", avdSnapshotComponents{magisk: "30.7", vector: "v2.2"})
	for _, expected := range []string{
		"--from https://github.com/marioparaschiv/unbound/releases/download/avd-snapshot-20261101/unbound-avd.tar --sha256 abc123",
		"Magisk](https://github.com/topjohnwu/Magisk) 30.7",
		"tree/v30.7",
		"Vector](https://github.com/JingMatrix/Vector) v2.2",
		"no Discord account data",
	} {
		if !strings.Contains(notes, expected) {
			t.Fatalf("notes are missing %q:\n%s", expected, notes)
		}
	}
}
