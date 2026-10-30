package main

import "testing"

func botComment(id int64, body string) prComment {
	comment := prComment{ID: id, Body: body}
	comment.User.Login = commentAuthor
	return comment
}

func TestStickyCommentsAreFoundByTheirHeading(t *testing.T) {
	human := prComment{ID: 1, Body: stickyCommentBody("Android smoke test", "copied")}
	human.User.Login = "someone"
	comments := []prComment{
		human,
		botComment(2, stickyCommentBody("iOS smoke test", "table")),
		botComment(3, stickyCommentBody("Android smoke test", "table")),
	}
	if got := findStickyComment(comments, "Android smoke test"); got != 3 {
		t.Fatalf("found comment %d, want the bot's Android one", got)
	}
	if got := findStickyComment(comments, "Android smoke test on main"); got != 0 {
		t.Fatalf("a longer title matched comment %d", got)
	}
}
