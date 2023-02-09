declare type React = typeof import('react');

export namespace Components {
  export type Forms = {
    AutoCapitalizeModes: {
      NONE: 'none',
      SENTENCES: 'sentences',
      WORDS: 'words',
      CHARACTERS: 'characters';
    },
    Form: React.ComponentType<AnyProps>,
    FormArrow: React.ComponentType<AnyProps>,
    FormCTA: React.ComponentType<AnyProps>,
    FormCTAButton: React.ComponentType<AnyProps>,
    FormCardSection: React.ComponentType<AnyProps>,
    FormCheckbox: React.ComponentType<AnyProps>,
    FormCheckboxRow: React.ComponentType<AnyProps>,
    FormCheckmark: React.ComponentType<AnyProps>,
    FormDivider: React.ComponentType<AnyProps>,
    FormHint: React.ComponentType<AnyProps>,
    FormIcon: React.ComponentType<AnyProps>,
    FormInput: React.ComponentType<AnyProps>,
    FormLabel: React.ComponentType<AnyProps>,
    FormRadio: React.ComponentType<AnyProps>,
    FormRadioRow: React.ComponentType<AnyProps>,
    FormRow: React.ComponentType<AnyProps> & {
      Arrow: React.ComponentType<AnyProps>;
      Icon: React.ComponentType<AnyProps>;
    },
    FormSection: React.ComponentType<AnyProps>,
    FormSelect: React.ComponentType<AnyProps>,
    FormSubLabel: React.ComponentType<AnyProps>,
    FormSwitch: React.ComponentType<AnyProps>,
    FormSwitchRow: React.ComponentType<AnyProps>,
    FormTernaryCheckBox: React.ComponentType<AnyProps>,
    FormText: React.ComponentType<AnyProps>,
    FormTextColors: {
      BRAND: { color: '#5865f2'; },
      RED: { color: '#ed4245'; },
      GREEN: { color: '#3ba55c'; },
      YELLOW: { color: '#faa61a'; },
      LINK: { color: '#00b0f4'; },
      WHITE: { color: '#ffffff'; };
    },
    FormTextSizes: {
      SMALL: { fontSize: 12, lineHeight: 16; },
      MEDIUM: { fontSize: 16, lineHeight: 22; };
    },
    FormTitle: React.ComponentType<AnyProps>,
    KeyboardTypes: {
      DEFAULT: 'default',
      NUMERIC: 'numeric',
      EMAIL: 'email-address',
      PHONE: 'phone-pad';
    },
    TernaryCheckBoxStates: {
      DENY: 'DENY',
      PASSTHROUGH: 'PASSTHROUGH',
      ALLOW: 'ALLOW';
    };
  };

  export type SVG = React.ComponentType<AnyProps> & {
    Circle: React.ComponentType<AnyProps>;
    ClipPath: React.ComponentType<AnyProps>;
    Defs: React.ComponentType<AnyProps>;
    Ellipse: React.ComponentType<AnyProps>;
    ForeignObject: React.ComponentType<AnyProps>;
    G: React.ComponentType<AnyProps>;
    Image: React.ComponentType<AnyProps>;
    Line: React.ComponentType<AnyProps>;
    LinearGradient: React.ComponentType<AnyProps>;
    LocalSvg: React.ComponentType<AnyProps>;
    Marker: React.ComponentType<AnyProps>;
    Mask: React.ComponentType<AnyProps>;
    Path: React.ComponentType<AnyProps>;
    Pattern: React.ComponentType<AnyProps>;
    Polygon: React.ComponentType<AnyProps>;
    Polyline: React.ComponentType<AnyProps>;
    RNSVGCircle: string;
    RNSVGClipPath: string;
    RNSVGDefs: string;
    RNSVGEllipse: string;
    RNSVGForeignObject: string;
    RNSVGGroup: string;
    RNSVGImage: string;
    RNSVGLine: string;
    RNSVGLinearGradient: string;
    RNSVGMarker: string;
    RNSVGMask: string;
    RNSVGPath: string;
    RNSVGPattern: string;
    RNSVGRadialGradient: string;
    RNSVGRect: string;
    RNSVGSvg: string;
    RNSVGSymbol: string;
    RNSVGTSpan: string;
    RNSVGText: string;
    RNSVGTextPath: string;
    RNSVGUse: string;
    RadialGradient: React.ComponentType<AnyProps>;
    Rect: React.ComponentType<AnyProps>;
    Shape: React.ComponentType<AnyProps>;
    Stop: React.ComponentType<AnyProps>;
    Svg: React.ComponentType<AnyProps>;
    SvgAst: React.ComponentType<AnyProps>;
    SvgCss: React.ComponentType<AnyProps>;
    SvgCssUri: React.ComponentType<AnyProps>;
    SvgFromUri: React.ComponentType<AnyProps>;
    SvgFromXml: React.ComponentType<AnyProps>;
    SvgUri: React.ComponentType<AnyProps>;
    SvgWithCss: React.ComponentType<AnyProps>;
    SvgWithCssUri: React.ComponentType<AnyProps>;
    SvgXml: React.ComponentType<AnyProps>;
    Symbol: React.ComponentType<AnyProps>;
    TSpan: React.ComponentType<AnyProps>;
    Text: React.ComponentType<AnyProps>;
    TextPath: React.ComponentType<AnyProps>;
    Use: React.ComponentType<AnyProps>;
    WithLocalSvg: React.ComponentType<AnyProps>;
    default: React.ComponentType<AnyProps>;
    inlineStyles: React.ComponentType<AnyProps>;
    loadLocalRawResource: React.ComponentType<AnyProps>;
    parse: React.ComponentType<AnyProps>;
  };
}