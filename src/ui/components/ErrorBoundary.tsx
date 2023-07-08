import { ClientName } from "@constants";
import { React, ReactNative as RN } from "@metro/common";
import { findByProps } from "@metro";

import { getIDByName } from "@api/assets";
import { useSettingsStore } from "@api/storage";
import { BundleManager } from "@api/native";

import styles from "./ErrorBoundary.styles";
import CodeBlock from "./CodeBlock";

const RedesignComponents = findByProps("SegmentedControl", "Stack", { lazy: true });
const Clipboard = findByProps("setString", "getString", { lazy: true });

interface ErrorBoundaryProps {
    error: Record<string, any>;
    retryRender: () => void;
    res: any;
};

interface CardProps { 
    style?: Record<string, any>, 
    children: any 
};

const Card = ({ style, ...props }: CardProps) => (
    <RN.View
        style={[styles.card, style]} 
        {...props} 
    />
)

const Header = ({ res }: Pick<ErrorBoundaryProps, "res">) => {
    return <Card>
        <RN.View style={{ flexDirection: "column" }}>
            <RN.Text style={styles.headerTitle}>
                {res.props?.title?.replace("Discord", ClientName)}
            </RN.Text>
            <RN.Text style={styles.headerBody}>
                {res.props.body}
            </RN.Text>
        </RN.View>

        <RN.Image 
            source={{ uri: "https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png" }}
            style={[styles.headerChainIcon, {
                transform: [
                    { rotateZ: "20deg" },
                    { scale: 1.4 }
                ],
                opacity: 0.3,
                overlayColor: "#00000055"
            }]}
            blurRadius={6}
        />
        <RN.Image 
            source={{ uri: "https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png" }}
            style={styles.headerChainIcon}
        />
    </Card>
}

const Outline = ({ state, error }) => {
    let loadingTimeout;
    const [loading, setLoading] = React.useState(false);

    return <Card>
        <RN.Text style={styles.outlineTitle}>
            Here's a detailed outline of what happened:
        </RN.Text>
        <RedesignComponents.SegmentedControlPages state={state} />
        <RN.View style={{
            position: "absolute",
            bottom: 20,
            right: 20
        }}>
            <RedesignComponents.IconButton 
                icon={getIDByName("ic_message_copy")}
                variant={"primary"}
                size={"md"}
                loading={loading}
                onPress={() => {
                    clearTimeout(loadingTimeout);

                    setLoading(previous => !previous);
                    loadingTimeout = setTimeout(() => setLoading(previous => !previous), 800)

                    Clipboard.setString(error);
                }}
            />
        </RN.View>
    </Card>
}

const Actions = ({ retryRender, state }: Pick<ErrorBoundaryProps, "retryRender"> & { state: any }) => {
    const [loading, setLoading] = React.useState(false);
    const settings = useSettingsStore('unbound');

    return <Card>
        <RN.View style={{ margin: 10 }}>
            <RedesignComponents.SegmentedControl state={state} />
            <RN.View style={{ marginTop: 10, flexDirection: "row" }}>
                <RN.View style={{ flexGrow: 1, marginRight: 10 }}>
                    <RedesignComponents.Button 
                        onPress={retryRender}
                        variant={"danger"}
                        size={"md"}
                        icon={getIDByName("ic_message_retry")}
                        iconPosition={"start"}
                        text={"Retry Render"}
                    />
                </RN.View>
                <RedesignComponents.IconButton 
                    icon={getIDByName("ic_shield_24px")}
                    variant={"positive"}
                    size={"md"}
                    loading={loading}
                    onPress={() => {
                        settings.set("recovery", true);
                        
                        setLoading(previous => !previous);
                        setTimeout(BundleManager.reload, 400);
                    }}
                />
            </RN.View>
        </RN.View>
    </Card>
} 

export default ({ error, retryRender, res }: ErrorBoundaryProps) => {
    const possibleErrors = {
        "Component": error.name + error.componentStack,
        "Stack Trace": error.stack.replace(/(at .*) \(.*\)/g, "$1")
    };

    const [index, setIndex] = React.useState(0);
    const state = RedesignComponents.useSegmentedControlState({
        defaultIndex: 0,
        items: Object.entries(possibleErrors).map(([label, error]) => {
            return {
                label,
                id: label.toLowerCase(),
                page: <CodeBlock selectable style={styles.outlineCodeblock}>
                    {error}
                </CodeBlock>
            }
        }),
        pageWidth: ReactNative.Dimensions.get("window").width - 40,
        onPageChange: setIndex
    });
    
    return <RN.SafeAreaView style={styles.container}>
        <RN.ScrollView>
            <Header res={res} />
            <Outline 
                state={state}
                error={possibleErrors[Object.keys(possibleErrors)[index]]}
            />
            <Actions 
                retryRender={retryRender}
                state={state}
            />
        </RN.ScrollView>
    </RN.SafeAreaView>
}