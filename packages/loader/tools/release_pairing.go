package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
)

type releasePairing struct {
	AndroidCode    int
	AndroidVersion string
	Mismatch       string
}

func pairStableRelease(iosVersion, requestedVersion string, androidCode int) (releasePairing, error) {
	if _, err := androidCodeForDiscordVersion(iosVersion); err != nil {
		return releasePairing{}, fmt.Errorf("read the iOS version: %w", err)
	}
	androidVersion, err := discordVersionForAndroidCode(androidCode)
	if err != nil {
		return releasePairing{}, err
	}
	pairing := releasePairing{AndroidCode: androidCode, AndroidVersion: androidVersion}
	if requestedVersion != "" && iosVersion != requestedVersion {
		pairing.Mismatch = fmt.Sprintf("The iOS IPA is %s but the requested release is %s", iosVersion, requestedVersion)
	}
	return pairing, nil
}

func runReleasePairing(args []string) error {
	set := flag.NewFlagSet("release-pairing", flag.ContinueOnError)
	iosVersion := set.String("ios-version", "", "version of the iOS IPA being released")
	requestedVersion := set.String("requested-version", "", "iOS version the release asked for, if any")
	androidCode := set.Int("android-code", 0, "latest Android stable version code, released alongside the iOS build whatever its Discord version")
	dryRun := set.Bool("dry-run", false, "report a mismatch as a warning instead of failing")
	output := set.String("output", os.Getenv("GITHUB_OUTPUT"), "file to append android_code and android_version to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *iosVersion == "" || *androidCode == 0 {
		return errors.New("usage: release-pairing --ios-version <version> --android-code <code> [--requested-version <version>] [--dry-run]")
	}
	pairing, err := pairStableRelease(strings.TrimSpace(*iosVersion), strings.TrimSpace(*requestedVersion), *androidCode)
	if err != nil {
		return err
	}
	if pairing.Mismatch != "" && !*dryRun {
		return errors.New(pairing.Mismatch)
	}
	if pairing.Mismatch != "" {
		fmt.Printf("::warning::%s. A real release would stop here.\n", pairing.Mismatch)
	}
	lines := fmt.Sprintf("android_code=%d\nandroid_version=%s\n", pairing.AndroidCode, pairing.AndroidVersion)
	if *output == "" {
		fmt.Print(lines)
		return nil
	}
	file, err := os.OpenFile(*output, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.WriteString(lines)
	return err
}
