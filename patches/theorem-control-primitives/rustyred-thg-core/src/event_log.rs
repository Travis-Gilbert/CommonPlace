//! Append-only event log. Events are graph-log nodes, not a side channel.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::events::EventEnvelope;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EventLog {
    events: Vec<EventEnvelope>,
    path: Option<PathBuf>,
}

impl EventLog {
    pub fn memory() -> Self {
        Self::default()
    }

    pub fn open(path: impl AsRef<Path>) -> std::io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        let mut log = Self {
            events: Vec::new(),
            path: Some(path.clone()),
        };
        if path.exists() {
            let file = fs::File::open(&path)?;
            for line in BufReader::new(file).lines() {
                let line = line?;
                if line.trim().is_empty() {
                    continue;
                }
                if let Ok(event) = serde_json::from_str::<EventEnvelope>(&line) {
                    log.events.push(event);
                }
            }
        }
        Ok(log)
    }

    pub fn append(&mut self, event: EventEnvelope) -> std::io::Result<()> {
        if let Some(path) = &self.path {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut file = OpenOptions::new().create(true).append(true).open(path)?;
            writeln!(file, "{}", serde_json::to_string(&event).unwrap())?;
        }
        self.events.push(event);
        Ok(())
    }

    pub fn events(&self) -> &[EventEnvelope] {
        &self.events
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::{record_write_event, RecordEvent};

    #[test]
    fn events_survive_reopen() {
        let path = std::env::temp_dir().join(format!(
            "cp-events-{}.jsonl",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = std::fs::remove_file(&path);
        {
            let mut log = EventLog::open(&path).unwrap();
            log.append(record_write_event(
                "task",
                RecordEvent::Created,
                "t",
                "a",
                "p",
                1,
                2,
                vec!["n1".into()],
                10,
            ))
            .unwrap();
        }
        let reopened = EventLog::open(&path).unwrap();
        assert_eq!(reopened.events().len(), 1);
        assert_eq!(reopened.events()[0].compiled, "task.created");
        let _ = std::fs::remove_file(&path);
    }
}
