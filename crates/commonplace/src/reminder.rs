//! Deterministic natural-language reminder parsing (PT-008).
//!
//! A small, chrono-based parser that echoes English reminder phrases into a
//! `remind_at_ms` instant. It runs inside the F2 ingest pipeline (so every
//! face of CommonPlace gets it, not just GraphQL) and never rewrites the
//! captured text: the parse is an echo, not a rewrite.
//!
//! Scope (kept deliberately small and deterministic):
//! - "tomorrow [at] 9[:00][am|pm]", "today/tonight [at] TIME"
//! - weekday names ("friday 9am", "on friday at 9", "next monday"), resolved
//!   to the next occurrence
//! - "in N minutes/hours/days"
//! - an optional "remind me ..." prefix; a bare phrase ("friday 9am") also
//!   parses when the capture is short (see [`is_short_capture`]), so long
//!   documents that merely mention "tomorrow" are not tagged
//! - default time when only a day is given: 9:00 local ("tonight" defaults to
//!   20:00, and a bare hour after "tonight" is read as PM)
//!
//! Instants are resolved in the server's local timezone and stored as
//! milliseconds since the Unix epoch (UTC). `now` is injected for
//! testability.

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, NaiveDateTime, TimeZone, Weekday};

/// Default reminder hour when a phrase names only a day.
const DEFAULT_HOUR: u32 = 9;
/// Default reminder hour for a bare "tonight".
const TONIGHT_HOUR: u32 = 20;
/// A capture is "short" (bare phrases parse without a "remind me" prefix) when
/// it is at most this many words...
const SHORT_CAPTURE_MAX_WORDS: usize = 30;
/// ...and at most this many characters.
const SHORT_CAPTURE_MAX_CHARS: usize = 240;

/// Parse the first English reminder phrase in `text`, relative to `now`
/// (local time). Returns the reminder instant as milliseconds since the Unix
/// epoch, or `None` when no phrase in scope is found.
pub fn parse_reminder(text: &str, now: DateTime<Local>) -> Option<i64> {
    let lowered = text.to_lowercase();
    if let Some(idx) = lowered.find("remind me") {
        return scan(&lowered[idx + "remind me".len()..], now);
    }
    if is_short_capture(&lowered) {
        return scan(&lowered, now);
    }
    None
}

fn is_short_capture(text: &str) -> bool {
    text.chars().count() <= SHORT_CAPTURE_MAX_CHARS
        && text.split_whitespace().count() <= SHORT_CAPTURE_MAX_WORDS
}

