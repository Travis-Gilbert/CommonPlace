'use client';

/**
 * SuggestSourceForm: Community source suggestion with reCAPTCHA v3.
 *
 * Progressive disclosure: teaser card with CTA expands to reveal form.
 * Submits to the research_api suggest/source endpoint.
 */

import { useState, useCallback } from 'react';
import { loadRecaptchaScript, getRecaptchaToken } from '@/lib/recaptcha';
import { submitSourceSuggestion } from '@/lib/research';

const SOURCE_TYPE_OPTIONS = [
  { value: 'book', label: 'Book' },
  { value: 'article', label: 'Article' },
  { value: 'paper', label: 'Paper' },
  { value: 'video', label: 'Video' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'document', label: 'Document' },
  { value: 'report', label: 'Report' },
  { value: 'website', label: 'Website' },
];

interface SuggestSourceFormProps {
  slug: string;
  contentType: 'essay' | 'field_note';
}

export default function SuggestSourceForm({ slug, contentType }: SuggestSourceFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState('article');
  const [relevanceNote, setRelevanceNote] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [contributorUrl, setContributorUrl] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      await loadRecaptchaScript();
      const token = await getRecaptchaToken('suggest_source');

      const success = await submitSourceSuggestion({
        title: title.trim(),
        url: url.trim(),
        source_type: sourceType,
        relevance_note: relevanceNote.trim(),
        target_content_type: contentType,
        target_slug: slug,
        contributor_name: contributorName.trim(),
        contributor_url: contributorUrl.trim(),
        recaptcha_token: token,
      });

      if (success) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [title, url, sourceType, relevanceNote, contentType, slug, contributorName, contributorUrl]);

  if (submitted) {
    return (
      <div className="bg-surface/65 border border-dashed border-border rounded-[10px] p-5 px-6 text-center mt-7">
        <p className="font-title text-base font-semibold text-ink m-0 mb-1">
          Thanks! Your suggestion will be reviewed.
        </p>
        <p className="font-body-alt text-[13px] text-ink-muted m-0">
          Approved sources will appear in the trail.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface/65 border border-dashed border-border rounded-[10px] p-5 px-6 mt-7">
      {!isOpen ? (
        /* Teaser state */
        <div className="text-center">
          <p className="font-title text-base font-semibold text-ink m-0 mb-1.5">
            Know a source I should see?
          </p>
          <p className="font-body-alt text-[13px] text-ink-muted m-0 mb-3.5">
            If you&apos;ve found something relevant to this investigation, suggest it below.
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className="font-mono-alt text-xs uppercase tracking-[0.06em] text-surface bg-terracotta border-none rounded-md px-6 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-terracotta-hover shadow-[0_2px_8px_rgba(42,36,32,0.12)]"
          >
            Suggest a source
          </button>
        </div>
      ) : (
        /* Expanded form */
        <form onSubmit={handleSubmit}>
          <p className="font-title text-base font-semibold text-ink m-0 mb-3">
            Suggest a source
          </p>

          {/* Title (required) */}
          <label className="block mb-3">
            <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
              Title *
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors"
              placeholder="Source title"
            />
          </label>

          {/* URL */}
          <label className="block mb-3">
            <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
              URL
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors"
              placeholder="https://..."
            />
          </label>

          {/* Source type */}
          <label className="block mb-3">
            <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
              Source type
            </span>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors"
            >
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Relevance note */}
          <label className="block mb-3">
            <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
              Why is this relevant?
            </span>
            <textarea
              value={relevanceNote}
              onChange={(e) => setRelevanceNote(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors resize-y"
              placeholder="A brief note on how this connects..."
            />
          </label>

          {/* Name and URL (optional, side by side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
                Your name (optional)
              </span>
              <input
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors"
              />
            </label>
            <label className="block">
              <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-ink-light block mb-1">
                Your URL (optional)
              </span>
              <input
                type="url"
                value={contributorUrl}
                onChange={(e) => setContributorUrl(e.target.value)}
                className="w-full font-body-alt text-sm text-ink bg-paper border border-border rounded-md px-3 py-2 focus:outline-none focus:border-terracotta/50 transition-colors"
              />
            </label>
          </div>

          {error && (
            <p className="font-body-alt text-[13px] text-error mb-3 m-0">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="font-mono-alt text-xs uppercase tracking-[0.06em] text-surface bg-terracotta border-none rounded-md px-6 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-terracotta-hover shadow-[0_2px_8px_rgba(42,36,32,0.12)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-mono-alt text-xs uppercase tracking-[0.06em] text-ink-light bg-transparent border-none cursor-pointer hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
