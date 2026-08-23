//! Attachment admission and graph-document resolution.

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
}
