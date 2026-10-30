package main

import (
	"errors"
	"testing"
)

func latestIs(code int) func() (int, error) {
	return func() (int, error) { return code, nil }
}

func TestAndroidVersionPairsStableByDiscordRelease(t *testing.T) {
	for _, test := range []struct {
		name, channel, ios string
		code               int
		require            bool
		want               int
		warning, failure   bool
	}{
		{name: "the pairing's code wins", channel: "stable", code: 351011, ios: "351.0", require: true, want: 351011},
		{name: "latest stable of the same release", channel: "stable", ios: "351.0", require: true, want: 351011},
		{name: "a newer Android release fails a release", channel: "stable", ios: "350.0", require: true, failure: true},
		{name: "a PR build keeps the latest stable", channel: "stable", ios: "205.0", want: 351011, warning: true},
		{name: "beta ignores the iOS version", channel: "beta", ios: "205.0", require: true, want: 351011},
		{name: "no iOS version takes the latest", channel: "stable", want: 351011},
	} {
		t.Run(test.name, func(t *testing.T) {
			choice, err := chooseAndroidCode(test.channel, test.code, test.ios, test.require, latestIs(351011))
			if test.failure {
				if err == nil {
					t.Fatalf("chose %+v, want a failure", choice)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if choice.Code != test.want || (choice.Warning != "") != test.warning {
				t.Fatalf("chose %+v, want %d with warning %v", choice, test.want, test.warning)
			}
		})
	}
}

func TestAndroidVersionReportsAFailedLookup(t *testing.T) {
	_, err := chooseAndroidCode("stable", 0, "351.0", true, func() (int, error) { return 0, errors.New("offline") })
	if err == nil {
		t.Fatal("a failed lookup chose a version")
	}
}
