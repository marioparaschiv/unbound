package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"syscall"
	"time"
)

const (
	smokeAndroidPackage = "com.discord"
	smokeAndroidData    = "/data/data/" + smokeAndroidPackage
	smokeAndroidStaging = "/data/local/tmp/unbound-smoke"
)

var androidSplitABIs = map[string]string{
	"config.arm64_v8a":   "arm64-v8a",
	"config.armeabi_v7a": "armeabi-v7a",
	"config.x86_64":      "x86_64",
	"config.x86":         "x86",
}

type androidSmokeTarget struct {
	serial string
	apks   string
	pid    string
}

func runAndroidSmoke(args []string) error {
	set := flag.NewFlagSet("smoke android", flag.ContinueOnError)
	options := registerSmokeFlags(set)
	serial := set.String("serial", firstNonEmpty(os.Getenv("ANDROID_SERIAL"), "emulator-5554"), "adb serial of the emulator")
	apks := set.String("apks", "", "directory of the patched Discord split APKs")
	installed := set.Bool("installed", false, "test the Discord already installed on the device instead of installing one")
	if err := set.Parse(args); err != nil {
		return err
	}
	if err := validateAndroidSmokeSource(*apks, *installed); err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return runSmokeTest(ctx, "android", options, &androidSmokeTarget{serial: *serial, apks: *apks})
}

