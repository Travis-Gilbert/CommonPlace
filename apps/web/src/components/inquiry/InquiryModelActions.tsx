// SOURCING: none — pure logic, no upstream component applies

'use client';

interface InquiryModelActionsProps {
  disabled?: boolean;
  interpretLoading?: boolean;
  delegateLoading?: boolean;
  onInterpretTheorem?: () => void;
  onInterpretBestAvailable?: () => void;
  onAskTheorem?: () => void;
}

export default function InquiryModelActions({
  disabled = false,
  interpretLoading = false,
  delegateLoading = false,
  onInterpretTheorem,
  onInterpretBestAvailable,
  onAskTheorem,
}: InquiryModelActionsProps) {
  return (
    <div className="cp-inquiry-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="cp-inquiry-action-btn cp-inquiry-action-btn--web"
        disabled={disabled || delegateLoading}
        onClick={onAskTheorem}
      >
        {delegateLoading ? 'ASKING THEOREM…' : 'ASK THEOREM'}
      </button>
      <button
        type="button"
        className="cp-inquiry-action-btn"
        disabled={disabled || interpretLoading}
        onClick={onInterpretTheorem}
      >
        {interpretLoading ? 'INTERPRETING…' : 'INTERPRET WITH THEOREM'}
      </button>
      <button
        type="button"
        className="cp-inquiry-action-btn"
        disabled={disabled || interpretLoading}
        onClick={onInterpretBestAvailable}
      >
        INTERPRET WITH…
      </button>
      <span className="cp-inquiry-result-type" style={{ marginLeft: 4 }}>
        Same Theorem agent as Chat
      </span>
    </div>
  );
}
