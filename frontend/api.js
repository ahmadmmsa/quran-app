import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000, // 10 seconds timeout
})

// Add a request interceptor to inject the token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the error globally, or handle specific status codes (e.g., 401, 500)
    console.error('API Error:', error.response?.data?.detail || error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/admin/login';
    }
    
    return Promise.reject(error);
  }
)

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (data) => apiClient.post('/auth/register', data),
  googleLogin: (token) => apiClient.post('/auth/google', { token }),
}

export const bibleAPI = {
  getBooks: () => apiClient.get('/bible/books'),
  getBook: (bookId) => apiClient.get(`/bible/books/${bookId}`),
  getChaptersCount: (bookId) => apiClient.get(`/bible/books/${bookId}/chapters-count`),
  getVerses: (bookId, chapterId) => 
    apiClient.get(`/bible/books/${bookId}/chapters/${chapterId}/verses`),
  search: (query) => apiClient.get('/bible/search', { params: { q: query } })
}

export const quranAPI = {
  getSurahs: () => apiClient.get('/quran/surahs'),
  getVerses: (surahId) => apiClient.get(`/quran/surahs/${surahId}/verses`),
  getTafseerBooks: () => apiClient.get('/quran/tafseer-books'),
  getTafseer: (surahId, bookId, verseNum) => 
    apiClient.get(`/quran/tafseer/${surahId}/${bookId}/${verseNum}`),
  getRelatedVerses: (surahId, verseNum, options = {}) => {
    const cleanOptions = Object.fromEntries(
      Object.entries(options).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    )
    return apiClient.get(`/quran/related-verses/${surahId}/${verseNum}`, { params: cleanOptions })
  },
  search: (query, {
    literalPage = 1, literalPerPage = 20,
    expansionPage = 1, expansionPerPage = 20,
    ...options
  } = {}) => {
    const cleanOptions = Object.fromEntries(
      Object.entries(options).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    )
    return apiClient.get('/quran/search', {
      params: {
        q: String(query || ''),
        literal_page: literalPage, literal_per_page: literalPerPage,
        expansion_page: expansionPage, expansion_per_page: expansionPerPage,
        ...cleanOptions
      }
    })
  },
  searchOntologySeeds: (terms, options = {}) => apiClient.post('/quran/ontology/search', {
    terms,
    limit_per_term: options.limitPerTerm ?? 100
  }),
  suggestOntologyVerses: ({ text = '', verses = [], limit = 15 } = {}) =>
    apiClient.post('/quran/ontology/suggest-verses', { text, verses, limit }),
  createOntologyConcept: (payload) => apiClient.post('/quran/ontology/concepts', payload),
  listOntologyConcepts: () => apiClient.get('/quran/ontology/concepts'),
  getOntologyConcept: (conceptId) => apiClient.get(`/quran/ontology/concepts/${conceptId}`),
  updateOntologyConcept: (conceptId, payload) => apiClient.put(`/quran/ontology/concepts/${conceptId}`, payload),
  deleteOntologyConcept: (conceptId) => apiClient.delete(`/quran/ontology/concepts/${conceptId}`)
}

export const adminAPI = {
  getLocales: () => apiClient.get('/admin/locales'),
  updateLocales: (payload) => apiClient.post('/admin/locales', payload)
}
