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
		Width:                720,
		Height:               1600,
		DensityDPI:           280,
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