/// A clock time parsed out of the token stream.
struct ParsedTime {
    hour: u32,
    minute: u32,
    explicit_meridiem: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum Meridiem {
    Am,
    Pm,
}

fn scan(text: &str, now: DateTime<Local>) -> Option<i64> {
    let tokens: Vec<String> = text
        .split_whitespace()
        .map(clean_token)
        .filter(|token| !token.is_empty())
        .collect();

    for (i, token) in tokens.iter().enumerate() {
        match token.as_str() {
            "in" => {
                if let Some(ms) = parse_relative(&tokens, i + 1, now) {
                    return Some(ms);
                }
            }
            "tomorrow" => {
                let time = parse_time_after(&tokens, i + 1);
                let (hour, minute) = time
                    .map(|t| (t.hour, t.minute))
                    .unwrap_or((DEFAULT_HOUR, 0));
                return local_ms(now.date_naive() + Duration::days(1), hour, minute);
            }
            "today" => {
                let time = parse_time_after(&tokens, i + 1);
                let (hour, minute) = time
                    .map(|t| (t.hour, t.minute))
                    .unwrap_or((DEFAULT_HOUR, 0));
                return local_ms(now.date_naive(), hour, minute);
            }
            "tonight" => {
                let (hour, minute) = match parse_time_after(&tokens, i + 1) {
                    // A bare evening hour ("tonight at 9") reads as PM.
                    Some(t) if !t.explicit_meridiem && t.hour >= 1 && t.hour < 12 => {
                        (t.hour + 12, t.minute)
                    }
                    Some(t) => (t.hour, t.minute),
                    None => (TONIGHT_HOUR, 0),
                };
                return local_ms(now.date_naive(), hour, minute);
            }
            _ => {
                if let Some(target) = weekday_from(token) {
                    let explicit_next = i > 0 && tokens[i - 1] == "next";
                    let time = parse_time_after(&tokens, i + 1);
                    let (hour, minute) = time
                        .map(|t| (t.hour, t.minute))
                        .unwrap_or((DEFAULT_HOUR, 0));
                    let mut days_ahead = (i64::from(target.num_days_from_monday())
                        - i64::from(now.weekday().num_days_from_monday()))
                    .rem_euclid(7);
                    if days_ahead == 0 {
                        // Same weekday: today only if the time is still ahead;
                        // "next <weekday>" always means a week out.
                        let today = local_ms(now.date_naive(), hour, minute);
                        let still_ahead =
                            matches!(today, Some(candidate) if candidate > now.timestamp_millis());
                        if explicit_next || !still_ahead {
                            days_ahead = 7;
                        }
                    }
                    return local_ms(now.date_naive() + Duration::days(days_ahead), hour, minute);
                }
            }
        }
    }
    None
}

/// Trim punctuation from token edges, keeping interior structure ("9:30",
/// "image/png").
fn clean_token(raw: &str) -> String {
    raw.trim_matches(|ch: char| !ch.is_ascii_alphanumeric())
        .to_string()
}

fn weekday_from(token: &str) -> Option<Weekday> {
    match token {
        "monday" => Some(Weekday::Mon),
        "tuesday" => Some(Weekday::Tue),
        "wednesday" => Some(Weekday::Wed),
        "thursday" => Some(Weekday::Thu),
        "friday" => Some(Weekday::Fri),
        "saturday" => Some(Weekday::Sat),
        "sunday" => Some(Weekday::Sun),
        _ => None,
    }
}

/// "N minutes|hours|days" starting at `tokens[j]`, resolved against `now`.
fn parse_relative(tokens: &[String], j: usize, now: DateTime<Local>) -> Option<i64> {
    let amount: i64 = tokens.get(j)?.parse().ok()?;
    if !(1..=100_000).contains(&amount) {
        return None;
    }
    let duration = match tokens.get(j + 1)?.as_str() {
        "minute" | "minutes" | "min" | "mins" => Duration::minutes(amount),
        "hour" | "hours" | "hr" | "hrs" => Duration::hours(amount),
        "day" | "days" => Duration::days(amount),
        _ => return None,
    };
    Some((now + duration).timestamp_millis())
}

/// A clock time at `tokens[j]`, skipping an optional "at". Accepts "9:00",
/// "9am", "9 am", "9:30pm"; a bare hour with no colon and no meridiem only
/// counts when introduced by "at" (so "tomorrow 3 things" does not read 3:00).
fn parse_time_after(tokens: &[String], mut j: usize) -> Option<ParsedTime> {
    let mut had_at = false;
    if tokens.get(j).map(String::as_str) == Some("at") {
        had_at = true;
        j += 1;
    }
    let token = tokens.get(j)?;
    let (core, mut meridiem) = split_meridiem(token);
    if meridiem.is_none() {
        meridiem = match tokens.get(j + 1).map(String::as_str) {
            Some("am") => Some(Meridiem::Am),
            Some("pm") => Some(Meridiem::Pm),
            _ => None,
        };
    }
    let has_colon = core.contains(':');
    let (hour_raw, minute): (u32, u32) = match core.split_once(':') {
        Some((hour, minute)) => (hour.parse().ok()?, minute.parse().ok()?),
        None => (core.parse().ok()?, 0),
    };
    if !had_at && !has_colon && meridiem.is_none() {
        return None;
    }
    let hour = match meridiem {
        Some(Meridiem::Am) => {
            if hour_raw == 12 {
                0
            } else {
                hour_raw
            }
        }
        Some(Meridiem::Pm) => {
            if hour_raw == 12 {
                12
            } else {
                hour_raw + 12
            }
        }
        None => hour_raw,
    };
    if hour > 23 || minute > 59 || (meridiem.is_some() && hour_raw > 12) {
        return None;
    }
    Some(ParsedTime {
        hour,
        minute,
        explicit_meridiem: meridiem.is_some(),
    })
}

fn split_meridiem(token: &str) -> (&str, Option<Meridiem>) {
    if let Some(core) = token.strip_suffix("am") {
        if !core.is_empty() {
            return (core, Some(Meridiem::Am));
        }
    }
    if let Some(core) = token.strip_suffix("pm") {
        if !core.is_empty() {
            return (core, Some(Meridiem::Pm));
        }
    }
    (token, None)
}

fn local_ms(date: NaiveDate, hour: u32, minute: u32) -> Option<i64> {
    let naive = date.and_hms_opt(hour, minute, 0)?;
    resolve_local(naive)
}

/// Resolve a local wall-clock datetime to epoch ms. Ambiguous local times (DST
/// fall-back) take the earlier instant; nonexistent local times (DST
/// spring-forward gap) shift forward one hour.
fn resolve_local(naive: NaiveDateTime) -> Option<i64> {
    match Local.from_local_datetime(&naive) {
        chrono::LocalResult::Single(instant) => Some(instant.timestamp_millis()),
        chrono::LocalResult::Ambiguous(earlier, _) => Some(earlier.timestamp_millis()),
        chrono::LocalResult::None => Local
            .from_local_datetime(&(naive + Duration::hours(1)))
            .earliest()
            .map(|instant| instant.timestamp_millis()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fixed local "now": Wednesday 2026-07-01 10:00 local time.
    fn wednesday_morning() -> DateTime<Local> {
        Local
            .with_ymd_and_hms(2026, 7, 1, 10, 0, 0)
            .single()
            .expect("fixed test now")
    }

    fn expect_local(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> i64 {
        Local
            .with_ymd_and_hms(year, month, day, hour, minute, 0)
            .single()
            .expect("expected local instant")
            .timestamp_millis()
    }

    #[test]
    fn remind_me_tomorrow_at_bare_hour() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("remind me tomorrow at 9", now),
            Some(expect_local(2026, 7, 2, 9, 0))
        );
    }

    #[test]
    fn tomorrow_with_minutes_and_meridiem() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("dentist tomorrow 5:30pm", now),
            Some(expect_local(2026, 7, 2, 17, 30))
        );
    }

