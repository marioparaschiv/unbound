#include "LoaderDynamicIsland.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <string_view>

namespace loader::dynamicisland {
namespace {
    constexpr int    kColumns        = 16;
    constexpr int    kRows           = 12;
    constexpr double kCellX          = 39.6;
    constexpr double kCellY          = 60.83;
    constexpr double kColumnStep     = (205.57 - kCellX) / (kColumns - 1);
    constexpr double kRowStep        = (182.54 - kCellY) / (kRows - 1);
    constexpr double kCellSize       = 10.03;
    constexpr double kEdgeWidth      = 2.6;
    constexpr double kShadowOffset   = 6.0;
    constexpr double kScanlinePeriod = 4.0;
    constexpr double kScanlineHeight = 1.6;

    using Grid = std::array<std::string_view, kRows>;

    constexpr Grid kCells = {
        "....##....##....", "..###########...", "..############..", ".#############..",
        ".##############.", "####..####..####", "####...##...####", "####...##...####",
        "################", "################", "####.######.####", "..###......###..",
    };

    constexpr Grid kRedEdges = {
        "....#.....#.....", "..#.............", "..#.............", ".#..............",
        ".#..............", "#.....#.....#...", "#......#....#...", "#......#....#...",
        "#...............", "#...............", "#....#......#...", "..#........#....",
    };

    constexpr Grid kCyanEdges = {
        ".....#.....#....", "............#...", ".............#..", ".............#..",
        "..............#.", "...#.....#.....#", "...#....#......#", "...#....#......#",
        "...............#", "...............#", "...#......#....#", "....#........#..",
    };

    constexpr std::array<Frame, 2> kSparkles = {{
        {192.82, 64.84, 8.73, 8.73},
        {209.66, 82.63, 7.93, 7.93},
    }};

    Frame cellFrame(int row, int column)
    {
        return {kCellX + column * kColumnStep, kCellY + row * kRowStep, kCellSize, kCellSize};
    }

    template <typename Visit> void forEachMarked(const Grid &grid, Visit visit)
    {
        for (int row = 0; row < kRows; row++)
        {
            for (int column = 0; column < kColumns; column++)
            {
                if (grid[row][column] == '#')
                {
                    visit(cellFrame(row, column));
                }
            }
        }
    }

    std::vector<Frame> whiteBlocks()
    {
        std::vector<Frame> blocks;
        forEachMarked(kCells, [&](const Frame &cell) {
            blocks.push_back(cell);
        });
        blocks.insert(blocks.end(), kSparkles.begin(), kSparkles.end());
        return blocks;
    }

    void addScanlines(const Frame &block, std::vector<Pixel> &pixels)
    {
        const double bottom = block.y + block.height;
        for (double band = std::floor(block.y / kScanlinePeriod) * kScanlinePeriod; band < bottom;
             band += kScanlinePeriod)
        {
            const double top    = std::max(band, block.y);
            const double height = std::min(band + kScanlineHeight, bottom) - top;
            if (height > 0)
            {
                pixels.push_back({Ink::Scanline, {block.x, top, block.width, height}});
            }
        }
    }
}

std::optional<Cutout> cutoutFromSystem(std::optional<Frame> rect)
{
    if (!rect || rect->width <= 0 || rect->height <= 0 || rect->width <= rect->height)
    {
        return std::nullopt;
    }
    const CutoutKind kind = rect->y > 0 ? CutoutKind::Island : CutoutKind::Notch;
    return Cutout{kind, *rect};
}

double cornerRadius(const Cutout &cutout)
{
    const double height = cutout.frame.height;
    return cutout.kind == CutoutKind::Island ? height / 2 : height * kNotchCornerRatio;
}

Frame logoFrame(const Frame &cutout)
{
    const double height = cutout.height * kLogoHeightRatio;
    const double width  = std::min(height * kLogoAspect, cutout.width);
    const double fitted = width / kLogoAspect;
    return {(cutout.width - width) / 2, (cutout.height - fitted) / 2, width, fitted};
}

std::vector<Pixel> logoPixels()
{
    const std::vector<Frame> blocks = whiteBlocks();
    std::vector<Pixel>       pixels;

    for (const Frame &block : blocks)
    {
        pixels.push_back(
            {Ink::Shadow,
             {block.x + kShadowOffset, block.y + kShadowOffset, block.width, block.height}});
    }
    forEachMarked(kRedEdges, [&](const Frame &cell) {
        pixels.push_back({Ink::Red, {cell.x - kEdgeWidth, cell.y, kEdgeWidth, cell.height}});
    });
    for (const Frame &sparkle : kSparkles)
    {
        pixels.push_back(
            {Ink::Red, {sparkle.x - kEdgeWidth, sparkle.y, kEdgeWidth, sparkle.height}});
    }
    forEachMarked(kCyanEdges, [&](const Frame &cell) {
        pixels.push_back({Ink::Cyan, {cell.x + cell.width, cell.y, kEdgeWidth, cell.height}});
    });
    for (const Frame &sparkle : kSparkles)
    {
        pixels.push_back(
            {Ink::Cyan, {sparkle.x + sparkle.width, sparkle.y, kEdgeWidth, sparkle.height}});
    }
    for (const Frame &block : blocks)
    {
        pixels.push_back({Ink::White, block});
    }
    for (const Frame &block : blocks)
    {
        addScanlines(block, pixels);
    }
    return pixels;
}

Start Presentation::start(bool hasCutout)
{
    if (!hasCutout)
    {
        return Start::NoIsland;
    }
    if (started_)
    {
        return Start::AlreadyStarted;
    }
    started_ = true;
    return Start::Started;
}

Plan Presentation::show(const ViewState &view) const
{
    if (!view.exists)
    {
        return {true, true, false};
    }
    if (!view.hidden && view.alpha >= 1.0)
    {
        return {};
    }
    return {false, true, false};
}

Plan Presentation::hide(const ViewState &view) const
{
    if (!view.exists || view.hidden)
    {
        return {};
    }
    return {false, false, true};
}

Plan Presentation::on(Lifecycle event, const ViewState &view) const
{
    return event == Lifecycle::BecameActive ? show(view) : hide(view);
}
}
