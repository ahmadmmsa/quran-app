import { clickableProps } from './a11y'

// Shared layout for a single verse result row: a clickable reference header with
// an optional actions cluster, followed by the verse body (passed as children).
export default function SearchResultCard({ label, reference, onLabelClick, actions, children }) {
  return (
    <div className="search-result">
      <div className="search-result-meta">
        <div className="search-result-ref">
          <span className="search-result-surah" {...clickableProps(onLabelClick)}>{label}</span>
          <span className="search-result-num">{reference}</span>
        </div>
        {actions ? <div className="search-result-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
