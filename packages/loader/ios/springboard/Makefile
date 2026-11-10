THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

# Loads only into SpringBoard and runs only when an app is opened: it sends unbound:// straight to
# Discord so the hidden UnboundLink.app never shows.
TWEAK_NAME = UnboundSpringBoard
UnboundSpringBoard_FILES = $(wildcard sources/*.x)
UnboundSpringBoard_CFLAGS = -fobjc-arc

include $(THEOS_MAKE_PATH)/tweak.mk
