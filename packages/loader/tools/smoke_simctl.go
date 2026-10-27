package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	smokeIOSBundleID     = "com.hammerandchisel.discord"
	smokeIOSLogPredicate = `subsystem == "app.unbound" OR subsystem == "com.facebook.react.log"`
)

type iosSmokeTarget struct {
	app     string
	device  string
	created bool
	pid     int
}

type simctlRuntime struct {
	Identifier           string `json:"identifier"`
	Platform             string `json:"platform"`
	Version              string `json:"version"`
	IsAvailable          bool   `json:"isAvailable"`
	SupportedDeviceTypes []struct {
		Identifier    string `json:"identifier"`
		Name          string `json:"name"`
		ProductFamily string `json:"productFamily"`
	} `json:"supportedDeviceTypes"`
}

func runIOSSmoke(args []string) error {
	set := flag.NewFlagSet("smoke ios", flag.ContinueOnError)
	options := registerSmokeFlags(set)
	app := set.String("app", "", "the simulator build's Discord.app")
	device := set.String("device", "", "UDID of a booted simulator; empty creates and boots a fresh iPhone")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *app == "" {
		return errors.New("usage: smoke ios --app <Discord.app> [--device <udid>] [--plugins <dir>] [--client <dir>] [--artifacts <dir>]")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	version, err := runSmokeCommand(ctx, time.Minute, "plutil", "-extract", "CFBundleShortVersionString", "raw", filepath.Join(*app, "Info.plist"))
	if err != nil {
		return err
	}
	if reason, err := unsupportedDiscordReason(options.repository, "ios", strings.TrimSpace(version)); err != nil || reason != "" {
		if err != nil {
			return err
		}
		return skipSmokeTest("ios", options, reason)
	}
	target := &iosSmokeTarget{app: *app, device: *device}
	defer target.cleanup()
	return runSmokeTest(ctx, "ios", options, target)
}

func (target *iosSmokeTarget) name() string {
	return "the iOS simulator " + target.device
}

func (target *iosSmokeTarget) hostAddress() string {
	return "127.0.0.1"
}

func (target *iosSmokeTarget) simctl(ctx context.Context, timeout time.Duration, args ...string) (string, error) {
	return runSmokeCommand(ctx, timeout, "xcrun", append([]string{"simctl"}, args...)...)
}

func (target *iosSmokeTarget) prepare(ctx context.Context, plugins []smokePlugin, settings []byte) error {
	if target.device == "" {
		if err := target.createDevice(ctx); err != nil {
			return err
		}
	}
	if _, err := target.simctl(ctx, 10*time.Minute, "bootstatus", target.device, "-b"); err != nil {
		return err
	}
	if _, err := target.simctl(ctx, 10*time.Minute, "install", target.device, target.app); err != nil {
		return err
	}
	container, err := target.simctl(ctx, time.Minute, "get_app_container", target.device, smokeIOSBundleID, "data")
	if err != nil {
		return err
	}
	documents := filepath.Join(strings.TrimSpace(container), "Documents", "Unbound")
	if err := os.MkdirAll(filepath.Join(documents, "Plugins"), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(documents, "settings.json"), settings, 0o644); err != nil {
		return err
	}
	for _, plugin := range plugins {
		destination := filepath.Join(documents, "Plugins", plugin.id)
		if err := os.MkdirAll(destination, 0o755); err != nil {
			return err
		}
		for _, file := range plugin.files {
			data, err := os.ReadFile(filepath.Join(plugin.directory, file))
			if err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(destination, file), data, 0o644); err != nil {
				return err
			}
		}
	}
	return nil
}

func (target *iosSmokeTarget) createDevice(ctx context.Context) error {
	output, err := target.simctl(ctx, time.Minute, "list", "runtimes", "-j")
	if err != nil {
		return err
	}
	runtime, deviceType, err := selectSimulator([]byte(output))
	if err != nil {
		return err
	}
	created, err := target.simctl(ctx, 2*time.Minute, "create", "Unbound smoke", deviceType, runtime)
	if err != nil {
		return err
	}
	target.device = strings.TrimSpace(created)
	target.created = true
	_, err = target.simctl(ctx, 5*time.Minute, "boot", target.device)
	return err
}

