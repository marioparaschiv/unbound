ARCHS := arm64
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

SUBPROJECT_NAME = LiveActivities
LiveActivities_FILES = LiveActivities.swift
LiveActivities_SWIFTFLAGS = -Xfrontend -disable-autolink-framework -Xfrontend ActivityKit

include $(THEOS_MAKE_PATH)/subproject.mk
