function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toHighlightedMarkup(text, fallbackText = '') {
  const source = text || fallbackText || '';
  const escaped = escapeHtml(source);

  return {
    __html: escaped
      .replace(/\[\[/g, '')
      .replace(/\]\]/g, '')
  };
}
