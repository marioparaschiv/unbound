package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestNativeTypeEncodingsOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-type-encoding-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeTypeEncoding.cpp"), filepath.Join(root, "core", "tests", "native_type_encoding.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native type test compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native type test failed for variant %d: %v\n%s", index, err, output)
		}
	}
}

func TestNativeNumericValidationOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-numeric-validation-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeNumericValidation.cpp"), filepath.Join(root, "core", "tests", "native_numeric_validation.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native numeric test compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native numeric test failed for variant %d: %v\n%s", index, err, output)
		}
	}
}

func TestNativeAddressValidationOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-address-validation-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeAddressValidation.cpp"), filepath.Join(root, "core", "tests", "native_address_validation.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native address test compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native address test failed for variant %d: %v\n%s", index, err, output)
		}
	}
}

func TestNativeBundleTransactionOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-bundle-transaction-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeBundleTransaction.cpp"), filepath.Join(root, "core", "tests", "native_bundle_transaction.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native bundle transaction compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native bundle transaction failed for variant %d: %v\n%s", index, err, output)
		}
	}
}

func TestNativeConversionBudgetOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-conversion-budget-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeConversionBudget.cpp"), filepath.Join(root, "core", "tests", "native_conversion_budget.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native conversion budget compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native conversion budget failed for variant %d: %v\n%s", index, err, output)
		}
	}
}

func TestNativeOperationGateOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "native-operation-gate-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+filepath.Join(root, "core", "include"), filepath.Join(root, "core", "src", "NativeOperationGate.cpp"), filepath.Join(root, "core", "tests", "native_operation_gate.cpp"), "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("native operation gate compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("native operation gate failed for variant %d: %v\n%s", index, err, output)
		}
	}
}
