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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
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

	samplesMutex sync.Mutex
	samples      []string
}

var launchSampleDelays = []time.Duration{30 * time.Second, 90 * time.Second, 180 * time.Second}

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

const simctlListAttempts = 3

func retrySmokeCommand(attempts int, run func() (string, error)) (string, error) {
	var output string
	var err error
	for attempt := 0; attempt < attempts; attempt++ {
		if output, err = run(); err == nil {
			return output, nil
		}
	}
	return output, err
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
	output, err := retrySmokeCommand(simctlListAttempts, func() (string, error) {
		return target.simctl(ctx, 3*time.Minute, "list", "runtimes", "-j")
	})
	if err != nil {
		return err
	}
	choice, err := selectSimulator([]byte(output))
	if err != nil {
		return err
	}
	fmt.Printf("Creating the smoke simulator: %s.\n", choice.description)
	created, err := target.simctl(ctx, 2*time.Minute, "create", "Unbound smoke", choice.deviceType, choice.runtime)
	if err != nil {
		return err
	}
	target.device = strings.TrimSpace(created)
	target.created = true
	_, err = target.simctl(ctx, 5*time.Minute, "boot", target.device)
	return err
}

var numberedIPhone = regexp.MustCompile(`^iPhone (\d+)( Pro)?$`)

type simulatorChoice struct {
	runtime     string
	deviceType  string
	description string
}

func selectSimulator(listing []byte) (simulatorChoice, error) {
	var parsed struct {
		Runtimes []simctlRuntime `json:"runtimes"`
	}
	if err := json.Unmarshal(listing, &parsed); err != nil {
		return simulatorChoice{}, fmt.Errorf("unreadable simulator runtimes: %w", err)
	}
	var runtimes []simctlRuntime
	for _, runtime := range parsed.Runtimes {
		if runtime.Platform == "iOS" && runtime.IsAvailable {
			runtimes = append(runtimes, runtime)
		}
	}
	if len(runtimes) == 0 {
		return simulatorChoice{}, errors.New("no iOS simulator runtime is installed")
	}
	sort.SliceStable(runtimes, func(left, right int) bool {
		return compareVersions(runtimes[left].Version, runtimes[right].Version) > 0
	})
	for _, runtime := range runtimes {
		if device, name := numberedIPhoneOf(runtime); device != "" {
			return simulatorChoice{runtime.Identifier, device, name + " on iOS " + runtime.Version}, nil
		}
	}
	return simulatorChoice{}, errors.New("no installed iOS runtime offers a numbered iPhone simulator")
}

func numberedIPhoneOf(runtime simctlRuntime) (string, string) {
	bestNumber, bestPro := -1, false
	device, name := "", ""
	for _, candidate := range runtime.SupportedDeviceTypes {
		match := numberedIPhone.FindStringSubmatch(candidate.Name)
		if candidate.ProductFamily != "iPhone" || match == nil {
			continue
		}
		number, _ := strconv.Atoi(match[1])
		pro := match[2] != ""
		if number > bestNumber || (number == bestNumber && pro && !bestPro) {
			bestNumber, bestPro = number, pro
			device, name = candidate.Identifier, candidate.Name
		}
	}
	return device, name
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
	if target.pid > 0 && len(target.samples) == 0 {
		go target.sampleLaunch(ctx, target.pid)
	}
	return nil
}

func sampleProcess(ctx context.Context, pid int, path string) error {
	_, err := runSmokeCommand(ctx, time.Minute, "sample", strconv.Itoa(pid), "3", "-file", path)
	if err == nil {
		return nil
	}
	_, sudoErr := runSmokeCommand(ctx, time.Minute, "sudo", "-n", "sample", strconv.Itoa(pid), "3", "-file", path)
	if sudoErr == nil {
		return nil
	}
	return fmt.Errorf("%w\n%w", err, sudoErr)
}

func (target *iosSmokeTarget) sampleLaunch(ctx context.Context, pid int) {
	started := time.Now()
	for _, delay := range launchSampleDelays {
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(started.Add(delay))):
		}
		path := filepath.Join(os.TempDir(), fmt.Sprintf("discord-launch-sample-%d-%ds.txt", pid, int(delay.Seconds())))
		if err := sampleProcess(ctx, pid, path); err != nil {
			_ = os.WriteFile(path, []byte(err.Error()+"\n"), 0o644)
		}
		target.samplesMutex.Lock()
		target.samples = append(target.samples, path)
		target.samplesMutex.Unlock()
	}
}

// attach fails because the iOS loader reloads Discord in its process, so an exit is never a planned restart.
func (target *iosSmokeTarget) attach(context.Context) error {
	return errors.New("Discord exited; the iOS loader reloads in place")
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

func (target *iosSmokeTarget) consoleEntry(line string) (smokeConsoleEntry, bool) {
	return iosConsoleEntry(line)
}

func (target *iosSmokeTarget) isCrashLine(string) bool {
	return false
}

func (target *iosSmokeTarget) collect(ctx context.Context, artifacts string) {
	if target.device == "" {
		return
	}
	_, _ = target.simctl(ctx, time.Minute, "io", target.device, "screenshot", filepath.Join(artifacts, "screenshot.png"))
	target.samplesMutex.Lock()
	for _, sample := range target.samples {
		if data, err := os.ReadFile(sample); err == nil {
			_ = os.WriteFile(filepath.Join(artifacts, filepath.Base(sample)), data, 0o644)
		}
	}
	target.samplesMutex.Unlock()
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
