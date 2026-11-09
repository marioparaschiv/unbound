package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

// runIOSPrewarm pays a fresh simulator's slow first Discord launch with an earlier build, so the smoke test that
// reuses the device launches this run's build in seconds. The cost is per device, not per app install.
func runIOSPrewarm(args []string) error {
	set := flag.NewFlagSet("smoke ios-prewarm", flag.ContinueOnError)
	app := set.String("app", "", "an earlier simulator build's Discord.app to launch once")
	timeout := set.Duration("timeout", 15*time.Minute, "stop waiting for Discord's runtime after this long")
	output := set.String("output", os.Getenv("GITHUB_OUTPUT"), "file to append device=<udid> to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *app == "" {
		return errors.New("usage: smoke ios-prewarm --app <Discord.app> [--timeout <duration>] [--output <file>]")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	target := &iosSmokeTarget{app: *app}
	if err := target.prewarm(ctx, *timeout); err != nil {
		target.cleanup()
		return err
	}
	fmt.Printf("Prewarmed the iOS simulator %s.\n", target.device)
	return appendGitHubOutput(*output, "device", target.device)
}

func (target *iosSmokeTarget) prewarm(ctx context.Context, timeout time.Duration) error {
	if err := target.createDevice(ctx); err != nil {
		return err
	}
	if _, err := target.simctl(ctx, 10*time.Minute, "bootstatus", target.device, "-b"); err != nil {
		return err
	}
	if _, err := target.simctl(ctx, 10*time.Minute, "install", target.device, target.app); err != nil {
		return err
	}
	logs, stopLogs, err := target.streamLogs(ctx)
	if err != nil {
		return err
	}
	started := time.Now()
	if _, err := target.simctl(ctx, 2*time.Minute, "launch", target.device, smokeIOSBundleID); err != nil {
		_ = stopLogs()
		return err
	}
	created := waitForLogLine(ctx, logs, smokeRuntimeCreated, timeout)
	_ = stopLogs()
	if created {
		fmt.Printf("Discord's first launch created its runtime in %s.\n", time.Since(started).Round(time.Second))
	} else {
		fmt.Printf("::warning title=Simulator partly prewarmed::Discord's runtime was not created within %s, so the smoke test's launch may still be slow.\n", timeout)
	}
	if _, err := target.simctl(ctx, time.Minute, "terminate", target.device, smokeIOSBundleID); err != nil {
		fmt.Printf("Failed to terminate Discord on %s: %v\n", target.device, err)
	}
	// The smoke test needs an empty data container, so the earlier build's settings and plugins cannot leak into it.
	_, err = target.simctl(ctx, 2*time.Minute, "uninstall", target.device, smokeIOSBundleID)
	return err
}

// waitForLogLine reports whether a line containing want arrives on logs before the timeout.
func waitForLogLine(ctx context.Context, logs io.Reader, want string, timeout time.Duration) bool {
	found := make(chan struct{})
	go func() {
		scanner := bufio.NewScanner(logs)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			if strings.Contains(scanner.Text(), want) {
				close(found)
				return
			}
		}
	}()
	select {
	case <-found:
		return true
	case <-time.After(timeout):
		return false
	case <-ctx.Done():
		return false
	}
}

// appendGitHubOutput appends name=value to a GitHub Actions output file; an empty path prints nothing more.
func appendGitHubOutput(path, name, value string) error {
	if path == "" {
		return nil
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(file, "%s=%s\n", name, value); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}
