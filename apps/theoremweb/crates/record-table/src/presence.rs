use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorKind {
    Human,
    AgentHead,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ActorIdentity {
    pub actor_id: String,
    pub display_name: String,
    pub kind: ActorKind,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PresenceEvent {
    Joined {
        view_id: String,
        actor: ActorIdentity,
    },
    FocusedRow {
        view_id: String,
        actor: ActorIdentity,
        record_id: String,
    },
    WroteRecord {
        view_id: String,
        actor: ActorIdentity,
        record_id: String,
    },
    Left {
        view_id: String,
        actor_id: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActorPresence {
    pub actor: ActorIdentity,
    pub focused_record_id: Option<String>,
    pub last_written_record_id: Option<String>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PresenceState {
    actors: BTreeMap<String, ActorPresence>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CoordinationStreamEvent {
    pub actor: String,
    pub kind: String,
    #[serde(default)]
    pub payload: Value,
}

impl CoordinationStreamEvent {
    #[must_use]
    pub fn into_presence_event(self) -> Option<PresenceEvent> {
        let view_id = self
            .payload
            .get("viewId")
            .or_else(|| self.payload.get("view_id"))
            .and_then(Value::as_str)?
            .to_owned();
        let actor_kind = match self
            .payload
            .get("actorKind")
            .or_else(|| self.payload.get("actor_kind"))
            .and_then(Value::as_str)
        {
            Some("head") => ActorKind::AgentHead,
            Some("human") | None => ActorKind::Human,
            Some(_) => return None,
        };
        let actor = ActorIdentity {
            actor_id: self.actor.clone(),
            display_name: self
                .payload
                .get("displayName")
                .or_else(|| self.payload.get("display_name"))
                .and_then(Value::as_str)
                .unwrap_or(&self.actor)
                .to_owned(),
            kind: actor_kind,
        };
        let record_id = || {
            self.payload
                .get("recordId")
                .or_else(|| self.payload.get("record_id"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        };
        match self.kind.as_str() {
            "view.presence" => Some(PresenceEvent::Joined { view_id, actor }),
            "view.focus" => Some(PresenceEvent::FocusedRow {
                view_id,
                actor,
                record_id: record_id()?,
            }),
            "view.write" => Some(PresenceEvent::WroteRecord {
                view_id,
                actor,
                record_id: record_id()?,
            }),
            "view.leave" => Some(PresenceEvent::Left {
                view_id,
                actor_id: actor.actor_id,
            }),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct StreamPublishCall {
    pub stream: String,
    pub actor: String,
    pub kind: String,
    pub payload: Value,
}

impl StreamPublishCall {
    #[must_use]
    pub fn for_view(
        stream: impl Into<String>,
        actor: &ActorIdentity,
        kind: &str,
        view_id: &str,
        object_type_id: &str,
        record_id: Option<&str>,
    ) -> Self {
        Self {
            stream: stream.into(),
            actor: actor.actor_id.clone(),
            kind: kind.to_owned(),
            payload: json!({
                "viewId": view_id,
                "objectTypeId": object_type_id,
                "recordId": record_id,
                "actorKind": match actor.kind {
                    ActorKind::Human => "human",
                    ActorKind::AgentHead => "head",
                },
                "displayName": actor.display_name,
            }),
        }
    }
}

impl PresenceState {
    pub fn apply(&mut self, current_view_id: &str, event: PresenceEvent) {
        match event {
            PresenceEvent::Joined { view_id, actor } if view_id == current_view_id => {
                self.actors
                    .entry(actor.actor_id.clone())
                    .or_insert(ActorPresence {
                        actor,
                        focused_record_id: None,
                        last_written_record_id: None,
                    });
            }
            PresenceEvent::FocusedRow {
                view_id,
                actor,
                record_id,
            } if view_id == current_view_id => {
                self.actors
                    .entry(actor.actor_id.clone())
                    .and_modify(|presence| {
                        presence.actor = actor.clone();
                        presence.focused_record_id = Some(record_id.clone());
                    })
                    .or_insert(ActorPresence {
                        actor,
                        focused_record_id: Some(record_id),
                        last_written_record_id: None,
                    });
            }
            PresenceEvent::WroteRecord {
                view_id,
                actor,
                record_id,
            } if view_id == current_view_id => {
                self.actors
                    .entry(actor.actor_id.clone())
                    .and_modify(|presence| {
                        presence.actor = actor.clone();
                        presence.last_written_record_id = Some(record_id.clone());
                    })
                    .or_insert(ActorPresence {
                        actor,
                        focused_record_id: None,
                        last_written_record_id: Some(record_id),
                    });
            }
            PresenceEvent::Left { view_id, actor_id } if view_id == current_view_id => {
                self.actors.remove(&actor_id);
            }
            _ => {}
        }
    }

    pub fn actors(&self) -> impl Iterator<Item = &ActorPresence> {
        self.actors.values()
    }

    #[must_use]
    pub fn row_highlights(&self, record_id: &str) -> Vec<&ActorIdentity> {
        self.actors
            .values()
            .filter(|presence| presence.focused_record_id.as_deref() == Some(record_id))
            .map(|presence| &presence.actor)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_contains_only_streamed_actors_and_keeps_head_identity() {
        let mut state = PresenceState::default();
        assert_eq!(state.actors().count(), 0);
        let head = ActorIdentity {
            actor_id: "head:qwen".into(),
            display_name: "Qwen".into(),
            kind: ActorKind::AgentHead,
        };
        state.apply(
            "view-a",
            PresenceEvent::WroteRecord {
                view_id: "view-a".into(),
                actor: head.clone(),
                record_id: "company-1".into(),
            },
        );
        assert_eq!(state.actors().next().unwrap().actor, head);
        assert_eq!(state.row_highlights("company-1").len(), 0);
    }

    #[test]
    fn coordination_wire_preserves_named_head_write_identity() {
        let event: CoordinationStreamEvent = serde_json::from_value(serde_json::json!({
            "actor": "head:qwen",
            "kind": "view.write",
            "payload": {
                "viewId": "view-a",
                "objectTypeId": "company",
                "recordId": "company-1",
                "actorKind": "head",
                "displayName": "Qwen"
            }
        }))
        .unwrap();
        let PresenceEvent::WroteRecord { actor, .. } = event.into_presence_event().unwrap() else {
            panic!("expected write event");
        };
        assert_eq!(actor.display_name, "Qwen");
        assert_eq!(actor.kind, ActorKind::AgentHead);
    }
}
