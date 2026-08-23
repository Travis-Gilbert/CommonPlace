use serde_json::Value;
use theoremweb_chrome::{ColorScheme, TagDark, TagHue, TagLight};

use crate::schema::{FieldKind, FieldSpec, ObjectType};

const TAG_HUES: &[&str] = &[
    "amber",
    "blue",
    "bronze",
    "brown",
    "crimson",
    "cyan",
    "gold",
    "grass",
    "gray",
    "green",
    "iris",
    "jade",
    "lime",
    "mauve",
    "mint",
    "olive",
    "orange",
    "pink",
    "plum",
    "purple",
    "red",
    "ruby",
    "sage",
    "sand",
    "sky",
    "slate",
    "tomato",
    "turquoise",
    "violet",
    "yellow",
];

#[derive(Clone, Debug, PartialEq)]
pub struct RecordChip {
    pub record_id: String,
    pub label: String,
    pub object_icon: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TagPresentation {
    pub label: String,
    pub hue_name: String,
    pub text: String,
    pub background: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum CellPresentation {
    Empty,
    Text(String),
    LongText(String),
    Number(String),
    Boolean(bool),
    Temporal {
        value: String,
        includes_time: bool,
    },
    UrlPill {
        label: String,
        href: String,
    },
    Tag(TagPresentation),
    Tags(Vec<TagPresentation>),
    Relation {
        chips: Vec<RecordChip>,
        overflow: usize,
    },
    JsonInspect {
        summary: String,
        raw: Value,
    },
    Vector {
        dimensions: usize,
    },
    GeometryInspect {
        summary: String,
        raw: Value,
    },
    Uuid(String),
    RawLabeled {
        variant: String,
        raw: Value,
    },
}

pub trait RelationResolver {
    fn resolve(&self, target_object_type_id: &str, record_id: &str) -> Option<RecordChip>;
}

pub struct NoRelations;

impl RelationResolver for NoRelations {
    fn resolve(&self, _target_object_type_id: &str, _record_id: &str) -> Option<RecordChip> {
        None
    }
}

#[must_use]
pub fn render_cell(
    object_type: &ObjectType,
    field: &FieldSpec,
    value: &Value,
    scheme: ColorScheme,
    relations: &impl RelationResolver,
) -> CellPresentation {
    if value.is_null() {
        return CellPresentation::Empty;
    }
    if object_type.semantic_kind(&field.key) == Some("url") {
        return value.as_str().map_or_else(
            || raw(field, value),
            |href| CellPresentation::UrlPill {
                label: href.to_owned(),
                href: href.to_owned(),
            },
        );
    }
    match &field.field_type.kind {
        FieldKind::Text => text(value, CellPresentation::Text, field),
        FieldKind::LongText => text(value, CellPresentation::LongText, field),
        FieldKind::Integer | FieldKind::Number => value.as_f64().map_or_else(
            || raw(field, value),
            |number| CellPresentation::Number(format_number(number)),
        ),
        FieldKind::Boolean => value
            .as_bool()
            .map(CellPresentation::Boolean)
            .unwrap_or_else(|| raw(field, value)),
        FieldKind::Timestamp => text(
            value,
            |value| CellPresentation::Temporal {
                value,
                includes_time: true,
            },
            field,
        ),
        FieldKind::Date => text(
            value,
            |value| CellPresentation::Temporal {
                value,
                includes_time: false,
            },
            field,
        ),
        FieldKind::Uuid => text(value, CellPresentation::Uuid, field),
        FieldKind::Json => CellPresentation::JsonInspect {
            summary: json_summary(value),
            raw: value.clone(),
        },
        FieldKind::Enum => value.as_str().map_or_else(
            || raw(field, value),
            |label| CellPresentation::Tag(tag(label, scheme)),
        ),
        FieldKind::Vector => value.as_array().map_or_else(
            || raw(field, value),
            |values| CellPresentation::Vector {
                dimensions: values.len(),
            },
        ),
        FieldKind::Geometry => CellPresentation::GeometryInspect {
            summary: json_summary(value),
            raw: value.clone(),
        },
        FieldKind::Relation => relation(field, value, relations),
        FieldKind::Unknown(variant) if variant == "multi_select" => value.as_array().map_or_else(
            || raw(field, value),
            |values| {
                CellPresentation::Tags(
                    values
                        .iter()
                        .filter_map(Value::as_str)
                        .map(|label| tag(label, scheme))
                        .collect(),
                )
            },
        ),
        FieldKind::Unknown(_) => raw(field, value),
    }
}

fn text(
    value: &Value,
    constructor: impl FnOnce(String) -> CellPresentation,
    field: &FieldSpec,
) -> CellPresentation {
    value
        .as_str()
        .map(|value| constructor(value.to_owned()))
        .unwrap_or_else(|| raw(field, value))
}

fn relation(
    field: &FieldSpec,
    value: &Value,
    resolver: &impl RelationResolver,
) -> CellPresentation {
    let target = field.field_type.relation_target().unwrap_or("unknown");
    let values = value
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_else(|| std::slice::from_ref(value));
    let mut chips = values
        .iter()
        .filter_map(|value| {
            let record_id = value
                .as_str()
                .or_else(|| value.get("id").and_then(Value::as_str))?;
            resolver.resolve(target, record_id).or_else(|| {
                Some(RecordChip {
                    record_id: record_id.to_owned(),
                    label: value
                        .get("label")
                        .or_else(|| value.get("name"))
                        .and_then(Value::as_str)
                        .unwrap_or(record_id)
                        .to_owned(),
                    object_icon: value
                        .get("object_icon")
                        .and_then(Value::as_str)
                        .unwrap_or("record")
                        .to_owned(),
                })
            })
        })
        .collect::<Vec<_>>();
    let overflow = chips.len().saturating_sub(3);
    chips.truncate(3);
    CellPresentation::Relation { chips, overflow }
}

fn tag(label: &str, scheme: ColorScheme) -> TagPresentation {
    let index = label.bytes().fold(0usize, |hash, byte| {
        hash.wrapping_mul(31).wrapping_add(byte as usize)
    }) % TAG_HUES.len();
    let hue_name = TAG_HUES[index];
    let hue: TagHue = match scheme {
        ColorScheme::Light => TagLight::hue(hue_name),
        ColorScheme::Dark => TagDark::hue(hue_name),
    }
    .expect("palette only contains vendored twenty-ui tag hue names");
    TagPresentation {
        label: label.to_owned(),
        hue_name: hue.name.to_owned(),
        text: hue.text.to_owned(),
        background: hue.background.to_owned(),
    }
}

fn raw(field: &FieldSpec, value: &Value) -> CellPresentation {
    CellPresentation::RawLabeled {
        variant: field.field_type.kind.wire_name().to_owned(),
        raw: value.clone(),
    }
}

fn format_number(number: f64) -> String {
    if number.fract() == 0.0 {
        format!("{number:.0}")
    } else {
        number.to_string()
    }
}

fn json_summary(value: &Value) -> String {
    match value {
        Value::Object(values) => format!("{} keys", values.len()),
        Value::Array(values) => format!("{} items", values.len()),
        _ => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::DeclaredModel;

    use super::*;

    struct Resolver;

    impl RelationResolver for Resolver {
        fn resolve(&self, target: &str, record_id: &str) -> Option<RecordChip> {
            Some(RecordChip {
                record_id: record_id.into(),
                label: "Ada".into(),
                object_icon: format!("icon:{target}"),
            })
        }
    }

    fn fixture(source: &str) -> ObjectType {
        serde_json::from_str::<DeclaredModel>(source)
            .unwrap()
            .with_schema_versions()
            .object_types
            .remove(0)
    }

    #[test]
    fn known_variants_and_semantic_url_are_never_blank() {
        let company = fixture(include_str!("../fixtures/companies-declared.json"));
        let website = company
            .fields
            .iter()
            .find(|field| field.key == "website")
            .unwrap();
        assert!(matches!(
            render_cell(
                &company,
                website,
                &serde_json::json!("https://example.com"),
                ColorScheme::Light,
                &NoRelations
            ),
            CellPresentation::UrlPill { .. }
        ));
        let status = company
            .fields
            .iter()
            .find(|field| field.key == "status")
            .unwrap();
        let light = render_cell(
            &company,
            status,
            &serde_json::json!("Active"),
            ColorScheme::Light,
            &NoRelations,
        );
        let dark = render_cell(
            &company,
            status,
            &serde_json::json!("Active"),
            ColorScheme::Dark,
            &NoRelations,
        );
        assert!(
            matches!((light, dark), (CellPresentation::Tag(a), CellPresentation::Tag(b)) if a.hue_name == b.hue_name && a.background != b.background)
        );
    }

    #[test]
    fn relation_resolves_record_chip_and_unknown_renders_labeled_raw() {
        let task = fixture(include_str!("../fixtures/tasks-declared.json"));
        let assignee = task
            .fields
            .iter()
            .find(|field| field.key == "assignee")
            .unwrap();
        let relation = render_cell(
            &task,
            assignee,
            &serde_json::json!("person-1"),
            ColorScheme::Light,
            &Resolver,
        );
        assert!(
            matches!(relation, CellPresentation::Relation { chips, .. } if chips[0].label == "Ada" && chips[0].object_icon.contains("person"))
        );

        let unknown = FieldSpec {
            key: "price".into(),
            label: "Price".into(),
            description: None,
            field_type: serde_json::from_value(
                serde_json::json!({"kind": "currency", "code": "USD"}),
            )
            .unwrap(),
            required: false,
            system: false,
        };
        assert_eq!(
            render_cell(
                &task,
                &unknown,
                &serde_json::json!({"amount": 12}),
                ColorScheme::Light,
                &NoRelations
            ),
            CellPresentation::RawLabeled {
                variant: "currency".into(),
                raw: serde_json::json!({"amount": 12})
            }
        );
    }
}