    #[test]
    fn bare_weekday_time_in_short_capture() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("call mom friday 9am", now),
            Some(expect_local(2026, 7, 3, 9, 0))
        );
    }

    #[test]
    fn on_weekday_at_bare_hour() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("submit the report on friday at 9", now),
            Some(expect_local(2026, 7, 3, 9, 0))
        );
    }

    #[test]
    fn next_weekday_defaults_to_nine() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("next monday", now),
            Some(expect_local(2026, 7, 6, 9, 0))
        );
    }

    #[test]
    fn next_same_weekday_means_a_week_out() {
        // 2026-07-01 is a Wednesday; "next wednesday" is a week later even
        // though the default time is still ahead today.
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("next wednesday", now),
            Some(expect_local(2026, 7, 8, 9, 0))
        );
    }

    #[test]
    fn same_weekday_rolls_forward_when_time_passed() {
        // At 10:00 on Wednesday, "wednesday 9am" already passed: next week.
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("wednesday 9am", now),
            Some(expect_local(2026, 7, 8, 9, 0))
        );
        // But "wednesday 4pm" is still ahead: today.
        assert_eq!(
            parse_reminder("wednesday 4pm", now),
            Some(expect_local(2026, 7, 1, 16, 0))
        );
    }

    #[test]
    fn relative_minutes_hours_days() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("remind me in 30 minutes", now),
            Some((now + Duration::minutes(30)).timestamp_millis())
        );
        assert_eq!(
            parse_reminder("in 2 hours", now),
            Some((now + Duration::hours(2)).timestamp_millis())
        );
        assert_eq!(
            parse_reminder("in 3 days", now),
            Some((now + Duration::days(3)).timestamp_millis())
        );
    }

    #[test]
    fn today_and_tonight() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("today at 4pm", now),
            Some(expect_local(2026, 7, 1, 16, 0))
        );
        assert_eq!(
            parse_reminder("tonight", now),
            Some(expect_local(2026, 7, 1, 20, 0))
        );
        // A bare hour after "tonight" reads as PM.
        assert_eq!(
            parse_reminder("tonight at 9", now),
            Some(expect_local(2026, 7, 1, 21, 0))
        );
    }

    #[test]
    fn bare_number_without_at_is_not_a_time() {
        let now = wednesday_morning();
        // "3" is a count, not a clock time: default 9:00 stands.
        assert_eq!(
            parse_reminder("tomorrow 3 things to do", now),
            Some(expect_local(2026, 7, 2, 9, 0))
        );
    }

    #[test]
    fn long_capture_without_prefix_does_not_parse() {
        let now = wednesday_morning();
        let long = "this is a much longer captured document that happens to mention \
            tomorrow somewhere in the middle of its prose and keeps going with more \
            words than any quick capture would ever contain so the parser must not \
            tag it with a reminder just because a day word appears in passing here";
        assert_eq!(parse_reminder(long, now), None);
        // The explicit prefix still parses inside long text.
        let long_with_prefix = format!("{long} remind me tomorrow at 9");
        assert_eq!(
            parse_reminder(&long_with_prefix, now),
            Some(expect_local(2026, 7, 2, 9, 0))
        );
    }

    #[test]
    fn plain_text_does_not_parse() {
        let now = wednesday_morning();
        assert_eq!(parse_reminder("groceries list milk eggs", now), None);
        assert_eq!(parse_reminder("", now), None);
    }

    #[test]
    fn twelve_am_and_pm_resolve_correctly() {
        let now = wednesday_morning();
        assert_eq!(
            parse_reminder("tomorrow at 12am", now),
            Some(expect_local(2026, 7, 2, 0, 0))
        );
        assert_eq!(
            parse_reminder("tomorrow at 12pm", now),
            Some(expect_local(2026, 7, 2, 12, 0))
        );
    }
}
