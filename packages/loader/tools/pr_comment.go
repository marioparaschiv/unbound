package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type prComment struct {
	ID   int64  `json:"id"`
	Body string `json:"body"`
	User struct {
		Login string `json:"login"`
	} `json:"user"`
}

const commentAuthor = "github-actions[bot]"

func stickyCommentHeading(title string) string {
	return "# " + title + "\n"
}

func stickyCommentBody(title, markdown string) string {
	return stickyCommentHeading(title) + "\n" + markdown
}

func findStickyComment(comments []prComment, title string) int64 {
	for _, comment := range comments {
		if comment.User.Login == commentAuthor && strings.HasPrefix(comment.Body, stickyCommentHeading(title)) {
			return comment.ID
		}
	}
	return 0
}

func ghAPI(input []byte, args ...string) ([]byte, error) {
	command := exec.Command("gh", append([]string{"api"}, args...)...)
	if input != nil {
		command.Stdin = bytes.NewReader(input)
	}
	var stderr bytes.Buffer
	command.Stderr = &stderr
	output, err := command.Output()
	if err != nil {
		return nil, fmt.Errorf("gh api %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return output, nil
}

func upsertStickyComment(repository string, pullRequest int, title, markdown string) error {
	output, err := ghAPI(nil, "--paginate", "--slurp", fmt.Sprintf("repos/%s/issues/%d/comments", repository, pullRequest))
	if err != nil {
		return err
	}
	var pages [][]prComment
	if err := json.Unmarshal(output, &pages); err != nil {
		return err
	}
	var comments []prComment
	for _, page := range pages {
		comments = append(comments, page...)
	}
	payload, err := json.Marshal(map[string]string{"body": stickyCommentBody(title, markdown)})
	if err != nil {
		return err
	}
	if id := findStickyComment(comments, title); id != 0 {
		_, err = ghAPI(payload, "--method", "PATCH", fmt.Sprintf("repos/%s/issues/comments/%d", repository, id), "--input", "-")
		return err
	}
	_, err = ghAPI(payload, "--method", "POST", fmt.Sprintf("repos/%s/issues/%d/comments", repository, pullRequest), "--input", "-")
	return err
}

func runPRComment(args []string) error {
	set := flag.NewFlagSet("pr-comment", flag.ContinueOnError)
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the pull request")
	pullRequest := set.Int("pr", 0, "pull request number")
	title := set.String("title", "", "heading that identifies the comment to keep updating")
	bodyFile := set.String("body-file", "", "markdown to put under the heading")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *repository == "" || *pullRequest == 0 || *title == "" || *bodyFile == "" {
		return errors.New("usage: pr-comment --pr <number> --title <heading> --body-file <markdown> [--repo <owner/name>]")
	}
	markdown, err := os.ReadFile(*bodyFile)
	if err != nil {
		return err
	}
	return upsertStickyComment(*repository, *pullRequest, *title, string(markdown))
}
