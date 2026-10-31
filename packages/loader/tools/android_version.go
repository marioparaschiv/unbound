package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
)

type androidVersionChoice struct {
	Code    int
	Warning string
}

func chooseAndroidCode(channel string, code int, iosVersion string, requireMatching bool, latest func() (int, error)) (androidVersionChoice, error) {
	if code == 0 {
		found, err := latest()
		if err != nil {
			return androidVersionChoice{}, err
		}
		code = found
	}
	if channel != "stable" || iosVersion == "" {
		return androidVersionChoice{Code: code}, nil
	}
	iosCode, err := androidCodeForDiscordVersion(iosVersion)
	if err != nil {
		if requireMatching {
			return androidVersionChoice{}, fmt.Errorf("read the iOS version: %w", err)
		}
		return androidVersionChoice{Code: code}, nil
	}
	if iosCode/1000 == code/1000 {
		return androidVersionChoice{Code: code}, nil
	}
	mismatch := fmt.Sprintf("Android stable %d is a different Discord release than iOS %s", code, iosVersion)
	if requireMatching {
		return androidVersionChoice{}, errors.New(mismatch)
	}
	return androidVersionChoice{Code: code, Warning: mismatch}, nil
}

func runAndroidVersion(args []string) error {
	set := flag.NewFlagSet("android-version", flag.ContinueOnError)
	channel := set.String("channel", "stable", "stable, beta or alpha")
	code := set.Int("code", 0, "Android version code already chosen, such as the release pairing's")
	iosVersion := set.String("ios-version", "", "iOS version the Android build should pair with on stable")
	requireMatching := set.Bool("require-matching", false, "fail unless the Android build is the same Discord release as --ios-version")
	sniffURL := set.String("sniff-url", envOr("DISCORD_SNIFF_URL", defaultSniffURL), "sniff service base URL")
	trackerURL := set.String("android-tracker", envOr("DISCORD_TRACKER", defaultAndroidTracker), "Android package tracker base URL")
	output := set.String("output", os.Getenv("GITHUB_OUTPUT"), "file to append version to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if discordAndroidChannelRank(*channel) < 0 {
		return errors.New("usage: android-version --channel <stable|beta|alpha> [--code <code>] [--ios-version <version> [--require-matching]]")
	}
	sources := discordAPKSources{
		sniffURL:   strings.TrimRight(*sniffURL, "/"),
		trackerURL: strings.TrimRight(*trackerURL, "/"),
		client:     lookupClient(discordAPKLookupLimit),
	}
	choice, err := chooseAndroidCode(*channel, *code, strings.TrimSpace(*iosVersion), *requireMatching, func() (int, error) {
		return sources.latestCode(context.Background(), *channel)
	})
	if err != nil {
		return err
	}
	if choice.Warning != "" {
		fmt.Printf("::notice title=Unpaired Android build::%s; this build uses it anyway.\n", choice.Warning)
	}
	line := fmt.Sprintf("version=%d\n", choice.Code)
	if *output == "" {
		fmt.Print(line)
		return nil
	}
	file, err := os.OpenFile(*output, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.WriteString(line)
	return err
}
