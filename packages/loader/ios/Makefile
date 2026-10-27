THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1
INSTALL_TARGET_PROCESSES = Discord

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0
COMMIT_HASH := $(shell git rev-parse HEAD)
COMMIT_SHORT_HASH := $(shell git rev-parse --short HEAD)
# Strip quotes/backslashes so they can't break the -DCOMMIT_SUBJECT='@"..."' flag.
COMMIT_SUBJECT := $(shell git log -1 --pretty=format:%s | LC_ALL=C tr -cd 'A-Za-z0-9 ._:-')
COMMIT_BRANCH := $(shell git branch --show-current 2>/dev/null || echo detached)
BUILD_TIMESTAMP := $(shell date "+%Y-%m-%d %H:%M:%S %Z")

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = Unbound
REPO_ROOT := $(abspath $(THEOS_PROJECT_DIR)/..)
CORE_DIR := $(REPO_ROOT)/core
VENDOR_DIR := $(REPO_ROOT)/vendor
RESOURCES_DIR := $(REPO_ROOT)/bootstrap
ATTESTATION_ENABLED := $(if $(filter 1,$(DEBUG)),0,1)
BUNDLE_SIGNING_KEY_FILE ?= $(CORE_DIR)/keys/bundle-signing.pub
BUNDLE_SIGNING_KEY := $(shell cat "$(BUNDLE_SIGNING_KEY_FILE)" 2>/dev/null | LC_ALL=C tr -cd 'A-Za-z0-9+/=')
$(if $(filter 0,$(MAKELEVEL)),$(if $(BUNDLE_SIGNING_KEY),$(info Bundle signature verification: on, key from $(BUNDLE_SIGNING_KEY_FILE)),$(info Bundle signature verification: off, $(BUNDLE_SIGNING_KEY_FILE) does not exist)))
UNBOUND_PR_NUMBER ?=
PR_BUNDLE_SIGNING_KEY_FILE ?= $(CORE_DIR)/keys/pr-bundle-signing.pub
PR_NUMBER := $(if $(strip $(UNBOUND_PR_NUMBER)),$(strip $(UNBOUND_PR_NUMBER)),0)
PR_NUMBER_NON_DIGITS := $(subst 0,,$(subst 1,,$(subst 2,,$(subst 3,,$(subst 4,,$(subst 5,,$(subst 6,,$(subst 7,,$(subst 8,,$(subst 9,,$(PR_NUMBER)))))))))))
$(if $(or $(PR_NUMBER_NON_DIGITS),$(filter-out 1,$(words $(PR_NUMBER))),$(filter-out 0,$(filter 0%,$(PR_NUMBER)))),$(error UNBOUND_PR_NUMBER must be a pull request number, not "$(UNBOUND_PR_NUMBER)"))
PR_BUNDLE_SIGNING_KEY := $(if $(filter-out 0,$(PR_NUMBER)),$(shell cat "$(PR_BUNDLE_SIGNING_KEY_FILE)" 2>/dev/null | LC_ALL=C tr -cd 'A-Za-z0-9+/='))
$(if $(filter-out 0,$(PR_NUMBER)),$(if $(PR_BUNDLE_SIGNING_KEY),$(if $(filter 0,$(MAKELEVEL)),$(info Pull request build #$(PR_NUMBER): also trusts $(PR_BUNDLE_SIGNING_KEY_FILE))),$(error A pull request build needs $(PR_BUNDLE_SIGNING_KEY_FILE))))
COMMON_FLAGS = -fobjc-arc -DATTESTATION_ENABLED=$(ATTESTATION_ENABLED) -DUNBOUND_VERSION='"$(THEOS_PACKAGE_BASE_VERSION)"' -DUNBOUND_BUNDLE_SIGNING_KEY='"$(BUNDLE_SIGNING_KEY)"' -DUNBOUND_PR_NUMBER=$(PR_NUMBER) -DUNBOUND_PR_BUNDLE_SIGNING_KEY='"$(PR_BUNDLE_SIGNING_KEY)"' -DCOMMIT_HASH='@"$(COMMIT_HASH)"' -DCOMMIT_SHORT_HASH='@"$(COMMIT_SHORT_HASH)"' -DCOMMIT_SUBJECT='@"$(COMMIT_SUBJECT)"' -DCOMMIT_BRANCH='@"$(COMMIT_BRANCH)"' -DBUILD_TIMESTAMP='@"$(BUILD_TIMESTAMP)"' -I$(THEOS_PROJECT_DIR)/headers -I$(CORE_DIR)/include -I$(VENDOR_DIR) -I$(VENDOR_DIR)/react
LIBFFI_OUTPUT := $(THEOS_PROJECT_DIR)/.theos/libffi
LIBFFI_ARCHIVE := $(LIBFFI_OUTPUT)/libffi.a
LIBFFI_HEADERS := $(LIBFFI_OUTPUT)/include

$(TWEAK_NAME)_FILES = $(shell find sources -name "*.x*" -o -name "*.m*") $(wildcard ../core/src/*.cpp) $(wildcard ../core/src/ffi/*.cpp) $(wildcard ../vendor/monocypher/*.c)
$(TWEAK_NAME)_CFLAGS = $(COMMON_FLAGS)
# _CCFLAGS (not _CXXFLAGS) is what Theos applies to C++/Objective-C++ compiles.
$(TWEAK_NAME)_CCFLAGS = $(COMMON_FLAGS) -I$(LIBFFI_HEADERS) -std=c++20 -fno-cxx-modules
# Resolve JSI/TurboModule symbols from Discord's React dylib at load time.
$(TWEAK_NAME)_LDFLAGS = -undefined dynamic_lookup $(LIBFFI_ARCHIVE)
$(TWEAK_NAME)_FRAMEWORKS = UIKit Foundation AuthenticationServices UniformTypeIdentifiers Security SafariServices AVFoundation CoreHaptics

BUNDLE_NAME = UnboundResources
$(BUNDLE_NAME)_INSTALL_PATH = "/Library/Application\ Support/"
$(BUNDLE_NAME)_RESOURCE_DIRS = "$(RESOURCES_DIR)"

include $(THEOS_MAKE_PATH)/tweak.mk
include $(THEOS_MAKE_PATH)/bundle.mk

SHELL := /bin/bash
TOOLS ?= $(TOOLS_COMMAND)
ifeq ($(strip $(TOOLS)),)
TOOLS := go -C "$(REPO_ROOT)" run ./tools
endif

before-all::
	@$(MAKE) clean

	@$(TOOLS) libffi-build --root "$(REPO_ROOT)" --archive "$(LIBFFI_ARCHIVE)" --include "$(LIBFFI_HEADERS)"

after-stage::
	$(TOOLS) attest stage --staging-dir "$(THEOS_STAGING_DIR)" --commit-hash "$(COMMIT_HASH)" --package-version "$(THEOS_PACKAGE_BASE_VERSION)"

after-package::
