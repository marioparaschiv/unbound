#pragma once

#include <optional>
#include <string_view>

namespace loader::native {
enum class AssociationPolicy
{
    Assign,
    Retain,
    Copy,
    CopyNonatomic,
    RetainNonatomic,
};

constexpr AssociationPolicy kDefaultAssociationPolicy = AssociationPolicy::RetainNonatomic;

std::optional<AssociationPolicy> associationPolicyNamed(std::string_view name);
}
