import re
from dataclasses import dataclass

QUOTE_VARIANTS = re.compile(r'[“”„‟«»]')
APOSTROPHE_VARIANTS = re.compile(r"[‘’‚‛]")
ARABIC_DIACRITICS = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]')
ARABIC_LETTER_PATTERN = re.compile(r'[\u0600-\u06FF]')
HEBREW_LETTER_PATTERN = re.compile(r'[\u0590-\u05FF]')
FTS_SPECIAL_CHARS = re.compile(r'["\'():{}\[\]*^~]')
NON_ARABIC_TOKEN_CHARS = re.compile(r'[^\u0621-\u063A\u0641-\u064A0-9]')

ARABIC_STOPWORDS = frozenset(
    {
        # ---- pronouns & demonstratives ----
        'انا',
        'انت',
        'انتم',
        'انتما',
        'انتن',
        'نحن',
        'هو',
        'هي',
        'هما',
        'هم',
        'هن',
        'هذا',
        'هذه',
        'هذان',
        'ذلك',
        'تلك',
        'اولئك',
        'هولاء',
        'هناك',
        # ---- relative pronouns ----
        'الذي',
        'التي',
        'الذين',
        'اللذان',
        'اللذين',
        'اللاتي',
        'اللتان',
        'اللتين',
        'اللواتي',
        'الوالي',
        # ---- حروف الجر (prepositions) ----
        'في',
        'من',
        'الي',          # إلى
        'علي',          # على
        'عن',
        'حتي',          # حتى
        'منذ',
        'مذ',
        'كي',
        'لدي',          # لدى
        'بين',
        'مع',
        'دون',
        # ---- حروف الجر + pronoun suffixes ----
        'فيه',
        'فيها',
        'فيهم',
        'فيهن',
        'منه',
        'منها',
        'منهم',
        'منكم',
        'منكن',
        'منا',
        'عليه',
        'عليها',
        'عليهم',
        'عليهن',
        'عليكم',
        'عليك',
        'علينا',
        'عنه',
        'عنها',
        'عنهم',
        'عنكم',
        'اليه',
        'اليها',
        'اليهم',
        'اليهن',
        'اليك',
        'اليكم',
        'اليكما',
        'اليكن',
        'لديه',
        'لديها',
        'لديهم',
        # ---- حروف الناسخة (إنّ وأخواتها) ----
        'ان',           # إنّ / أنّ
        'لكن',
        'ليت',
        'لعل',
        'انما',
        # + pronoun suffixes
        'انه',
        'انها',
        'انهم',
        'اني',
        'لكنه',
        'لكنها',
        'لكنهم',
        'لعله',
        'لعلها',
        'لعلهم',
        'لعلكم',
        # ---- كان وأخواتها (linking / auxiliary verbs) ----
        'كان',
        'كانت',
        'كانوا',
        'كنت',
        'كنتم',
        'كنا',
        'كن',           # imperative of كان
        'يكن',
        'تكن',
        'نكن',
        'يكون',
        'تكون',
        'نكون',
        'اكون',
        'يكونوا',
        'ليس',
        'ليست',
        'ليسوا',
        'صار',
        'صارت',
        'صاروا',
        'اصبح',
        'اصبحت',
        'اصبحوا',
        'ظل',
        'بات',
        # ---- particles / connectors ----
        'لا',
        'الا',          # ألا / إلّا
        'بل',
        'هل',
        'لو',
        'لولا',
        'قد',
        'لقد',
        'سوف',
        'اذ',
        'اذا',
        'اما',
        'ثم',
        'او',
        'حيث',
        'اذن',
        # ---- preposition / conjunction + ما  ----
        'مما',
        'بما',
        'كما',
        'لما',
        'عما',
        'فيما',
        # ---- ل / ب / ك preposition with pronoun suffixes ----
        'له',
        'لها',
        'لهم',
        'لهن',
        'لك',
        'لكم',
        'لنا',
        'به',
        'بها',
        'بهم',
        'بكم',
        'بان',
        'لهذا',
        # ---- common Quranic function words ----
        'الله',
        'والله',
        'الان',
        'اليوم',
        'ايضا',
        'اي',
        'اياكم',
        'ايام',
        'يا',
        'كل',
        'كم',
        'كيف',
        'ما',
        'ماذا',
        # ---- common verb forms often functioning as discourse markers ----
        'قال',
        'قالت',
        'قالوا',
        'قل',
        'فان',
        'فانه',
        'فكان',
        'فكانت',
        'فلا',
        'كذلك',
        'لذلك',
        'لم',
        'لن',
        'ولا',
        'وما',
        'وهو',
        'والذي',
        'والذين',
        'وان',
        'عند',
    }
)

