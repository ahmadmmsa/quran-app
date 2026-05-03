import { useLanguage } from '../LanguageContext'
export default function SearchBar({ value, onChange, onSubmit, placeholder, isRtl, searching }) {
  const { copy, isRTL } = useLanguage()
  const resolvedIsRtl = typeof isRtl === 'boolean' ? isRtl : isRTL
  return (
    <form className="flex gap-2" onSubmit={onSubmit} dir={resolvedIsRtl ? 'rtl' : 'ltr'}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || copy.search} />
      <button type="submit" disabled={searching}>
        {searching ? copy.searching : copy.search}
      </button>
    </form>
  )
}
