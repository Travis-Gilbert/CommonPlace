//! TheoremWeb theme constants and the single CSS-variable bridge.
//!
//! The vendored theme values are adapted from `twenty-ui` at commit
//! `9ee817f414db033454d273a0e371d27934a93af3` (Copyright (c) 2023-present
//! Twenty.com, PBC, MIT). The shadcn and data-grid variable names are adapted
//! from `rust-ui/dioxus-ui` at commit
//! `2f87a8d0531d483d5b32df6f89b7979ceb4beb74` (Copyright (c) 2026 Max Wells,
//! MIT). See `apps/theoremweb/LICENSE_LEDGER.md`.

use std::fmt::Write;

pub const TWENTY_UI_COMMIT: &str = "9ee817f414db033454d273a0e371d27934a93af3";
pub const DIOXUS_UI_COMMIT: &str = "2f87a8d0531d483d5b32df6f89b7979ceb4beb74";

const TWENTY_LIGHT_CSS: &str = include_str!("../vendor/twenty-ui-theme-light.css");
const TWENTY_DARK_CSS: &str = include_str!("../vendor/twenty-ui-theme-dark.css");

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ColorScheme {
    #[default]
    Light,
    Dark,
}

impl ColorScheme {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }

    #[must_use]
    pub const fn toggle(self) -> Self {
        match self {
            Self::Light => Self::Dark,
            Self::Dark => Self::Light,
        }
    }

    const fn css(self) -> &'static str {
        match self {
            Self::Light => TWENTY_LIGHT_CSS,
            Self::Dark => TWENTY_DARK_CSS,
        }
    }
}

/// A named group within the complete vendored twenty-ui variable table.
///
/// Marker groups keep the contract vocabulary explicit while retaining the
/// upstream CSS as the one byte-level value source.
pub trait ThemeTokenGroup {
    const SCHEME: ColorScheme;
    const PREFIXES: &'static [&'static str];

    #[must_use]
    fn value(name: &str) -> Option<&'static str> {
        if !Self::PREFIXES.iter().any(|prefix| name.starts_with(prefix)) {
            return None;
        }
        variable_value(Self::SCHEME, name)
    }
}

macro_rules! token_group {
    ($name:ident, $scheme:expr, [$($prefix:expr),+ $(,)?]) => {
        #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
        pub struct $name;

        impl ThemeTokenGroup for $name {
            const SCHEME: ColorScheme = $scheme;
            const PREFIXES: &'static [&'static str] = &[$($prefix),+];
        }
    };
}