ENGLISH_STOPWORDS = frozenset(
    {
        # ---- articles ----
        'a', 'an', 'the',
        # ---- pronouns ----
        'i', 'me', 'my', 'mine', 'myself',
        'you', 'your', 'yours', 'yourself', 'yourselves',
        'he', 'him', 'his', 'himself',
        'she', 'her', 'hers', 'herself',
        'it', 'its', 'itself',
        'we', 'us', 'our', 'ours', 'ourselves',
        'they', 'them', 'their', 'theirs', 'themselves',
        # ---- demonstratives / relatives ----
        'this', 'that', 'these', 'those',
        'who', 'whom', 'whose', 'which', 'what',
        # ---- prepositions ----
        'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by',
        'of', 'about', 'into', 'through', 'during', 'before',
        'after', 'above', 'below', 'between', 'under', 'over',
        'up', 'down', 'out', 'off', 'against', 'upon',
        # ---- conjunctions / connectors ----
        'and', 'or', 'but', 'nor', 'so', 'yet', 'both',
        'either', 'neither', 'than', 'whether',
        # ---- auxiliary / linking verbs ----
        'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
        'do', 'does', 'did', 'has', 'have', 'had', 'having',
        'will', 'shall', 'would', 'should', 'could', 'may',
        'might', 'must', 'can',
        # ---- negation / particles ----
        'not', 'no',
        # ---- common function words ----
        'if', 'then', 'else', 'when', 'where', 'how', 'why',
        'all', 'each', 'every', 'any', 'some', 'such',
        'only', 'also', 'just', 'very', 'too', 'more', 'most',
        'other', 'another', 'there', 'here',
        'as', 'while', 'until', 'because', 'since', 'although',
    }
)

HEBREW_STOPWORDS = frozenset(
    {
        # ---- pronouns ----
        'אני', 'אתה', 'את', 'הוא', 'היא',
        'אנחנו', 'אתם', 'אתן', 'הם', 'הן',
        # ---- demonstratives ----
        'זה', 'זאת', 'זו', 'אלה', 'אלו',
        # ---- relative / interrogative ----
        'אשר', 'מי', 'מה', 'איך', 'איפה', 'למה', 'מתי',
        # ---- prepositions ----
        'של', 'על', 'אל', 'מן', 'עם', 'בין', 'לפני',
        'אחרי', 'תחת', 'מעל', 'ליד', 'בתוך', 'עד',
        'נגד', 'בלי', 'ללא', 'כלפי', 'דרך',
        # ---- conjunctions / connectors ----
        'כי', 'גם', 'או', 'אבל', 'אלא', 'אם', 'כאשר',
        'למרות', 'בגלל', 'לכן', 'אז', 'רק', 'עוד',
        # ---- negation / particles ----
        'לא', 'אין', 'בלי', 'אף',
        # ---- auxiliary / common function words ----
        'כל', 'כמה', 'הרבה', 'מאוד', 'יותר', 'פה', 'שם',
        'יש', 'היה', 'היתה', 'היו', 'הזה', 'הזאת',
        'כמו', 'כך', 'ככה', 'אותו', 'אותה', 'אותם',
    }
)

@dataclass(slots=True)
class ParsedSearchQuery:
    normalized: str
    fts_query: str
    phrases: list[str]
    terms: list[str]
    has_quoted_phrase: bool

@dataclass(slots=True)
class ArabicTermAnalysis:
    term: str
    normalized_term: str
    comparison_term: str

def normalize_search_input(value: str | None) -> str:
    text = QUOTE_VARIANTS.sub('"', str(value or ''))
    text = APOSTROPHE_VARIANTS.sub("'", text)
    return re.sub(r'\s+', ' ', text).strip()

def sanitize_fts_token(token: str | None) -> str:
    cleaned = FTS_SPECIAL_CHARS.sub(' ', str(token or '')).strip()
    # return cleaned.split()[0] if cleaned else ''
    return ' '.join(cleaned.split())

def sanitize_phrase(phrase: str | None) -> str:
    return re.sub(r'\s+', ' ', str(phrase or '').replace('"', ' ')).strip()

def escape_like(value: str | None) -> str:
    """Escape LIKE/ILIKE wildcards so user input is matched literally.

    Postgres uses backslash as the default LIKE escape character, so escaping
    backslash, percent and underscore is sufficient (no ESCAPE clause needed).
    """
    return (
        str(value or '')
        .replace('\\', '\\\\')
        .replace('%', '\\%')
        .replace('_', '\\_')
    )

def parse_search_query(value: str | None) -> ParsedSearchQuery:
    normalized = normalize_search_input(value)
    if not normalized:
        return ParsedSearchQuery('', '', [], [], False)

    phrases: list[str] = []

    def replace_phrase(match: re.Match[str]) -> str:
        phrase = (match.group(1) or match.group(2) or '').strip()
        if phrase:
            phrases.append(phrase)
        return ' '

    remaining = re.sub(r'"([^"]+)"|\'([^\']+)\'', replace_phrase, normalized).strip()
    terms = [sanitize_fts_token(token) for token in re.split(r'\s+', remaining) if sanitize_fts_token(token)]
    phrase_clauses = [f'"{sanitize_phrase(phrase)}"' for phrase in phrases]
    term_clauses = [f'"{term}"' for term in terms]
    return ParsedSearchQuery(normalized, ' AND '.join([*phrase_clauses, *term_clauses]), phrases, terms, bool(phrases))

