package main

import (
	"errors"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

func runDiscordVersion(args []string) error {
	set := flag.NewFlagSet("discord-version", flag.ContinueOnError)
	version := set.String("version", "", "Discord version name")
	androidCode := set.Int("android-code", 0, "Android version code")
	if err := set.Parse(args); err != nil {
		return err
	}
	if (*version == "") == (*androidCode == 0) {
		return errors.New("usage: discord-version --version <version> | --android-code <code>")
	}
	if *version != "" {
		code, err := androidCodeForDiscordVersion(*version)
		if err != nil {
			return err
		}
		fmt.Println(code)
		return nil
	}
	name, err := discordVersionForAndroidCode(*androidCode)
	if err != nil {
		return err
	}
	fmt.Println(name)
	return nil
}

func androidCodeForDiscordVersion(version string) (int, error) {
	version = strings.TrimSpace(strings.SplitN(version, "_", 2)[0])
	parts := strings.Split(version, ".")
	if len(parts) < 2 {
		return 0, fmt.Errorf("invalid Discord version %q", version)
	}
	major, err := strconv.ParseUint(parts[0], 10, 31)
	if err != nil {
		return 0, fmt.Errorf("invalid Discord version %q", version)
	}
	minor, err := strconv.ParseUint(parts[1], 10, 10)
	if err != nil || major == 0 || minor > 999 {
		return 0, fmt.Errorf("invalid Discord version %q", version)
	}
	return int(major*1000 + minor), nil
}

func discordVersionForAndroidCode(code int) (string, error) {
	if code < 1000 {
		return "", fmt.Errorf("invalid Android version code %d", code)
	}
	return fmt.Sprintf("%d.%d", code/1000, code%1000), nil
}
