export default function CopyVerseButton({ isCopied, onClick, copy }) {
  return (
    <button type="button" className={`verse-action-btn${isCopied ? ' is-copied' : ''}`} onClick={onClick}>
      {isCopied ? `✓ ${copy.copied || 'Copied'}` : (copy.copy || 'Copy')}
    </button>
  )
}
