package main

import (
	"strings"
	"testing"
)

func TestUpdateAVDConfigAppliesProfileAndPreservesOtherValues(t *testing.T) {
	profile := avdProfile{
		Name:                 "unbound_root",
		Device:               "pixel_7",
		SystemImage:          "system-images;android-35;google_apis;arm64-v8a",
		SystemImageDirectory: "system-images/android-35/google_apis/arm64-v8a/",
		ABI:                  "arm64-v8a",
		RAMMiB:               4096,
		CPUCores:             4,
		GPU:                  "host",
		Width:                1080,
		Height:               2400,
		DensityDPI:           420,
		DataPartition:        "6G",
		HeapMiB:              512,
	}
	initial := "AvdId=unbound_root\nhw.gpu.mode=auto\nhw.ramSize=2048\ncustom.setting=keep\n"
	updated := updateAVDConfig(initial, avdConfigValues(profile))
	values := parseAVDConfig(updated)
	if values["hw.gpu.mode"] != "host" || values["hw.ramSize"] != "4096" || values["hw.cpu.ncore"] != "4" {
		t.Fatalf("performance settings were not applied: %#v", values)
	}
	if values["custom.setting"] != "keep" {
		t.Fatalf("unrelated AVD setting was lost: %#v", values)
	}
	if updateAVDConfig(updated, avdConfigValues(profile)) != updated {
		t.Fatal("applying the profile twice should be idempotent")
	}
}

func TestConfigStatusReportsMismatch(t *testing.T) {
	profile := avdProfile{Name: "unbound_root", CPUCores: 4, RAMMiB: 4096, GPU: "host"}
	if got := configStatus(map[string]string{"hw.cpu.ncore": "2"}, profile); !strings.Contains(got, "differs") {
		t.Fatalf("expected mismatched AVD configuration to be reported, got %q", got)
	}
}

func TestParseAVDConfigIgnoresNonEntries(t *testing.T) {
	values := parseAVDConfig("\nAvdId=unbound_root\nnot-an-entry\nhw.gpu.mode=host\n")
	if len(values) != 2 || values["AvdId"] != "unbound_root" || values["hw.gpu.mode"] != "host" {
		t.Fatalf("unexpected parsed config: %#v", values)
	}
}

func TestEnabledEmulationOverlaysListsOnlyEnabledDeviceOverlays(t *testing.T) {
	list := "android\n[x] com.google.android.overlay.googleconfig\n[ ] com.android.internal.emulation.pixel_7_pro\n[x] com.android.internal.emulation.pixel_7\n[ ] com.android.internal.display.cutout.emulation.corner\n"
	got := enabledEmulationOverlays(list)
	if len(got) != 1 || got[0] != "com.android.internal.emulation.pixel_7" {
		t.Fatalf("expected only the enabled device overlay, got %#v", got)
	}
}

func TestAndroidSetupParsers(t *testing.T) {
	if got := xposedFramework("zygisk_vector\nsome_other_module\n"); got != "zygisk_vector" {
		t.Fatalf("expected the Vector module, got %q", got)
	}
	if got := xposedFramework("busybox\n"); got != "" {
		t.Fatalf("expected no framework, got %q", got)
	}
	dumpsys := "Packages:\n  Package [com.discord]\n    versionCode=352110 minSdk=24\n    versionName=352.10 - Beta\n"
	if got := packageVersionName(dumpsys); got != "352.10 - Beta" {
		t.Fatalf("unexpected version name %q", got)
	}
}

func TestDisabledOverlayFindsOnlyTheNamedDisabledOverlay(t *testing.T) {
	list := "android\n[ ] com.android.internal.emulation.pixel_7\n[x] com.android.internal.emulation.pixel_7_pro\n"
	if !disabledOverlay(list, "com.android.internal.emulation.pixel_7") {
		t.Fatal("expected the disabled Pixel 7 overlay to be found")
	}
	if disabledOverlay(list, "com.android.internal.emulation.pixel_7_pro") {
		t.Fatal("an enabled overlay must not be reported as disabled")
	}
	if disabledOverlay(list, "com.android.internal.emulation.pixel_8") {
		t.Fatal("a missing overlay must not be reported as disabled")
	}
}