def contains_arabic(value: str | None) -> bool:
    return bool(ARABIC_LETTER_PATTERN.search(str(value or '')))

def contains_hebrew(value: str | None) -> bool:
    return bool(HEBREW_LETTER_PATTERN.search(str(value or '')))

def normalize_arabic_text(value: str | None) -> str:
    text = ARABIC_DIACRITICS.sub('', str(value or ''))
    text = text.replace('ـ', '')
    text = re.sub(r'[إأآٱ]', 'ا', text)
    text = text.replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'\s+', ' ', text).strip()

def normalize_arabic_token(value: str | None) -> str:
    return NON_ARABIC_TOKEN_CHARS.sub('', normalize_arabic_text(value))

def strip_arabic_definite_article(token: str | None) -> str:
    normalized = normalize_arabic_token(token)
    if normalized.startswith('ال') and len(normalized) > 2:
        return normalized[2:]
    return normalized

def build_arabic_comparison_token(token: str | None) -> str:
    normalized = normalize_arabic_token(token)
    if not normalized:
        return ''
    stripped = strip_arabic_definite_article(normalized)
    if len(stripped) >= 3:
        return stripped
    return normalized

def is_arabic_stopword(token: str | None) -> bool:
    if not token:
        return False
    normalized = normalize_arabic_token(token)
    comparison = build_arabic_comparison_token(normalized)
    return normalized in ARABIC_STOPWORDS or comparison in ARABIC_STOPWORDS

def is_arabic_content_token(token: str | None, *, min_length: int = 3) -> bool:
    normalized = normalize_arabic_token(token)
    if len(normalized) < min_length:
        return False
    return not is_arabic_stopword(normalized)

def split_normalized_tokens(value: str | None) -> list[str]:
    return [token for token in str(value or '').split() if token]

def extract_arabic_key_terms(text: str | None, *, min_length: int = 3) -> list[ArabicTermAnalysis]:
    seen_terms: set[str] = set()
    analyses: list[ArabicTermAnalysis] = []

    for token in tokenize_generic_text(text, 'ar'):
        normalized = normalize_arabic_token(token)
        comparison = build_arabic_comparison_token(normalized)
        if not comparison or comparison in seen_terms:
            continue
        if not is_arabic_content_token(normalized, min_length=min_length):
            continue
        seen_terms.add(comparison)
        analyses.append(
            ArabicTermAnalysis(
                term=token,
                normalized_term=normalized,
                comparison_term=comparison,
            )
        )
    return analyses

def detect_language(value: str | None) -> str:
    if contains_arabic(value):
        return 'ar'
    if contains_hebrew(value):
        return 'he'
    return 'en'

def tokenize_generic_text(text: str | None, language: str) -> list[str]:
    raw = str(text or '')
    if language == 'ar':
        normalized = normalize_arabic_text(raw)
        collapsed = re.sub(r'[^\u0621-\u063A\u0641-\u064A0-9\s]', ' ', normalized)
        return [token for token in collapsed.split() if token]
    if language == 'he':
        collapsed = re.sub(r'[^\u0590-\u05FF0-9\s]', ' ', raw)
        return [token for token in collapsed.split() if token]
    collapsed = re.sub(r'[^a-zA-Z0-9\s]', ' ', raw.lower())
    return [token for token in collapsed.split() if token]

def highlight_text(text: str | None, terms: list[str]) -> str:
    if not terms:
        return str(text or '')
    pattern = re.compile(
        '|'.join(re.escape(t) for t in sorted({t for t in terms if t}, key=len, reverse=True)),
        flags=re.IGNORECASE,
    )
    return pattern.sub(lambda m: f'[[{m.group(0)}]]', str(text or ''))

def is_english_stopword(token: str | None) -> bool:
    return str(token or '').lower().strip() in ENGLISH_STOPWORDS

def is_hebrew_stopword(token: str | None) -> bool:
    return str(token or '').strip() in HEBREW_STOPWORDS

def is_stopword(token: str | None, language: str) -> bool:
    if language == 'ar':
        return is_arabic_stopword(token)
    if language == 'he':
        return is_hebrew_stopword(token)
    return is_english_stopword(token)

def check_stopword_query(query: str | None) -> tuple[bool, str]:
    parsed = parse_search_query(query)
    if not parsed.normalized:
        return False, 'en'
    if parsed.has_quoted_phrase:
        return False, detect_language(parsed.normalized)
    language = detect_language(parsed.normalized)
    tokens = tokenize_generic_text(parsed.normalized, language)
    if not tokens:
        return False, language
    if all(is_stopword(token, language) for token in tokens):
        return True, language
    return False, language