func selectSimulator(listing []byte) (string, string, error) {
	var parsed struct {
		Runtimes []simctlRuntime `json:"runtimes"`
	}
	if err := json.Unmarshal(listing, &parsed); err != nil {
		return "", "", fmt.Errorf("unreadable simulator runtimes: %w", err)
	}
	var best *simctlRuntime
	for index := range parsed.Runtimes {
		runtime := &parsed.Runtimes[index]
		if runtime.Platform != "iOS" || !runtime.IsAvailable {
			continue
		}
		if best == nil || compareVersions(runtime.Version, best.Version) > 0 {
			best = runtime
		}
	}
	if best == nil {
		return "", "", errors.New("no iOS simulator runtime is installed")
	}
	deviceType := ""
	for _, candidate := range best.SupportedDeviceTypes {
		if candidate.ProductFamily == "iPhone" {
			deviceType = candidate.Identifier
		}
	}
	if deviceType == "" {
		return "", "", fmt.Errorf("iOS %s supports no iPhone simulator", best.Version)
	}
	return best.Identifier, deviceType, nil
}

func compareVersions(left, right string) int {
	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	for index := 0; index < len(leftParts) || index < len(rightParts); index++ {
		var leftValue, rightValue int
		if index < len(leftParts) {
			leftValue, _ = strconv.Atoi(leftParts[index])
		}
		if index < len(rightParts) {
			rightValue, _ = strconv.Atoi(rightParts[index])
		}
		if leftValue != rightValue {
			if leftValue < rightValue {
				return -1
			}
			return 1
		}
	}
	return 0
}

func (target *iosSmokeTarget) streamLogs(ctx context.Context) (io.ReadCloser, func() error, error) {
	command := exec.CommandContext(ctx, "xcrun", "simctl", "spawn", target.device, "log", "stream", "--level", "info", "--style", "compact", "--predicate", smokeIOSLogPredicate)
	output, err := command.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	command.Stderr = command.Stdout
	if err := command.Start(); err != nil {
		return nil, nil, err
	}
	time.Sleep(3 * time.Second)
	stop := func() error {
		stopSmokeProcess(command)
		return nil
	}
	return output, stop, nil
}

func (target *iosSmokeTarget) launch(ctx context.Context) error {
	output, err := target.simctl(ctx, 2*time.Minute, "launch", target.device, smokeIOSBundleID)
	if err != nil {
		return err
	}
	target.pid = parseSimctlLaunchPID(output)
	return nil
}

func parseSimctlLaunchPID(output string) int {
	fields := strings.Fields(output)
	if len(fields) == 0 {
		return 0
	}
	pid, _ := strconv.Atoi(fields[len(fields)-1])
	return pid
}

func (target *iosSmokeTarget) running(ctx context.Context) bool {
	if target.pid <= 0 {
		return true
	}
	output, err := target.simctl(ctx, 30*time.Second, "spawn", target.device, "launchctl", "list")
	if err != nil {
		return true
	}
	return simulatorProcessListed(output, target.pid)
}

func simulatorProcessListed(listing string, pid int) bool {
	for _, line := range strings.Split(listing, "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[0] == strconv.Itoa(pid) {
			return true
		}
	}
	return false
}

func (target *iosSmokeTarget) isLoaderLine(line string) bool {
	return strings.Contains(line, "app.unbound")
}

func (target *iosSmokeTarget) isCrashLine(string) bool {
	return false
}

func (target *iosSmokeTarget) collect(ctx context.Context, artifacts string) {
	if target.device == "" {
		return
	}
	_, _ = target.simctl(ctx, time.Minute, "io", target.device, "screenshot", filepath.Join(artifacts, "screenshot.png"))
	saveSmokeOutput(ctx, filepath.Join(artifacts, "ios-log-show.txt"), 2*time.Minute, "xcrun", "simctl", "spawn", target.device, "log", "show", "--last", "30m", "--info", "--style", "compact", "--predicate", smokeIOSLogPredicate)
	if container, err := target.simctl(ctx, time.Minute, "get_app_container", target.device, smokeIOSBundleID, "data"); err == nil {
		saveSmokeOutput(ctx, filepath.Join(artifacts, "settings-after.json"), time.Minute, "cat", filepath.Join(strings.TrimSpace(container), "Documents", "Unbound", "settings.json"))
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	pattern := filepath.Join(home, "Library", "Logs", "DiagnosticReports", "Discord*")
	reports, _ := filepath.Glob(pattern)
	for attempt := 0; len(reports) == 0 && !target.running(ctx) && attempt < 15; attempt++ {
		time.Sleep(smokePollInterval)
		reports, _ = filepath.Glob(pattern)
	}
	for _, report := range reports {
		if data, err := os.ReadFile(report); err == nil {
			_ = os.WriteFile(filepath.Join(artifacts, filepath.Base(report)), data, 0o644)
		}
	}
}

func (target *iosSmokeTarget) cleanup() {
	if !target.created {
		return
	}
	ctx := context.Background()
	_, _ = target.simctl(ctx, 2*time.Minute, "shutdown", target.device)
	_, _ = target.simctl(ctx, 2*time.Minute, "delete", target.device)
}
