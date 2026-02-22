use super::CommandError;

/// Validates that a text field does not exceed `max_len` characters.
pub fn validate_text_length(
    field_name: &str,
    value: &str,
    max_len: usize,
) -> Result<(), CommandError> {
    if value.len() > max_len {
        return Err(CommandError::from(format!(
            "{} exceeds maximum length of {} characters (got {})",
            field_name,
            max_len,
            value.len()
        )));
    }
    Ok(())
}

/// Validates an optional text field (skips if `None`).
pub fn validate_optional_text_length(
    field_name: &str,
    value: &Option<String>,
    max_len: usize,
) -> Result<(), CommandError> {
    if let Some(v) = value {
        validate_text_length(field_name, v, max_len)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_within_limit() {
        assert!(validate_text_length("field", "hello", 10).is_ok());
    }

    #[test]
    fn test_at_limit() {
        let s = "a".repeat(100);
        assert!(validate_text_length("field", &s, 100).is_ok());
    }

    #[test]
    fn test_over_limit() {
        let s = "a".repeat(101);
        let result = validate_text_length("field", &s, 100);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_string() {
        assert!(validate_text_length("field", "", 10).is_ok());
    }

    #[test]
    fn test_optional_none() {
        assert!(validate_optional_text_length("field", &None, 10).is_ok());
    }

    #[test]
    fn test_optional_some_within_limit() {
        assert!(validate_optional_text_length("field", &Some("hi".to_string()), 10).is_ok());
    }

    #[test]
    fn test_optional_some_over_limit() {
        let s = "a".repeat(11);
        assert!(validate_optional_text_length("field", &Some(s), 10).is_err());
    }
}
