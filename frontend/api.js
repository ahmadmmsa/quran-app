import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const bibleAPI = {
  getBooks: () => axios.get(`${API_BASE}/bible/books`),
  getBook: (bookId) => axios.get(`${API_BASE}/bible/books/${bookId}`),
  getChaptersCount: (bookId) => axios.get(`${API_BASE}/bible/books/${bookId}/chapters-count`),
  getVerses: (bookId, chapterId) => 
    axios.get(`${API_BASE}/bible/books/${bookId}/chapters/${chapterId}/verses`),
  search: (query) => axios.get(`${API_BASE}/bible/search?q=${encodeURIComponent(query)}`)
}

export const quranAPI = {
  getSurahs: () => axios.get(`${API_BASE}/quran/surahs`),
  getVerses: (surahId) => axios.get(`${API_BASE}/quran/surahs/${surahId}/verses`),
  getTafseerBooks: () => axios.get(`${API_BASE}/quran/tafseer-books`),
  getTafseer: (surahId, bookId, verseNum) => 
    axios.get(`${API_BASE}/quran/tafseer/${surahId}/${bookId}/${verseNum}`),
  getRelatedVerses: (surahId, verseNum, options = {}) => {
    const params = new URLSearchParams();

    Object.entries(options).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      params.set(key, String(value))
    })

    const suffix = params.toString() ? `?${params.toString()}` : ''
    return axios.get(`${API_BASE}/quran/related-verses/${surahId}/${verseNum}${suffix}`)
  },
  search: (query, options = {}) => {
    const params = new URLSearchParams({
      q: String(query || '')
    })

    Object.entries(options).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      params.set(key, String(value))
    })

    return axios.get(`${API_BASE}/quran/search?${params.toString()}`)
  },
  searchOntologySeeds: (terms, options = {}) => axios.post(`${API_BASE}/quran/ontology/search`, {
    terms,
    limit_per_term: options.limitPerTerm ?? 100
  }),
  createOntologyConcept: (payload) => axios.post(`${API_BASE}/quran/ontology/concepts`, payload),
  listOntologyConcepts: () => axios.get(`${API_BASE}/quran/ontology/concepts`),
  getOntologyConcept: (conceptId) => axios.get(`${API_BASE}/quran/ontology/concepts/${conceptId}`),
  updateOntologyConcept: (conceptId, payload) => axios.put(`${API_BASE}/quran/ontology/concepts/${conceptId}`, payload),
  deleteOntologyConcept: (conceptId) => axios.delete(`${API_BASE}/quran/ontology/concepts/${conceptId}`)
}
