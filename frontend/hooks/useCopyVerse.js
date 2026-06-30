import { useState } from 'react'

// Shared copy-to-clipboard state for verse cards: tracks which key is "copied"
// and clears it after a short delay (guarded so a stale timer can't clobber a
// newer copy).
export default function useCopyVerse(buildText) {
  const [copiedKey, setCopiedKey] = useState(null)

  const copyVerse = async (key, verse) => {
    try {
      await navigator.clipboard.writeText(buildText(verse))
    } catch (err) {
      console.error(err)
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600)
  }

  return { copiedKey, copyVerse }
}