token_group!(TagLight, ColorScheme::Light, ["--t-tag-"]);
token_group!(TagDark, ColorScheme::Dark, ["--t-tag-"]);
token_group!(GrayScaleLight, ColorScheme::Light, ["--t-gray-scale-"]);
token_group!(GrayScaleDark, ColorScheme::Dark, ["--t-gray-scale-"]);
token_group!(
    GrayScaleLightAlpha,
    ColorScheme::Light,
    ["--t-color-transparent-gray"]
);
token_group!(
    GrayScaleDarkAlpha,
    ColorScheme::Dark,
    ["--t-color-transparent-gray"]
);
token_group!(MainColorsLight, ColorScheme::Light, ["--t-color-"]);
token_group!(MainColorsDark, ColorScheme::Dark, ["--t-color-"]);
token_group!(SecondaryColorsLight, ColorScheme::Light, ["--t-color-"]);
token_group!(SecondaryColorsDark, ColorScheme::Dark, ["--t-color-"]);
token_group!(
    TransparentColorsLight,
    ColorScheme::Light,
    ["--t-color-transparent-"]
);
token_group!(
    TransparentColorsDark,
    ColorScheme::Dark,
    ["--t-color-transparent-"]
);
token_group!(AccentLight, ColorScheme::Light, ["--t-accent-"]);
token_group!(AccentDark, ColorScheme::Dark, ["--t-accent-"]);
token_group!(BorderCommon, ColorScheme::Light, ["--t-border-radius-"]);
token_group!(BorderLight, ColorScheme::Light, ["--t-border-color-"]);
token_group!(BorderDark, ColorScheme::Dark, ["--t-border-color-"]);
token_group!(BoxShadowLight, ColorScheme::Light, ["--t-box-shadow-"]);
token_group!(BoxShadowDark, ColorScheme::Dark, ["--t-box-shadow-"]);
token_group!(BackgroundLight, ColorScheme::Light, ["--t-background-"]);
token_group!(BackgroundDark, ColorScheme::Dark, ["--t-background-"]);
token_group!(
    FontCommon,
    ColorScheme::Light,
    ["--t-font-size-", "--t-font-weight-", "--t-font-family"]
);
token_group!(FontLight, ColorScheme::Light, ["--t-font-color-"]);
token_group!(FontDark, ColorScheme::Dark, ["--t-font-color-"]);
token_group!(CodeLight, ColorScheme::Light, ["--t-code-"]);
token_group!(CodeDark, ColorScheme::Dark, ["--t-code-"]);
token_group!(Animation, ColorScheme::Light, ["--t-animation-"]);
token_group!(Modal, ColorScheme::Light, ["--t-modal-"]);
token_group!(Text, ColorScheme::Light, ["--t-text-"]);
token_group!(Icon, ColorScheme::Light, ["--t-icon-"]);
token_group!(BlurLight, ColorScheme::Light, ["--t-blur-"]);
token_group!(BlurDark, ColorScheme::Dark, ["--t-blur-"]);
token_group!(SnackBarLight, ColorScheme::Light, ["--t-snack-bar-"]);
token_group!(SnackBarDark, ColorScheme::Dark, ["--t-snack-bar-"]);
token_group!(
    IllustrationIconLight,
    ColorScheme::Light,
    ["--t--illustration-icon-"]
);
token_group!(
    IllustrationIconDark,
    ColorScheme::Dark,
    ["--t--illustration-icon-"]
);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TableMetrics {
    pub row_height_px: u16,
    pub horizontal_cell_margin_px: u16,
    pub horizontal_cell_padding_px: u16,
    pub checkbox_column_width_px: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ThemeCommon {
    pub spacing_multiplicator: u16,
    pub between_siblings_gap_px: u16,
    pub table: TableMetrics,
    pub side_panel_width_px: u16,
    pub clickable_element_background_transition: &'static str,
    pub last_layer_z_index: u32,
}

impl ThemeCommon {
    pub const TWENTY: Self = Self {
        spacing_multiplicator: 4,
        between_siblings_gap_px: 2,
        table: TableMetrics {
            row_height_px: 32,
            horizontal_cell_margin_px: 8,
            horizontal_cell_padding_px: 8,
            checkbox_column_width_px: 32,
        },
        side_panel_width_px: 500,
        clickable_element_background_transition: "background 0.1s ease",
        last_layer_z_index: 2_147_483_647,
    };
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TagHue {
    pub name: &'static str,
    pub text: &'static str,
    pub background: &'static str,
}

impl TagLight {
    #[must_use]
    pub fn hue(name: &'static str) -> Option<TagHue> {
        tag_hue(ColorScheme::Light, name)
    }
}

impl TagDark {
    #[must_use]
    pub fn hue(name: &'static str) -> Option<TagHue> {
        tag_hue(ColorScheme::Dark, name)
    }
}

fn tag_hue(scheme: ColorScheme, name: &'static str) -> Option<TagHue> {
    if !name.bytes().all(|byte| byte.is_ascii_lowercase()) {
        return None;
    }
    let text_name = format!("--t-tag-text-{name}");
    let background_name = format!("--t-tag-background-{name}");
    Some(TagHue {
        name,
        text: variable_value(scheme, &text_name)?,
        background: variable_value(scheme, &background_name)?,
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ColumnSize<'a> {
    pub field_key: &'a str,
    pub width: i32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ThemeError {
    UnsafeFieldKey(String),
    InvalidColumnWidth { field_key: String, width: i32 },
}

impl std::fmt::Display for ThemeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsafeFieldKey(key) => {
                write!(formatter, "field key {key:?} is not CSS-variable safe")
            }
            Self::InvalidColumnWidth { field_key, width } => {
                write!(formatter, "column {field_key:?} has invalid width {width}")
            }
        }
    }
}

impl std::error::Error for ThemeError {}

/// Emit the complete twenty-ui light/dark tables plus the variable namespace
/// consumed by the rust-ui component layer.
///
/// Runtime columns add only values. They never generate selectors or classes.
pub fn emit_chrome_theme_css(columns: &[ColumnSize<'_>]) -> Result<String, ThemeError> {
    let light = TWENTY_LIGHT_CSS.replacen(".light {", ":root, .light {", 1);
    let mut css = String::with_capacity(light.len() + TWENTY_DARK_CSS.len() + 2_048);
    css.push_str(&light);
    css.push('\n');
    css.push_str(TWENTY_DARK_CSS);
    css.push_str(
        r#"
/* TheoremWeb bridge for rust-ui/dioxus-ui shadcn variables. */
:root, .light, .dark {
  --background: var(--t-background-primary);
  --foreground: var(--t-font-color-primary);
  --card: var(--t-background-secondary);
  --card-foreground: var(--t-font-color-primary);
  --popover: var(--t-background-primary);
  --popover-foreground: var(--t-font-color-primary);
  --primary: var(--t-accent-primary);
  --primary-foreground: var(--t-font-color-inverted);
  --secondary: var(--t-background-tertiary);
  --secondary-foreground: var(--t-font-color-primary);
  --muted: var(--t-background-tertiary);
  --muted-foreground: var(--t-font-color-secondary);
  --accent: var(--t-accent-tertiary);
  --accent-foreground: var(--t-font-color-primary);
  --destructive: var(--t-font-color-danger);
  --border: var(--t-border-color-medium);
  --input: var(--t-border-color-medium);
  --ring: var(--t-accent-accent8);
  --radius: var(--t-border-radius-md);
  --record-row-height: 32px;
  --record-cell-padding: var(--t-table-horizontal-cell-padding);
  --header-Select-size: 32;
  --col-Select-size: 32;
}

.theorem-record-row {
  box-sizing: border-box;
  height: var(--record-row-height);
  min-height: var(--record-row-height);
}

.theorem-record-cell {
  box-sizing: border-box;
  padding-inline: var(--record-cell-padding);
}

.theorem-record-select {
  box-sizing: border-box;
  width: calc(var(--col-Select-size) * 1px);
}
"#,
    );

    for column in columns {
        if column.field_key.is_empty()
            || !column
                .field_key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        {
            return Err(ThemeError::UnsafeFieldKey(column.field_key.to_owned()));
        }
        if column.width <= 0 {
            return Err(ThemeError::InvalidColumnWidth {
                field_key: column.field_key.to_owned(),
                width: column.width,
            });
        }
        writeln!(
            css,
            ":root, .light, .dark {{ --header-{}-size: {}; --col-{}-size: {}; }}",
            column.field_key, column.width, column.field_key, column.width
        )
        .expect("writing to String cannot fail");
    }

    Ok(css)
}

#[must_use]
pub fn variable_value(scheme: ColorScheme, name: &str) -> Option<&'static str> {
    let declaration = format!("  {name}:");
    let start = scheme.css().find(&declaration)? + declaration.len();
    let remainder = &scheme.css()[start..];
    let end = remainder.find(";\n")?;
    Some(remainder[..end].trim())
}

#[must_use]
pub fn variable_names(scheme: ColorScheme) -> Vec<&'static str> {
    scheme
        .css()
        .lines()
        .filter_map(|line| {
            let declaration = line.strip_prefix("  --t-")?;
            let (name, _) = declaration.split_once(':')?;
            Some(&line[2..name.len() + 6])
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_group<G: ThemeTokenGroup>() {
        let names = variable_names(G::SCHEME);
        for prefix in G::PREFIXES {
            assert!(
                names.iter().any(|name| name.starts_with(prefix)),
                "missing group prefix {prefix}"
            );
        }
    }

    #[test]
    fn vendored_themes_have_identical_complete_variable_schema() {
        let light = variable_names(ColorScheme::Light);
        let dark = variable_names(ColorScheme::Dark);
        assert_eq!(light.len(), 994);
        assert_eq!(light, dark);
        assert_eq!(
            variable_value(ColorScheme::Light, "--t-name"),
            Some("light")
        );
        assert_eq!(variable_value(ColorScheme::Dark, "--t-name"), Some("dark"));
    }

    #[test]
    fn named_port_groups_resolve_from_the_complete_table() {
        assert_group::<GrayScaleLight>();
        assert_group::<GrayScaleDarkAlpha>();
        assert_group::<MainColorsLight>();
        assert_group::<SecondaryColorsDark>();
        assert_group::<TransparentColorsLight>();
        assert_group::<AccentDark>();
        assert_group::<BorderCommon>();
        assert_group::<BoxShadowLight>();
        assert_group::<BackgroundDark>();
        assert_group::<FontCommon>();
        assert_group::<CodeDark>();
        assert_group::<Animation>();
        assert_group::<Modal>();
        assert_group::<Text>();
        assert_group::<Icon>();
        assert_group::<BlurLight>();
        assert_group::<SnackBarDark>();
        assert_group::<IllustrationIconLight>();
    }

    #[test]
    fn tag_hues_are_exact_theme_values() {
        let light = TagLight::hue("blue").expect("blue exists");
        assert_eq!(light.text, "color(display-p3 0.256 0.354 0.755)");
        assert_eq!(light.background, "color(display-p3 0.933 0.948 0.992)");

        let dark = TagDark::hue("blue").expect("blue exists");
        assert_eq!(dark.text, "color(display-p3 0.63 0.69 1)");
        assert_eq!(dark.background, "color(display-p3 0.105 0.141 0.275)");
        assert!(TagLight::hue("not-a-hue").is_none());
    }

    #[test]
    fn common_density_matches_the_records_contract() {
        let common = ThemeCommon::TWENTY;
        assert_eq!(common.spacing_multiplicator, 4);
        assert_eq!(common.between_siblings_gap_px, 2);
        assert_eq!(common.table.row_height_px, 32);
        assert_eq!(common.table.horizontal_cell_margin_px, 8);
        assert_eq!(common.table.horizontal_cell_padding_px, 8);
        assert_eq!(common.table.checkbox_column_width_px, 32);
        assert_eq!(common.side_panel_width_px, 500);
        assert_eq!(common.last_layer_z_index, 2_147_483_647);
    }

    #[test]
    fn emitter_is_the_single_shadcn_and_runtime_column_bridge() {
        let css = emit_chrome_theme_css(&[ColumnSize {
            field_key: "annual_revenue",
            width: 180,
        }])
        .expect("safe column");
        assert!(css.contains(":root, .light {"));
        assert!(css.contains("--background: var(--t-background-primary)"));
        assert!(css.contains("--record-row-height: 32px"));
        assert!(css.contains("--header-Select-size: 32"));
        assert!(css.contains("--col-annual_revenue-size: 180"));
        assert_eq!(
            css,
            emit_chrome_theme_css(&[ColumnSize {
                field_key: "annual_revenue",
                width: 180,
            }])
            .expect("stable output")
        );
    }

    #[test]
    fn runtime_column_names_and_widths_fail_closed() {
        assert!(matches!(
            emit_chrome_theme_css(&[ColumnSize {
                field_key: "name; color: red",
                width: 120,
            }]),
            Err(ThemeError::UnsafeFieldKey(_))
        ));
        assert!(matches!(
            emit_chrome_theme_css(&[ColumnSize {
                field_key: "name",
                width: 0,
            }]),
            Err(ThemeError::InvalidColumnWidth { .. })
        ));
    }
}
