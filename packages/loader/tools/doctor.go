package main

import (
	"errors"
	"flag"
	"fmt"
	"os/exec"
	"runtime"
)

func runDoctor(args []string) error {
	set := flag.NewFlagSet("doctor", flag.ContinueOnError)
	strict := set.Bool("strict", false, "fail when optional platform tools are unavailable")
	if err := set.Parse(args); err != nil {
		return err
	}
	required := []string{"git", "go", "unzip"}
	if runtime.GOOS == "darwin" {
		required = append(required, "otool", "gmake", "ldid", "xcodebuild", "codesign")
	} else {
		required = append(required, "make")
	}
	missing := []string{}
	for _, name := range required {
		if _, err := exec.LookPath(name); err != nil {
			fmt.Println("missing", name)
			missing = append(missing, name)
		} else {
			fmt.Println("found", name)
		}
	}
	if runtime.GOOS == "darwin" {
		for _, name := range []string{"python3", "clang"} {
			if _, err := exec.LookPath(name); err != nil {
				fmt.Println("missing optional", name)
				if *strict {
					missing = append(missing, name)
				}
			} else {
				fmt.Println("found", name)
			}
		}
	}
	if _, err := packageName("."); err != nil {
		missing = append(missing, "control package metadata")
	}
	if len(missing) > 0 {
		return errors.New("doctor found missing requirements")
	}
	return nil
}
