#pragma once

#include <nlohmann/json.hpp>
#include <string>
#include <vector>

#include "LoaderSettings.h"

namespace loader::devoverlay {
enum class FollowUp
{
    None,
    ReloadApp,
    EditSettings,
    OpenToolbox,
};

struct MenuItem {
    std::string id;
    std::string title;
    FollowUp    followUp = FollowUp::None;
};

struct Menu {
    std::string           title;
    std::string           cancel;
    std::vector<MenuItem> items;
};

struct SettingsEditResult {
    bool        saved = false;
    std::string error;
};

struct Point {
    double x = 0;
    double y = 0;
};

struct Size {
    double width  = 0;
    double height = 0;
};

struct Frame {
    double x      = 0;
    double y      = 0;
    double width  = 0;
    double height = 0;
};

struct Insets {
    double top    = 0;
    double left   = 0;
    double bottom = 0;
    double right  = 0;
};

constexpr const char *kMenuTitle                  = "Developer";
constexpr const char *kCancelText                 = "Cancel";
constexpr const char *kSettingsEditorTitle        = "Edit Settings JSON";
constexpr const char *kSaveText                   = "Save";
constexpr const char *kInvalidSettingsMessage     = "The settings must be a valid JSON object.";
constexpr const char *kSettingsWriteFailedMessage = "The settings could not be saved.";
constexpr double      kButtonSide                 = 44;
constexpr double      kButtonMargin               = 8;
constexpr Point       kDefaultPosition{1, 0.8};

const char        *followUpName(FollowUp followUp);
Menu               menu(const SettingsStore &settings);
nlohmann::json     menuJSON(const SettingsStore &settings);
SettingsEditResult saveSettings(SettingsStore &settings, const std::string &json);
nlohmann::json     editResultJSON(const SettingsEditResult &result);

Point position(const SettingsStore &settings);
Point clampCenter(Point center, Size bounds, Insets insets);
Point buttonCenter(const SettingsStore &settings, Size bounds, Insets insets);
bool  saveButtonCenter(SettingsStore &settings, Point center, Size bounds);
Frame buttonFrame(Point center);
Frame collapsedWindowFrame(Point center, Frame screen);
}
