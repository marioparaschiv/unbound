package main

import (
	"slices"
	"strings"
	"testing"
)

func TestEditDistanceWithin(t *testing.T) {
	cases := []struct {
		left, right string
		limit       int
		distance    int
		ok          bool
	}{
		{"kitten", "sitting", 3, 3, true},
		{"kitten", "sitting", 2, 0, false},
		{"store", "store", 0, 0, true},
		{"abc", "abcdef", 2, 0, false},
		{"", "ab", 2, 2, true},
	}
	for _, test := range cases {
		distance, ok := editDistanceWithin(test.left, test.right, test.limit)
		if ok != test.ok || ok && distance != test.distance {
			t.Fatalf("%q→%q within %d: got %d %v", test.left, test.right, test.limit, distance, ok)
		}
	}
}

func TestNearestNames(t *testing.T) {
	names := sliceNames([]string{
		"useMessagesStore",
		"useMessageStores",
		"useUserStore",
		"MessageStore",
		"com.discord.chat2.MessageView",
		"com.discord.chat.MessageViewV2",
		"messagestore",
		"unrelatedThing",
	})

	got := nearestNames("useMessageStore", names)
	if len(got) < 2 || !slices.Contains(got[:2], "useMessagesStore") || !slices.Contains(got[:2], "useMessageStores") {
		t.Fatalf("one-letter renames should be suggested: %v", got)
	}

	if got := nearestNames("com.discord.chat.MessageView", names); len(got) == 0 || got[0] != "com.discord.chat2.MessageView" {
		t.Fatalf("a class that moved package should come first: %v", got)
	}

	if got := nearestNames("MessageStore", sliceNames([]string{"messagestore", "MessageStore"})); !slices.Equal(got, []string{"messagestore"}) {
		t.Fatalf("the name itself must not be suggested, other cases should: %v", got)
	}

	if got := nearestNames("selectGuild", names); len(got) != 0 {
		t.Fatalf("unrelated names must not be suggested: %v", got)
	}

	many := sliceNames([]string{"getIdA", "getIdB", "getIdC", "getIdD"})
	if got := nearestNames("getId", many); len(got) != compatSuggestionLimit {
		t.Fatalf("suggestions must be capped at %d: %v", compatSuggestionLimit, got)
	}
}

func TestCompatSuggestionsInReasons(t *testing.T) {
	location := []compatLocation{{File: "a.ts", Line: 1}}
	targets := compatTestTargets()
	targets[0].hermes.strings["transitionToGuilds"] = true
	targets[0].hermes.identifiers["transitionToGuilds"] = true
	targets[1].dex.Classes["com.discord.View"].Methods["setMessages"] = []string{"Lcom/discord/Message;"}
	references := []*compatReference{
		{Kind: referenceProps, Terms: []string{"transitionToGuildz"}, Component: "client", Locations: location},
		{Kind: referenceJavaMethod, Class: "com.discord.View", Name: "setMesage", Component: "plugin:demo", Locations: location},
	}
	results := evaluateCompat(references, targets, nil)

	props := statusOf(results, "ios", referenceProps, "transitionToGuildz")
	if props.Status != compatBroken || !strings.Contains(props.Reason, "`transitionToGuildz` → `transitionToGuild`, `transitionToGuilds`") {
		t.Fatalf("missing props should suggest near identifiers: %+v", props)
	}

	method := statusOf(results, "android", referenceJavaMethod, "setMesage")
	if !strings.Contains(method.Reason, "(similar: `setMessage`)") {
		t.Fatalf("missing methods should suggest the class's near methods: %+v", method)
	}
}
