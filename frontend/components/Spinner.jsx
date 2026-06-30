export default function Spinner({ label }) {
  return (
    <div className="global-spinner-wrapper flex flex-col gap-3">
      <svg className="global-spinner" viewBox="0 0 50 50">
        <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
      </svg>
      {label ? <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{label}</div> : null}
    </div>
  )
}
