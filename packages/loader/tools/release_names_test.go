package main

import "testing"

func TestLoaderReleasesAlwaysNameTheirPlatform(t *testing.T) {
	for releaseVersion, want := range map[string]loaderReleaseNames{
		"353.0": {
			IOS:     &loaderRelease{"discord-353.0-ios", "Unbound 1.0.1 for Discord 353.0, iOS"},
			Android: &loaderRelease{"discord-353.0-android", "Unbound 1.0.1 for Discord 353.0, Android"},
		},
		"353.0_119349-ios-testflight": {
			IOS: &loaderRelease{"discord-353.0_119349-ios-testflight", "Unbound 1.0.1 for Discord 353.0 (119349), iOS TestFlight"},
		},
		"352.10-android-beta": {
			Android: &loaderRelease{"discord-352.10-android-beta", "Unbound 1.0.1 for Discord 352.10, Android beta"},
		},
		"353.1-android-alpha": {
			Android: &loaderRelease{"discord-353.1-android-alpha", "Unbound 1.0.1 for Discord 353.1, Android alpha"},
		},
	} {
		names, err := nameLoaderReleases(releaseVersion, "1.0.1")
		if err != nil {
			t.Fatal(err)
		}
		for platform, pair := range map[string][2]*loaderRelease{"iOS": {names.IOS, want.IOS}, "Android": {names.Android, want.Android}} {
			got, wanted := pair[0], pair[1]
			if (got == nil) != (wanted == nil) || got != nil && *got != *wanted {
				t.Fatalf("%s names its %s release %+v, want %+v", releaseVersion, platform, got, wanted)
			}
		}
	}
}

func TestLoaderReleaseNamesRejectMalformedVersions(t *testing.T) {
	for _, releaseVersion := range []string{"", "353", "353.0_119349", "353.0-ios-testflight", "353.0_1-android-beta", "353.0-android-nightly"} {
		if _, err := nameLoaderReleases(releaseVersion, "1.0.1"); err == nil {
			t.Fatalf("%q was named", releaseVersion)
		}
	}
	if _, err := nameLoaderReleases("353.0", ""); err == nil {
		t.Fatal("a release was named without a loader version")
	}
}
