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
	"strings"
)

const releasedAndroidPageLimit = 10

// releasedAndroidTags matches the tags release-names gives each Android channel's releases.
var releasedAndroidTags = map[string]*regexp.Regexp{
	"stable": regexp.MustCompile(`^discord-([0-9]+\.[0-9]+)-android$`),
	"beta":   regexp.MustCompile(`^discord-([0-9]+\.[0-9]+)-android-beta$`),
	"alpha":  regexp.MustCompile(`^discord-([0-9]+\.[0-9]+)-android-alpha$`),
}

type githubReleaseSummary struct {
	TagName string `json:"tag_name"`
	Draft   bool   `json:"draft"`
}

func runReleasedAndroidCode(args []string) error {
	set := flag.NewFlagSet("released-android-code", flag.ContinueOnError)
	channel := set.String("channel", "", "stable, beta or alpha")
	githubAPIURL := set.String("github-api-url", defaultGithubAPI, "GitHub API base URL")
	githubRepository := set.String("github-repository", os.Getenv("GITHUB_REPOSITORY"), "GitHub owner/repository")
	if err := set.Parse(args); err != nil {
		return err
	}
	if releasedAndroidTags[*channel] == nil {
		return errors.New("usage: released-android-code --channel <stable|beta|alpha>")
	}
	if *githubRepository == "" || os.Getenv("GITHUB_TOKEN") == "" {
		return errors.New("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
	}
	code, err := latestReleasedAndroidCode(context.Background(), lookupClient(releasePollRequestLimit), strings.TrimRight(*githubAPIURL, "/"), *githubRepository, os.Getenv("GITHUB_TOKEN"), *channel)
	if err != nil {
		return err
	}
	fmt.Println(code)
	return nil
}

// latestReleasedAndroidCode returns the Discord version code of the newest Discord the channel has a published Unbound release for.
func latestReleasedAndroidCode(ctx context.Context, client *http.Client, apiURL, repository, token, channel string) (int, error) {
	pattern := releasedAndroidTags[channel]
	best := 0
	for page := 1; page <= releasedAndroidPageLimit; page++ {
		endpoint := fmt.Sprintf("%s/repos/%s/releases?per_page=100&page=%d", apiURL, repository, page)
		body, status, err := fetchResponse(ctx, client, endpoint, token, map[string]string{"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
		if err != nil {
			return 0, fmt.Errorf("Failed to list the releases of %s: %w", repository, err)
		}
		if status != http.StatusOK {
			return 0, fmt.Errorf("Failed to list the releases of %s: GitHub returned HTTP %d", repository, status)
		}
		var releases []githubReleaseSummary
		if err := json.Unmarshal(body, &releases); err != nil {
			return 0, fmt.Errorf("Failed to decode the releases of %s: %w", repository, err)
		}
		for _, release := range releases {
			match := pattern.FindStringSubmatch(release.TagName)
			if release.Draft || match == nil {
				continue
			}
			code, err := androidCodeForDiscordVersion(match[1])
			if err == nil && code > best {
				best = code
			}
		}
		if len(releases) < 100 {
			break
		}
	}
	if best == 0 {
		return 0, fmt.Errorf("%s has no published Android %s release", repository, channel)
	}
	return best, nil
}
