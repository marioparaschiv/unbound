package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}
	switch args[0] {
	case "fetch":
		return runFetch(args[1:])
	case "ipa-info":
		return runIPAInfo(args[1:])
	case "patch-ipa":
		return runPatchIPA(args[1:])
	case "ipa-icons":
		return runIPAIcons(args[1:])
	case "discord-version":
		return runDiscordVersion(args[1:])
	case "discord-apk":
		return runDiscordAPK(args[1:])
	case "release-candidate":
		return runReleaseCandidate(args[1:])
	case "publish-loader-releases":
		return runPublishLoaderReleases(args[1:])
	case "generate-loader-changelog":
		return runGenerateLoaderChangelog(args[1:])
	case "attest":
		return runAttest(args[1:])
	case "build":
		return runBuild(args[1:])
	case "platform":
		return runPlatform(args[1:])
	case "validate":
		return runValidate(args[1:])
	case "deps":
		return runDependencies(args[1:])
	case "packages":
		return runPackages(args[1:])
	case "libffi-build":
		return runLibFFIBuild(args[1:])
	case "doctor":
		return runDoctor(args[1:])
	case "dev":
		return runDev(args[1:])
	case "compat-scan":
		return runCompatScan(args[1:])
	case "compat-issue":
		return runCompatIssue(args[1:])
	case "format":
		return runFormat(args[1:])
	case "lint":
		return runLint(args[1:])
	case "version":
		fmt.Println("tools dev")
		return nil
	case "help", "-h", "--help":
		printUsage()
		return nil
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func printUsage() {
	fmt.Println("usage: go run ./tools <build|platform|validate|deps|packages|libffi-build|fetch|ipa-info|patch-ipa|ipa-icons|discord-version|discord-apk|release-candidate|generate-loader-changelog|publish-loader-releases|attest|doctor|dev|compat-scan|compat-issue|format|lint>")
	fmt.Println("       go run ./tools build <tweak|ipa|simulator|all> [flags]")
	fmt.Println("       go run ./tools platform <build|test> <ios|android> [flags]")
	fmt.Println("       go run ./tools validate [--root <path>]")
	fmt.Println("       go run ./tools deps [--root <path>]")
	fmt.Println("       go run ./tools packages <list|validate> [--root <path>]")
	fmt.Println("       go run ./tools libffi-build --archive <path> --include <path>")
	fmt.Println("       go run ./tools ipa-info --ipa <path>")
	fmt.Println("       go run ./tools patch-ipa --ipa <path> --output <path>")
	fmt.Println("       go run ./tools ipa-icons [--root <path>]")
	fmt.Println("       go run ./tools discord-version --version <version> | --android-code <code>")
	fmt.Println("       go run ./tools discord-apk --channel <stable|beta|alpha> [--code <code>] [--output-dir <dir> --split <name>...]")
	fmt.Println("       go run ./tools release-candidate --channel <stable|testflight|android-beta|android-alpha>")
	fmt.Println("       go run ./tools publish-loader-releases --version <semver> --ios-url <release-url> --android-url <release-url> [--changelog-file <path>]")
	fmt.Println("       go run ./tools generate-loader-changelog --version <semver> --output <path>")
	fmt.Println("       go run ./tools attest <enabled|stage|sign|verify> [flags]")
	fmt.Println("       go run ./tools compat-scan [--ipa <path>] [--apk <path>...] [--android-version <v>] [--baseline <json>] [--results <json>] [--report <md>] [--ios-sdk <path>] [--android-jar <path>]")
	fmt.Println("       go run ./tools compat-issue --results <json> --report <md> --channel <name> [--repo <owner/name>]")
	fmt.Println("       go run ./tools format [--check] [--root <path>]")
	fmt.Println("       go run ./tools lint [--root <path>]")
	fmt.Println("       go run ./tools dev status [--root <path>]")
	fmt.Println("       go run ./tools dev android-avd <status|setup|start> [--name <name>] [--root <path>]")
}

func requireArgs(args []string, count int, usage string) error {
	if len(args) < count {
		return errors.New(usage)
	}
	return nil
}
