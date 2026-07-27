use serde_json::Value;

pub fn format_count(value: u64) -> String {
    let digits = value.to_string();
    let mut formatted = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            formatted.push(',');
        }
        formatted.push(digit);
    }
    formatted
}

pub fn format_confidence(confidence_ppm: u32) -> String {
    format!("{:.1}%", f64::from(confidence_ppm) / 10_000.0)
}

pub fn format_value(value: &Value) -> String {
    match value {
        Value::Null => "null".to_owned(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => {
            let values = values
                .iter()
                .map(format_value)
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{values}]")
        }
        Value::Object(values) => {
            let mut fields = values.iter().collect::<Vec<_>>();
            fields.sort_by(|(left, _), (right, _)| left.cmp(right));
            let fields = fields
                .into_iter()
                .map(|(key, value)| format!("{key}: {}", format_value(value)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{fields}}}")
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn formats_without_locale_or_map_order_drift() {
        assert_eq!(format_count(1_234_567), "1,234,567");
        assert_eq!(format_confidence(912_500), "91.2%");
        assert_eq!(
            format_value(&json!({"z": 2, "a": [true, "yes"]})),
            "{a: [true, yes], z: 2}"
        );
    }
}
