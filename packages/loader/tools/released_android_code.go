package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
)

const releasedAndroidPageLimit = 10

// releasedAndroidTags matches the tags release-names gives each Android channel's releases.
var releasedAndroidTags = map[string]*regexp.Regexp{
	"stable": regexp.MustCompile(`^discord-([0-9]+)\.([0-9]+)-android$`),
	"beta":   regexp.MustCompile(`^discord-([0-9]+)\.([0-9]+)-android-beta$`),
	"alpha":  regexp.MustCompile(`^discord-([0-9]+)\.([0-9]+)-android-alpha$`),
}

type githubReleaseSummary struct {
	TagName string `json:"tag_name"`
	Draft   bool   `json:"draft"`
}

type releasedAndroidVersion struct {
	Major int
	Minor int
}

func runReleasedAndroidCode(args []string) error {
	set := flag.NewFlagSet("released-android-code", flag.ContinueOnError)
	channel := set.String("channel", "", "stable, beta or alpha")
	githubAPIURL := set.String("github-api-url", defaultGithubAPI, "GitHub API base URL")
	githubRepository := set.String("github-repository", os.Getenv("GITHUB_REPOSITORY"), "GitHub owner/repository")
	trackerURL := set.String("android-tracker", envOr("DISCORD_TRACKER", defaultAndroidTracker), "Android package tracker base URL")
	if err := set.Parse(args); err != nil {
		return err
	}
	if releasedAndroidTags[*channel] == nil {
		return errors.New("usage: released-android-code --channel <stable|beta|alpha>")
	}
	if *githubRepository == "" || os.Getenv("GITHUB_TOKEN") == "" {
		return errors.New("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
	}
	ctx := context.Background()
	client := lookupClient(releasePollRequestLimit)
	version, err := latestReleasedAndroidVersion(ctx, client, strings.TrimRight(*githubAPIURL, "/"), *githubRepository, os.Getenv("GITHUB_TOKEN"), *channel)
	if err != nil {
		return err
	}
	code, err := releasedAndroidCode(ctx, client, strings.TrimRight(*trackerURL, "/"), *channel, version)
	if err != nil {
		return err
	}
	fmt.Println(code)
	return nil
}

// latestReleasedAndroidVersion returns the newest Discord version the channel has a published Unbound release for.
func latestReleasedAndroidVersion(ctx context.Context, client *http.Client, apiURL, repository, token, channel string) (releasedAndroidVersion, error) {
	pattern := releasedAndroidTags[channel]
	var best releasedAndroidVersion
	for page := 1; page <= releasedAndroidPageLimit; page++ {
		endpoint := fmt.Sprintf("%s/repos/%s/releases?per_page=100&page=%d", apiURL, repository, page)
		body, status, err := fetchResponse(ctx, client, endpoint, token, map[string]string{"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
		if err != nil {
			return best, fmt.Errorf("Failed to list the releases of %s: %w", repository, err)
		}
		if status != http.StatusOK {
			return best, fmt.Errorf("Failed to list the releases of %s: GitHub returned HTTP %d", repository, status)
		}
		var releases []githubReleaseSummary
		if err := json.Unmarshal(body, &releases); err != nil {
			return best, fmt.Errorf("Failed to decode the releases of %s: %w", repository, err)
		}
		for _, release := range releases {
			match := pattern.FindStringSubmatch(release.TagName)
			if release.Draft || match == nil {
				continue
			}
			major, _ := strconv.Atoi(match[1])
			minor, _ := strconv.Atoi(match[2])
			if minor < 100 && (major > best.Major || major == best.Major && minor > best.Minor) {
				best = releasedAndroidVersion{Major: major, Minor: minor}
			}
		}
		if len(releases) < 100 {
			break
		}
	}
	if best.Major == 0 {
		return best, fmt.Errorf("%s has no published Android %s release", repository, channel)
	}
	return best, nil
}

// releasedAndroidCode turns a release's Discord version back into its version code. Codes carry their Play track
// (major*1000 + track*100 + minor) and a channel release takes the newest code of its own or a steadier track, so the
// highest track the tracker can serve is the one the release patched.
func releasedAndroidCode(ctx context.Context, client *http.Client, trackerURL, channel string, version releasedAndroidVersion) (int, error) {
	for track := discordAndroidChannelRank(channel); track > 0; track-- {
		code := version.Major*1000 + track*100 + version.Minor
		available, err := verifyAndroidBasePackage(ctx, client, trackerURL, code)
		if err != nil {
			return 0, err
		}
		if available {
			return code, nil
		}
	}
	return version.Major*1000 + version.Minor, nil
}