func validateAndroidSmokeSource(apks string, installed bool) error {
	if (apks == "") == installed {
		return nil
	}
	return errors.New("usage: smoke android (--apks <dir> | --installed) [--serial <serial>] [--plugins <dir>] [--client <dir>] [--artifacts <dir>]")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func (target *androidSmokeTarget) name() string {
	return "the Android emulator " + target.serial
}

func (target *androidSmokeTarget) hostAddress() string {
	return "10.0.2.2"
}

func (target *androidSmokeTarget) adb(ctx context.Context, timeout time.Duration, args ...string) (string, error) {
	return runSmokeCommand(ctx, timeout, "adb", append([]string{"-s", target.serial}, args...)...)
}

func (target *androidSmokeTarget) shell(ctx context.Context, timeout time.Duration, script string) (string, error) {
	return target.adb(ctx, timeout, "shell", script)
}

func (target *androidSmokeTarget) prepare(ctx context.Context, plugins []smokePlugin, settings []byte) error {
	if err := target.waitForBoot(ctx); err != nil {
		return err
	}
	if _, err := target.adb(ctx, time.Minute, "root"); err != nil {
		return err
	}
	if err := target.waitForBoot(ctx); err != nil {
		return err
	}
	identity, err := target.shell(ctx, time.Minute, "id -u")
	if err != nil {
		return err
	}
	if strings.TrimSpace(identity) != "0" {
		return errors.New("adb has no root on this emulator; use a google_apis system image")
	}
	if err := target.install(ctx); err != nil {
		return err
	}
	if _, err := target.shell(ctx, time.Minute, "rm -rf "+smokeAndroidStaging+" && mkdir -p "+smokeAndroidStaging+"/Plugins"); err != nil {
		return err
	}
	staging, err := os.MkdirTemp("", "unbound-smoke-settings-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	settingsPath := filepath.Join(staging, "settings.json")
	if err := os.WriteFile(settingsPath, settings, 0o644); err != nil {
		return err
	}
	if _, err := target.adb(ctx, time.Minute, "push", settingsPath, smokeAndroidStaging+"/settings.json"); err != nil {
		return err
	}
	for _, plugin := range plugins {
		destination := smokeAndroidStaging + "/Plugins/" + plugin.id
		if _, err := target.shell(ctx, time.Minute, "mkdir -p "+destination); err != nil {
			return err
		}
		for _, file := range plugin.files {
			if _, err := target.adb(ctx, 2*time.Minute, "push", filepath.Join(plugin.directory, file), path.Join(destination, file)); err != nil {
				return err
			}
		}
	}
	documents := smokeAndroidData + "/files/Unbound"
	// --installed keeps a running Discord alive, and launch would only bring it to the front.
	install := strings.Join([]string{
		"am force-stop " + smokeAndroidPackage,
		"mkdir -p " + documents,
		"cp -R " + smokeAndroidStaging + "/. " + documents + "/",
		"chown -R $(stat -c %u:%g " + smokeAndroidData + ") " + smokeAndroidData + "/files",
		"restorecon -RF " + smokeAndroidData + "/files",
		"rm -rf " + smokeAndroidStaging,
	}, " && ")
	_, err = target.shell(ctx, time.Minute, install)
	return err
}

func (target *androidSmokeTarget) waitForBoot(ctx context.Context) error {
	if _, err := target.adb(ctx, 5*time.Minute, "wait-for-device"); err != nil {
		return err
	}
	deadline := time.Now().Add(5 * time.Minute)
	for time.Now().Before(deadline) && ctx.Err() == nil {
		booted, err := target.shell(ctx, 30*time.Second, "getprop sys.boot_completed")
		if err == nil && strings.TrimSpace(booted) == "1" {
			return nil
		}
		time.Sleep(smokePollInterval)
	}
	return errors.New("the emulator did not finish booting")
}

func (target *androidSmokeTarget) install(ctx context.Context) error {
	if target.apks == "" {
		if _, err := target.shell(ctx, time.Minute, "pm path "+smokeAndroidPackage); err != nil {
			return fmt.Errorf("%s is not installed on %s: %w", smokeAndroidPackage, target.serial, err)
		}
		return nil
	}
	abi, err := target.shell(ctx, time.Minute, "getprop ro.product.cpu.abi")
	if err != nil {
		return err
	}
	splits, err := selectAndroidSplits(target.apks, strings.TrimSpace(abi))
	if err != nil {
		return err
	}
	_, err = target.adb(ctx, 10*time.Minute, append([]string{"install-multiple", "-r", "-d"}, splits...)...)
	return err
}

func selectAndroidSplits(directory, abi string) ([]string, error) {
	apks, err := filepath.Glob(filepath.Join(directory, "*.apk"))
	if err != nil {
		return nil, err
	}
	var base string
	var abiSplit string
	var others []string
	for _, apk := range apks {
		name := filepath.Base(apk)
		switch {
		case strings.HasPrefix(name, "base"):
			base = apk
		case androidSplitABI(name) != "":
			if androidSplitABI(name) == abi {
				abiSplit = apk
			}
		case strings.HasPrefix(name, "config."):
			others = append(others, apk)
		}
	}
	if base == "" {
		return nil, fmt.Errorf("%s has no base APK", directory)
	}
	if abiSplit == "" {
		return nil, fmt.Errorf("%s has no split for the emulator's %s ABI", directory, abi)
	}
	sort.Strings(others)
	return append([]string{base, abiSplit}, others...), nil
}

func androidSplitABI(name string) string {
	for prefix, abi := range androidSplitABIs {
		if name == prefix+".apk" || strings.HasPrefix(name, prefix+"-") {
			return abi
		}
	}
	return ""
}

func (target *androidSmokeTarget) streamLogs(ctx context.Context) (io.ReadCloser, func() error, error) {
	if _, err := target.adb(ctx, time.Minute, "logcat", "-c"); err != nil {
		return nil, nil, err
	}
	command := exec.CommandContext(ctx, "adb", "-s", target.serial, "logcat", "-v", "threadtime")
	output, err := command.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	command.Stderr = command.Stdout
	if err := command.Start(); err != nil {
		return nil, nil, err
	}
	stop := func() error {
		stopSmokeProcess(command)
		return nil
	}
	return output, stop, nil
}

func (target *androidSmokeTarget) launch(ctx context.Context) error {
	if _, err := target.shell(ctx, time.Minute, "monkey -p "+smokeAndroidPackage+" -c android.intent.category.LAUNCHER 1"); err != nil {
		return err
	}
	deadline := time.Now().Add(time.Minute)
	for time.Now().Before(deadline) && ctx.Err() == nil {
		if pids, err := target.discordPIDs(ctx); err == nil && len(pids) > 0 {
			target.pid = pids[0]
			return nil
		}
		time.Sleep(smokePollInterval)
	}
	return errors.New("Discord did not start")
}

func (target *androidSmokeTarget) discordPIDs(ctx context.Context) ([]string, error) {
	output, err := target.shell(ctx, 30*time.Second, "pidof "+smokeAndroidPackage+" || true")
	if err != nil {
		return nil, err
	}
	return strings.Fields(output), nil
}

func (target *androidSmokeTarget) running(ctx context.Context) bool {
	if target.pid == "" {
		return true
	}
	pids, err := target.discordPIDs(ctx)
	return err != nil || slices.Contains(pids, target.pid)
}

func (target *androidSmokeTarget) isLoaderLine(line string) bool {
	return strings.Contains(line, " Unbound ") || strings.Contains(line, " Unbound:")
}

func (target *androidSmokeTarget) isCrashLine(line string) bool {
	switch {
	case strings.Contains(line, "AndroidRuntime") && strings.Contains(line, "Process: "+smokeAndroidPackage+","):
		return true
	case strings.Contains(line, "Fatal signal") && strings.Contains(line, "("+smokeAndroidPackage+")"):
		return true
	default:
		return strings.Contains(line, "Process "+smokeAndroidPackage+" ") && strings.Contains(line, "has died")
	}
}

func (target *androidSmokeTarget) collect(ctx context.Context, artifacts string) {
	saveSmokeOutput(ctx, filepath.Join(artifacts, "screenshot.png"), time.Minute, "adb", "-s", target.serial, "exec-out", "screencap", "-p")
	saveSmokeOutput(ctx, filepath.Join(artifacts, "unbound-files.txt"), time.Minute, "adb", "-s", target.serial, "shell", "ls -laRZ "+smokeAndroidData+"/files/Unbound")
	saveSmokeOutput(ctx, filepath.Join(artifacts, "settings-after.json"), time.Minute, "adb", "-s", target.serial, "shell", "cat "+smokeAndroidData+"/files/Unbound/settings.json")
	saveSmokeOutput(ctx, filepath.Join(artifacts, "crash-buffer.txt"), time.Minute, "adb", "-s", target.serial, "logcat", "-d", "-b", "crash")
	saveSmokeOutput(ctx, filepath.Join(artifacts, "activity.txt"), time.Minute, "adb", "-s", target.serial, "shell", "dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity|mFocusedApp'")
}
