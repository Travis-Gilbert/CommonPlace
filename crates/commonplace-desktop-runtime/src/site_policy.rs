//! Per-site recall policy (HANDOFF-MARGIN-RECALL D7).
//!
//! The recall dial's global position, overridden per origin. A site set to `Off`
//! suppresses the salience pipeline for that origin entirely (D7 acceptance: no node
//! calls), whatever the dial says. Persisted in the desktop sqlite so a site can be
//! permanently Off. The pure CRUD + resolution here is unit-tested against an in-memory
//! connection; the Tauri command pair (lib.rs) is a thin `open_db` wrapper over it.

use rusqlite::Connection;

/// A recall setting: the three dial positions, reused per site. Wire value is the
/// lowercase name (parity with the TS dial in apps/web).
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecallPolicy {
    Off,
    Quiet,
    Active,
}

impl RecallPolicy {
    pub fn as_str(self) -> &'static str {
        match self {
            RecallPolicy::Off => "off",
            RecallPolicy::Quiet => "quiet",
            RecallPolicy::Active => "active",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "off" => Some(RecallPolicy::Off),
            "quiet" => Some(RecallPolicy::Quiet),
            "active" => Some(RecallPolicy::Active),
            _ => None,
        }
    }
}

/// Create the per-site policy table if absent. Origin-keyed: one row per origin.
pub fn ensure_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "create table if not exists site_policy (origin text primary key, policy text not null)",
        [],
    )?;
    Ok(())
}

/// Persist `policy` for `origin` (upsert, so re-setting a site overwrites).
pub fn set_policy(conn: &Connection, origin: &str, policy: RecallPolicy) -> rusqlite::Result<()> {
    conn.execute(
        "insert into site_policy (origin, policy) values (?1, ?2) \
         on conflict(origin) do update set policy = excluded.policy",
        rusqlite::params![origin, policy.as_str()],
    )?;
    Ok(())
}

/// The per-site override for `origin`, or `None` when the site inherits the dial.
pub fn get_policy(conn: &Connection, origin: &str) -> rusqlite::Result<Option<RecallPolicy>> {
    let mut stmt = conn.prepare("select policy from site_policy where origin = ?1")?;
    let row: rusqlite::Result<String> = stmt.query_row([origin], |row| row.get(0));
    match row {
        Ok(value) => Ok(RecallPolicy::parse(&value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(err),
    }
}

/// The effective recall state for a page: the site override when set, else the global
/// dial. A site override always wins, so a site pinned `Off` suppresses recall for that
/// origin whatever the dial is.
pub fn resolve_effective(site: Option<RecallPolicy>, dial: RecallPolicy) -> RecallPolicy {
    site.unwrap_or(dial)
}

/// Whether recall is suppressed (no salience pipeline, no node calls) for this state.
pub fn is_suppressed(effective: RecallPolicy) -> bool {
    matches!(effective, RecallPolicy::Off)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        ensure_table(&c).unwrap();
        c
    }

    #[test]
    fn policy_round_trips_and_upserts_per_origin() {
        let c = conn();
        assert_eq!(get_policy(&c, "https://ex.com").unwrap(), None, "unset origin inherits the dial");
        set_policy(&c, "https://ex.com", RecallPolicy::Active).unwrap();
        assert_eq!(get_policy(&c, "https://ex.com").unwrap(), Some(RecallPolicy::Active));
        set_policy(&c, "https://ex.com", RecallPolicy::Off).unwrap();
        assert_eq!(get_policy(&c, "https://ex.com").unwrap(), Some(RecallPolicy::Off), "upsert overwrites");
        assert_eq!(get_policy(&c, "https://other.com").unwrap(), None, "other origins unaffected");
    }

    #[test]
    fn site_off_suppresses_regardless_of_dial() {
        // D7 acceptance: per-site Off suppresses the pipeline for that origin.
        let off = resolve_effective(Some(RecallPolicy::Off), RecallPolicy::Active);
        assert_eq!(off, RecallPolicy::Off);
        assert!(is_suppressed(off), "site Off suppresses even when the dial is Active");
        // Unset inherits the dial; not suppressed at Quiet.
        assert_eq!(resolve_effective(None, RecallPolicy::Quiet), RecallPolicy::Quiet);
        assert!(!is_suppressed(resolve_effective(None, RecallPolicy::Quiet)));
        // A site override wins over the global dial.
        assert_eq!(resolve_effective(Some(RecallPolicy::Active), RecallPolicy::Off), RecallPolicy::Active);
    }
}
