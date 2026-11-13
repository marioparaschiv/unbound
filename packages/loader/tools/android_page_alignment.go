package main

import (
	"archive/zip"
	"bytes"
	"debug/elf"
	"errors"
	"flag"
	"fmt"
	"strings"
)

const androidPageSize = 16 * 1024

func runCheckPageAlignment(args []string) error {
	set := flag.NewFlagSet("check-page-alignment", flag.ContinueOnError)
	apk := set.String("apk", "", "APK whose native libraries must load on 16 KB page devices")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *apk == "" {
		return errors.New("usage: check-page-alignment --apk <path>")
	}
	checked, err := checkAPKPageAlignment(*apk)
	if err != nil {
		return err
	}
	fmt.Printf("%d native libraries load on 16 KB page devices\n", checked)
	return nil
}

func checkAPKPageAlignment(path string) (int, error) {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return 0, err
	}
	defer archive.Close()
	var failures []string
	checked := 0
	for _, file := range archive.File {
		if !strings.HasPrefix(file.Name, "lib/") || !strings.HasSuffix(file.Name, ".so") {
			continue
		}
		data, err := readZipEntry(file)
		if err != nil {
			return checked, fmt.Errorf("reading %s: %w", file.Name, err)
		}
		if err := checkLibraryPageAlignment(data); err != nil {
			failures = append(failures, file.Name+": "+err.Error())
		}
		checked++
	}
	if len(failures) > 0 {
		return checked, fmt.Errorf("native libraries that fail to load on 16 KB page devices:\n%s", strings.Join(failures, "\n"))
	}
	if checked == 0 {
		return 0, fmt.Errorf("%s has no native libraries", path)
	}
	return checked, nil
}

func checkLibraryPageAlignment(data []byte) error {
	object, err := elf.NewFile(bytes.NewReader(data))
	if err != nil {
		return err
	}
	if object.Class != elf.ELFCLASS64 {
		return nil
	}
	for _, program := range object.Progs {
		if program.Type == elf.PT_LOAD && program.Align < androidPageSize {
			return fmt.Errorf("LOAD segment at 0x%x is aligned to 0x%x, needs 0x%x", program.Off, program.Align, androidPageSize)
		}
	}
	return nil
}
