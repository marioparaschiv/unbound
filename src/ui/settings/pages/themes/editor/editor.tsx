// TO-DO: Add all of these strings to I18N
import { React, ReactNative, Theme } from "@metro/common";
import { StaticSection, ToggleableSection, styles } from "./index";
import { findByName, findByProps } from "@metro";
import { Button, Forms, Slider } from "@metro/components";
import { Theme as ThemeStore } from '@metro/stores';
import { unprocessColor } from "@utilities";
import { Icons } from "@api/assets";
import Themes from "@managers/themes";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet", { lazy: true });
const CustomColorPickerActionSheet = findByName("CustomColorPickerActionSheet");
const splash = Icons["header-art"];

const ColorPickerRow = ({ trailing = null, onSelect = (color: string) => {}, defaultColor, ...props}) => {
    const [color, setColor] = React.useState(defaultColor);

    return <Forms.FormRow
        {...props}
        trailing={
            <ReactNative.View style={{
                flexDirection: "row",
                alignItems: 'center'
            }}>
                {trailing}
                <ReactNative.View style={[
                    styles.preview,
                    { backgroundColor: color }
                ]} />
                <Forms.FormRow.Arrow />
            </ReactNative.View>
        }
        onPress={() => (LazyActionSheet.openLazy(
            new Promise(r => r({ default: CustomColorPickerActionSheet })), 
            `unbound-colorpicker-${props.label ?? ""}`, {
                color: ReactNative.processColor(color), 
                onSelect: (colorValue: number) => {
                    setColor(unprocessColor(colorValue));
                    onSelect(unprocessColor(colorValue));
                    LazyActionSheet.hideActionSheet();
                }
            }
        ), console.log(color, defaultColor))}
    />
}

const Label = ({ text }) => (
    <Forms.FormLabel 
        text={text}
        color={"text-normal"}
        style={{ marginHorizontal: 24 }}
    />
);

const SpecialSlider = ({ title, value, onValueChange, minimum, maximum, step }) => {
    return <ReactNative.View>
        <ReactNative.Text style={styles.subheader}>{title}</ReactNative.Text>
        <ReactNative.View 
            style={{ 
                alignItems: "center", 
                flexDirection: "row" 
            }}
        >
            <Label text={minimum} />
            <Slider
                value={value}
                minimumValue={minimum}
                maximumValue={maximum}
                style={{ flex: 1 }}
                minimumTrackTintColor={Theme.meta.resolveSemanticColor(ThemeStore.theme, Theme.colors.HEADER_PRIMARY)}
                maximumTrackTintColor={Theme.meta.resolveSemanticColor(ThemeStore.theme, Theme.colors.BACKGROUND_PRIMARY)}
                step={step}
                onValueChange={(value: number) => onValueChange(Math.round(value * 10) / 10)}
                tapToSeek
            />
            <Label text={maximum} />
        </ReactNative.View>
    </ReactNative.View>
}

export default ({ manifest, bundle }) => {
    const { semantic, raw, background = { url: "", blur: 0, opacity: 0 } } = bundle;
    const [backgroundValues, setBackgroundValues] = React.useState(background);

    return <ReactNative.ScrollView>
        <StaticSection style={{ marginBottom: 0 }}>
            <ReactNative.Image source={splash} />
            <ReactNative.Text style={[styles.header, { fontSize: 20 }]}>Editing {manifest.name} ({manifest.id})</ReactNative.Text>
            <ReactNative.Text style={styles.subheader}>{manifest.description}</ReactNative.Text>
            <Button 
                text={"Save"}
                onPress={() => {
                    Themes.save(JSON.stringify(bundle, null, 2), manifest);
                    Themes.load(JSON.stringify(bundle, null, 2), manifest);
                }}
            />
        </StaticSection>
        <ToggleableSection title={"Semantic"}>
            {Object.keys(Theme.colors).map(key => {
                return <ColorPickerRow 
                    label={key} 
                    defaultColor={semantic[key]?.[{ dark: 0, light: 1, amoled: 2 }[ThemeStore.theme]]
                        ?? Theme.meta.resolveSemanticColor(ThemeStore.theme, Theme.colors[key])
                        ?? "#000000"}
                    onSelect={(color) => (semantic[key] ??= [], semantic[key][{ dark: 0, light: 1, amoled: 2 }[ThemeStore.theme]] = color)}
                />
            })}
        </ToggleableSection>
        <ToggleableSection title={"Raw"}>
            {Object.keys(Theme.unsafe_rawColors).map(key => {
                return <ColorPickerRow 
                    label={key} 
                    defaultColor={raw[key] 
                        ?? Theme.unsafe_rawColors?.[key]
                        ?? "#000000"}
                    onSelect={(color) => raw[key] = color}
                />
            })}
        </ToggleableSection>
        <ToggleableSection 
            title={"Background"} 
            style={{ marginBottom: 50 }}
        >
            <ReactNative.View style={{ flex: 1 }}>
                <Forms.FormInput 
                    title={"URL"}
                    placeholder={"https://example.com/image.png"}
                    value={backgroundValues.url}
                    onChange={(value: string) => setBackgroundValues(prev => ({ ...prev, url: value }))}
                    showBorder
                />
                <SpecialSlider
                    title={`Opacity - ${backgroundValues.opacity}`}
                    minimum={0}
                    maximum={1}
                    step={0.1}
                    value={backgroundValues.opacity}
                    onValueChange={(value: number) => setBackgroundValues(prev => ({ ...prev, opacity: value }))}
                />
                <SpecialSlider 
                    title={`Blur - ${backgroundValues.blur}`}
                    minimum={0}
                    maximum={1}
                    step={0.1}
                    value={backgroundValues.blur}
                    onValueChange={(value: number) => setBackgroundValues(prev => ({ ...prev, blur: value }))}
                />
            </ReactNative.View>
        </ToggleableSection>
    </ReactNative.ScrollView>;
}