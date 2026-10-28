package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type loaderRelease struct {
	Tag   string
	Title string
}

type loaderReleaseNames struct {
	IOS     *loaderRelease
	Android *loaderRelease
}

var releaseVersionPattern = regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)+)(?:_([0-9]+))?(?:-(ios-testflight|android-beta|android-alpha))?$`)

var releaseChannelLabels = map[string]string{
	"ios-testflight": "iOS TestFlight",
	"android-beta":   "Android beta",
	"android-alpha":  "Android alpha",
}

func releaseTag(discordVersion, platform string) string {
	return "discord-" + discordVersion + "-" + platform
}

func releaseTitle(loaderVersion, discordVersion, build, label string) string {
	if build != "" {
		discordVersion += " (" + build + ")"
	}
	return fmt.Sprintf("Unbound %s for Discord %s, %s", loaderVersion, discordVersion, label)
}

func nameLoaderReleases(releaseVersion, loaderVersion string) (loaderReleaseNames, error) {
	match := releaseVersionPattern.FindStringSubmatch(releaseVersion)
	if match == nil {
		return loaderReleaseNames{}, fmt.Errorf("%q is not a <version>[_<build>][-<platform>-<channel>] release version", releaseVersion)
	}
	if loaderVersion == "" {
		return loaderReleaseNames{}, errors.New("the loader version is required")
	}
	discordVersion, build, channel := match[1], match[2], match[3]
	if (build != "") != (channel == "ios-testflight") {
		return loaderReleaseNames{}, fmt.Errorf("%q pairs a build number with the wrong channel", releaseVersion)
	}
	if channel == "" {
		return loaderReleaseNames{
			IOS:     &loaderRelease{releaseTag(discordVersion, "ios"), releaseTitle(loaderVersion, discordVersion, "", "iOS")},
			Android: &loaderRelease{releaseTag(discordVersion, "android"), releaseTitle(loaderVersion, discordVersion, "", "Android")},
		}, nil
	}
	release := &loaderRelease{"discord-" + releaseVersion, releaseTitle(loaderVersion, discordVersion, build, releaseChannelLabels[channel])}
	if strings.HasPrefix(channel, "ios-") {
		return loaderReleaseNames{IOS: release}, nil
	}
	return loaderReleaseNames{Android: release}, nil
}

func (names loaderReleaseNames) outputLines() string {
	var lines strings.Builder
	for platform, release := range map[string]*loaderRelease{"ios": names.IOS, "android": names.Android} {
		if release != nil {
			fmt.Fprintf(&lines, "%s_release_tag=%s\n%s_release_title=%s\n", platform, release.Tag, platform, release.Title)
		}
	}
	return lines.String()
}

func runReleaseNames(args []string) error {
	set := flag.NewFlagSet("release-names", flag.ContinueOnError)
	releaseVersion := set.String("release-version", "", "the build's release version, such as 353.0, 353.0_119349-ios-testflight or 352.10-android-beta")
	control := set.String("control", "ios/control", "package control file holding the loader version")
	if err := set.Parse(args); err != nil {
		return err
	}
	contents, err := os.ReadFile(*control)
	if err != nil {
		return fmt.Errorf("read the loader version: %w", err)
	}
	loaderVersion := ""
	for _, line := range strings.Split(string(contents), "\n") {
		if value, found := strings.CutPrefix(line, "Version:"); found {
			loaderVersion = strings.TrimSpace(value)
		}
	}
	names, err := nameLoaderReleases(*releaseVersion, loaderVersion)
	if err != nil {
		return err
	}
	output := os.Getenv("GITHUB_OUTPUT")
	if output == "" {
		fmt.Print(names.outputLines())
		return nil
	}
	file, err := os.OpenFile(output, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open GitHub Actions output: %w", err)
	}
	defer file.Close()
	_, err = file.WriteString(names.outputLines())
	return err
}
