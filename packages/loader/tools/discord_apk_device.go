package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	adbQueryLimit   = 30 * time.Second
	adbInstallLimit = 10 * time.Minute
)

type adbRunner func(ctx context.Context, timeout time.Duration, args ...string) (string, error)

var androidDensityBuckets = []struct {
	name string
	dpi  int
}{
	{"ldpi", 120},
	{"mdpi", 160},
	{"tvdpi", 213},
	{"hdpi", 240},
	{"xhdpi", 320},
	{"xxhdpi", 480},
	{"xxxhdpi", 640},
}

func adbForSerial(serial string) adbRunner {
	return func(ctx context.Context, timeout time.Duration, args ...string) (string, error) {
		ctx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		command := exec.CommandContext(ctx, "adb", append([]string{"-s", serial}, args...)...)
		command.WaitDelay = time.Second
		output, err := command.CombinedOutput()
		if ctx.Err() == context.DeadlineExceeded {
			return string(output), fmt.Errorf("adb %s timed out after %s", strings.Join(args, " "), timeout)
		}
		if err != nil {
			return string(output), fmt.Errorf("adb %s: %w: %s", strings.Join(args, " "), err, safeMessage(string(output)))
		}
		return string(output), nil
	}
}

func discordDeviceSplits(ctx context.Context, adb adbRunner) ([]string, error) {
	if installed, err := adb(ctx, adbQueryLimit, "shell", "pm", "path", discordAndroidPackage); err == nil {
		if splits := parseInstalledSplits(installed); len(splits) > 0 {
			return splits, nil
		}
	}
	abi, err := adb(ctx, adbQueryLimit, "shell", "getprop", "ro.product.cpu.abi")
	if err != nil {
		return nil, err
	}
	density, err := adb(ctx, adbQueryLimit, "shell", "wm", "density")
	if err != nil {
		return nil, err
	}
	dpi, err := parseWMDensity(density)
	if err != nil {
		return nil, err
	}
	locale := ""
	for _, property := range []string{"persist.sys.locale", "ro.product.locale"} {
		if value, err := adb(ctx, adbQueryLimit, "shell", "getprop", property); err == nil && strings.TrimSpace(value) != "" {
			locale = strings.TrimSpace(value)
			break
		}
	}
	abiName := strings.TrimSpace(abi)
	if abiName == "" {
		return nil, errors.New("the device reports no ro.product.cpu.abi")
	}
	return []string{"base", abiSplit(abiName), languageSplit(locale), densitySplit(dpi)}, nil
}

func parseInstalledSplits(output string) []string {
	var splits []string
	for _, line := range strings.Split(output, "\n") {
		apk, found := strings.CutPrefix(strings.TrimSpace(line), "package:")
		if !found || !strings.HasSuffix(apk, ".apk") {
			continue
		}
		name := strings.TrimSuffix(path.Base(apk), ".apk")
		if name == "base" {
			splits = append(splits, name)
		} else if split, ok := strings.CutPrefix(name, "split_"); ok && split != "" {
			splits = append(splits, split)
		}
	}
	return orderSplits(splits)
}

func parseWMDensity(output string) (int, error) {
	densities := map[string]int{}
	for _, line := range strings.Split(output, "\n") {
		label, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		if dpi, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			densities[strings.ToLower(strings.TrimSpace(label))] = dpi
		}
	}
	for _, label := range []string{"override density", "physical density"} {
		if dpi, ok := densities[label]; ok && dpi > 0 {
			return dpi, nil
		}
	}
	return 0, fmt.Errorf("could not read a density from wm density: %s", safeMessage(output))
}

func abiSplit(abi string) string {
	return "config." + strings.ReplaceAll(abi, "-", "_")
}

func languageSplit(locale string) string {
	language, _, _ := strings.Cut(strings.ReplaceAll(locale, "_", "-"), "-")
	language = strings.ToLower(strings.TrimSpace(language))
	if language == "" {
		language = "en"
	}
	return "config." + language
}

func densitySplit(dpi int) string {
	for _, bucket := range androidDensityBuckets {
		if dpi <= bucket.dpi {
			return "config." + bucket.name
		}
	}
	return "config." + androidDensityBuckets[len(androidDensityBuckets)-1].name
}

func orderSplits(splits []string) []string {
	seen := map[string]bool{}
	var ordered []string
	for _, split := range splits {
		if split != "" && !seen[split] {
			seen[split] = true
			ordered = append(ordered, split)
		}
	}
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i] == "base" || ordered[j] == "base" {
			return ordered[i] == "base" && ordered[j] != "base"
		}
		return ordered[i] < ordered[j]
	})
	return ordered
}

func installDiscordSplits(ctx context.Context, adb adbRunner, files map[string]string) error {
	if files["base"] == "" {
		return errors.New("installing needs the base split")
	}
	names := make([]string, 0, len(files))
	for split := range files {
		names = append(names, split)
	}
	args := []string{"install-multiple", "-r", "-d"}
	for _, split := range orderSplits(names) {
		args = append(args, files[split])
	}
	output, err := adb(ctx, adbInstallLimit, args...)
	if err != nil {
		return err
	}
	if !strings.Contains(output, "Success") {
		return fmt.Errorf("adb install-multiple did not report success: %s", safeMessage(output))
	}
	fmt.Fprintf(os.Stderr, "discord-apk: installed %s\n", strings.Join(orderSplits(names), ", "))
	return nil
}
