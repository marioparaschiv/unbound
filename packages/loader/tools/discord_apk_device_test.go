package main

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

type fakeADB struct {
	responses map[string]string
	failures  map[string]bool
	calls     [][]string
}

func (fake *fakeADB) run(_ context.Context, timeout time.Duration, args ...string) (string, error) {
	fake.calls = append(fake.calls, args)
	if timeout <= 0 {
		return "", errors.New("adb was called without a timeout")
	}
	key := strings.Join(args, " ")
	if fake.failures[key] {
		return "", errors.New("adb " + key + " failed")
	}
	return fake.responses[key], nil
}

func TestParseInstalledSplitsNamesEverySplitOfTheInstall(t *testing.T) {
	output := strings.Join([]string{
		"package:/data/app/~~abc==/com.discord-def==/base.apk",
		"package:/data/app/~~abc==/com.discord-def==/split_config.xxhdpi.apk",
		"package:/data/app/~~abc==/com.discord-def==/split_config.arm64_v8a.apk",
		"package:/data/app/~~abc==/com.discord-def==/split_config.en.apk",
		"",
	}, "\r\n")
	want := []string{"base", "config.arm64_v8a", "config.en", "config.xxhdpi"}
	if got := parseInstalledSplits(output); !reflect.DeepEqual(got, want) {
		t.Fatalf("parsed %v, want %v", got, want)
	}
	if got := parseInstalledSplits(""); len(got) != 0 {
		t.Fatalf("an empty pm path listed %v", got)
	}
}

func TestParseWMDensityPrefersTheOverride(t *testing.T) {
	for output, want := range map[string]int{
		"Physical density: 280\n":                            280,
		"Physical density: 420\r\nOverride density: 480\r\n": 480,
	} {
		got, err := parseWMDensity(output)
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("%q parsed to %d, want %d", output, got, want)
		}
	}
	if _, err := parseWMDensity("cmd: Can't find service: window"); err == nil {
		t.Fatal("output without a density was accepted")
	}
}

func TestDeviceConfigSplitNames(t *testing.T) {
	for abi, want := range map[string]string{"arm64-v8a": "config.arm64_v8a", "armeabi-v7a": "config.armeabi_v7a", "x86_64": "config.x86_64"} {
		if got := abiSplit(abi); got != want {
			t.Fatalf("abi %s mapped to %s, want %s", abi, got, want)
		}
	}
	for locale, want := range map[string]string{"en-US": "config.en", "de_DE": "config.de", "pt-BR": "config.pt", "": "config.en"} {
		if got := languageSplit(locale); got != want {
			t.Fatalf("locale %q mapped to %s, want %s", locale, got, want)
		}
	}
	for dpi, want := range map[int]string{120: "config.ldpi", 160: "config.mdpi", 280: "config.xhdpi", 420: "config.xxhdpi", 480: "config.xxhdpi", 560: "config.xxxhdpi", 900: "config.xxxhdpi"} {
		if got := densitySplit(dpi); got != want {
			t.Fatalf("%d dpi mapped to %s, want %s", dpi, got, want)
		}
	}
}

func TestDiscordDeviceSplitsComeFromTheInstalledPackage(t *testing.T) {
	adb := &fakeADB{responses: map[string]string{
		"shell pm path com.discord": "package:/data/app/x/base.apk\npackage:/data/app/x/split_config.en.apk\npackage:/data/app/x/split_config.arm64_v8a.apk\npackage:/data/app/x/split_config.xxhdpi.apk\n",
	}}
	splits, err := discordDeviceSplits(context.Background(), adb.run)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"base", "config.arm64_v8a", "config.en", "config.xxhdpi"}; !reflect.DeepEqual(splits, want) {
		t.Fatalf("splits %v, want %v", splits, want)
	}
	if len(adb.calls) != 1 {
		t.Fatalf("queried the device %d times, want only pm path", len(adb.calls))
	}
}

func TestDiscordDeviceSplitsFallBackToTheDeviceConfiguration(t *testing.T) {
	adb := &fakeADB{
		failures: map[string]bool{"shell pm path com.discord": true},
		responses: map[string]string{
			"shell getprop ro.product.cpu.abi": "arm64-v8a\n",
			"shell wm density":                 "Physical density: 280\n",
			"shell getprop persist.sys.locale": "\n",
			"shell getprop ro.product.locale":  "de-DE\n",
		},
	}
	splits, err := discordDeviceSplits(context.Background(), adb.run)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"base", "config.arm64_v8a", "config.de", "config.xhdpi"}; !reflect.DeepEqual(splits, want) {
		t.Fatalf("splits %v, want %v", splits, want)
	}
	offline := &fakeADB{failures: map[string]bool{"shell pm path com.discord": true, "shell getprop ro.product.cpu.abi": true}}
	if _, err := discordDeviceSplits(context.Background(), offline.run); err == nil {
		t.Fatal("an unreachable device produced splits")
	}
}

func TestOrderSplitsPutsBaseFirstAndDropsDuplicates(t *testing.T) {
	got := orderSplits([]string{"config.en", "base", "config.arm64_v8a", "config.en", "", "base"})
	if want := []string{"base", "config.arm64_v8a", "config.en"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("ordered %v, want %v", got, want)
	}
}

func TestInstallDiscordSplitsKeepsAppDataAndAllowsDowngrades(t *testing.T) {
	files := map[string]string{"config.xxhdpi": "/d/config.xxhdpi.apk", "base": "/d/base.apk", "config.en": "/d/config.en.apk"}
	adb := &fakeADB{responses: map[string]string{
		"install-multiple -r -d /d/base.apk /d/config.en.apk /d/config.xxhdpi.apk": "Performing Streamed Install\nSuccess\n",
	}}
	if err := installDiscordSplits(context.Background(), adb.run, files); err != nil {
		t.Fatal(err)
	}
	failing := &fakeADB{responses: map[string]string{}}
	if err := installDiscordSplits(context.Background(), failing.run, files); err == nil || !strings.Contains(err.Error(), "did not report success") {
		t.Fatalf("an install without Success was accepted: %v", err)
	}
	if err := installDiscordSplits(context.Background(), adb.run, map[string]string{"config.en": "/d/config.en.apk"}); err == nil {
		t.Fatal("an install without the base split was attempted")
	}
}

func TestADBForSerialTimesOut(t *testing.T) {
	if _, err := adbForSerial("missing-device")(context.Background(), time.Nanosecond, "shell", "true"); err == nil {
		t.Fatal("an adb call that cannot finish in time succeeded")
	}
}
