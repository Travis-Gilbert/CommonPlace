//! Attachment admission and graph-document resolution.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AttachmentDraft {
    Upload {
        name: String,
        media_type: String,
        url: String,
    },
    GraphDocument {
        document_id: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ResolvedDocument {
    pub document_id: String,
    pub title: String,
    pub media_type: String,
    pub content: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ResolvedAttachment {
    Image {
        name: String,
        media_type: String,
        url: String,
    },
    Document(ResolvedDocument),
}

pub trait DocumentResolver {
    fn resolve_document(&self, document_id: &str) -> Option<ResolvedDocument>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AttachmentError {
    UnsupportedType(String),
    DocumentNotFound(String),
}

impl std::fmt::Display for AttachmentError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedType(media_type) => {
                write!(formatter, "unsupported attachment type: {media_type}")
            }
            Self::DocumentNotFound(document_id) => {
                write!(formatter, "graph document not found: {document_id}")
            }
        }
    }
}

impl std::error::Error for AttachmentError {}

impl AttachmentDraft {
    /// Validate an upload or resolve a graph document into run-readable data.
    ///
    /// # Errors
    ///
    /// Refuses unsupported media types with the exact type in the error, and
    /// refuses graph document IDs that the supplied resolver cannot read.
    pub fn resolve(
        &self,
        documents: &impl DocumentResolver,
    ) -> Result<ResolvedAttachment, AttachmentError> {
        match self {
            Self::Upload {
                name,
                media_type,
                url,
            } if media_type.starts_with("image/") => Ok(ResolvedAttachment::Image {
                name: name.clone(),
                media_type: media_type.clone(),
                url: url.clone(),
            }),
            Self::Upload { media_type, .. } => {
                Err(AttachmentError::UnsupportedType(media_type.clone()))
            }
            Self::GraphDocument { document_id } => documents
                .resolve_document(document_id)
                .map(ResolvedAttachment::Document)
                .ok_or_else(|| AttachmentError::DocumentNotFound(document_id.clone())),
        }
    }
}

/// A [`DocumentResolver`] over documents the host has already fetched.
///
/// This is the "no second authority" resolver: it never issues a fetch of
/// its own, so a document only appears here once the host genuinely has it
/// for some other reason (an open canvas node, a bound record's linked
/// document, a search result already rendered). Attaching a document the
/// host does not hold refuses with [`AttachmentError::DocumentNotFound`]
/// rather than reaching out for it behind the interaction.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DocumentIndex {
    documents: BTreeMap<String, ResolvedDocument>,
}

impl DocumentIndex {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            documents: BTreeMap::new(),
        }
    }

    /// Build an index from documents the host already holds.
    pub fn from_documents(documents: impl IntoIterator<Item = ResolvedDocument>) -> Self {
        Self {
            documents: documents
                .into_iter()
                .map(|document| (document.document_id.clone(), document))
                .collect(),
        }
    }

    /// Record one already-fetched document as attachable.
    pub fn insert(&mut self, document: ResolvedDocument) {
        self.documents.insert(document.document_id.clone(), document);
    }

    #[must_use]
    pub fn contains(&self, document_id: &str) -> bool {
        self.documents.contains_key(document_id)
    }

    pub fn documents(&self) -> impl Iterator<Item = &ResolvedDocument> {
        self.documents.values()
    }
}

impl DocumentResolver for DocumentIndex {
    fn resolve_document(&self, document_id: &str) -> Option<ResolvedDocument> {
        self.documents.get(document_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Documents;

    impl DocumentResolver for Documents {
        fn resolve_document(&self, document_id: &str) -> Option<ResolvedDocument> {
            (document_id == "doc-1").then(|| ResolvedDocument {
                document_id: document_id.into(),
                title: "Plan".into(),
                media_type: "text/markdown".into(),
                content: "Readable by the head".into(),
            })
        }
    }

    #[test]
    fn graph_document_is_run_readable_and_unsupported_type_is_named() {
        let document = AttachmentDraft::GraphDocument {
            document_id: "doc-1".into(),
        }
        .resolve(&Documents)
        .unwrap();
        assert!(matches!(
            document,
            ResolvedAttachment::Document(ResolvedDocument { ref content, .. })
                if content == "Readable by the head"
        ));
        let error = AttachmentDraft::Upload {
            name: "archive".into(),
            media_type: "application/x-rar".into(),
            url: "data:application/x-rar;base64,AA==".into(),
        }
        .resolve(&Documents)
        .unwrap_err();
        assert_eq!(
            error.to_string(),
            "unsupported attachment type: application/x-rar"
        );
    }

    #[test]
    fn a_document_index_resolves_only_what_the_host_already_fetched() {
        let index = DocumentIndex::from_documents([ResolvedDocument {
            document_id: "doc-9".into(),
            title: "Runbook".into(),
            media_type: "text/markdown".into(),
            content: "Steps".into(),
        }]);
        assert!(index.contains("doc-9"));
        let resolved = AttachmentDraft::GraphDocument {
            document_id: "doc-9".into(),
        }
        .resolve(&index)
        .unwrap();
        assert!(matches!(
            resolved,
            ResolvedAttachment::Document(ResolvedDocument { ref title, .. }) if title == "Runbook"
        ));
        let missing = AttachmentDraft::GraphDocument {
            document_id: "doc-absent".into(),
        }
        .resolve(&index)
        .unwrap_err();
        assert_eq!(missing, AttachmentError::DocumentNotFound("doc-absent".into()));
    }
}
