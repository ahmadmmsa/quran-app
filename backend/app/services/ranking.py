from dataclasses import dataclass, field
from collections import defaultdict
import math

@dataclass
class RetrievalCandidate:
    verse_id: int
    suraid: int
    verse_num: int
    channel_scores: dict[str, float] = field(default_factory=dict)
    channel_ranks: dict[str, int] = field(default_factory=dict)
    rrf_score: float = 0.0
    final_score: float = 0.0
    match_evidence: list[dict] = field(default_factory=list)
    verse_data: dict | None = None

def reciprocal_rank_fusion(channel_results: dict[str, list[dict]], k: int = 60) -> list[RetrievalCandidate]:
    """
    Applies Reciprocal Rank Fusion (RRF) across multiple retrieval channels.
    channel_results: A dict where key is channel name (e.g. 'lexical', 'lemma', 'root', 'embedding')
                     and value is a list of dicts: {'id': int, 'suraid': int, 'verse_num': int, 'score': float, 'evidence': dict}
    """
    candidates = {}
    
    for channel, items in channel_results.items():
        for rank, item in enumerate(items, start=1):
            vid = item['id']
            if vid not in candidates:
                candidates[vid] = RetrievalCandidate(
                    verse_id=vid,
                    suraid=item['suraid'],
                    verse_num=item['verse_num']
                )
            
            c = candidates[vid]
            c.channel_ranks[channel] = rank
            c.channel_scores[channel] = float(item.get('score', 0.0))
            
            # Accumulate RRF Score
            c.rrf_score += 1.0 / (k + rank)
            
            if 'evidence' in item:
                c.match_evidence.extend(item['evidence'] if isinstance(item['evidence'], list) else [item['evidence']])
                
    # Initial sort by RRF score
    return sorted(candidates.values(), key=lambda c: (-c.rrf_score, c.suraid, c.verse_num))

def rerank_candidates(candidates: list[RetrievalCandidate], profile: dict) -> list[RetrievalCandidate]:
    """
    Applies explicit scoring to the hydrated candidates.
    Requires verse_data to be populated.
    """
    exact_terms = profile.get('exact_terms') or []
    phrases = profile.get('phrases') or []
    
    for c in candidates:
        if not c.verse_data:
            continue
            
        # Base score from RRF
        score = c.rrf_score * 10.0  # scale up for easier reading
        
        verse_txt = (c.verse_data.get('verse_txt_raw') or '').lower()
        normalized_tokens = (c.verse_data.get('normalized_tokens') or '').lower()
        
        # 1. Exact Phrase Bonus
        phrase_matches = 0
        for phrase in phrases:
            if phrase.lower() in verse_txt:
                phrase_matches += 1
                score += 5.0
                c.match_evidence.append({'type': 'phrase_match', 'value': phrase})
                
        # 2. Exact Lexical Overlap
        exact_match_count = 0
        for term in exact_terms:
            if term.lower() in normalized_tokens:
                exact_match_count += 1
                score += 2.0
                
        if exact_match_count == len(exact_terms) and len(exact_terms) > 1:
            score += 3.0  # All terms matched
            
        # 3. Channel weights
        if 'lexical' in c.channel_ranks:
            score += 3.0
        if 'lemma' in c.channel_ranks:
            score += 2.0
        if 'embedding' in c.channel_ranks:
            # channel score is already a cosine similarity in [0, 1] (1.0 - distance),
            # so closer matches (higher similarity) must receive the larger bonus.
            sim = c.channel_scores.get('embedding', 0.0)
            score += sim * 5.0
        if 'verse_semantic' in c.channel_ranks:
            # Verse-to-verse cosine similarity in [0, 1]; strongest semantic signal.
            sim = c.channel_scores.get('verse_semantic', 0.0)
            score += sim * 6.0

        if 'root' in c.channel_ranks and not any(k in c.channel_ranks for k in ['lexical', 'lemma', 'embedding', 'verse_semantic']):
            # Penalty for root-only matches to reduce semantic drift
            score *= 0.5
            
        c.final_score = round(score, 4)
        c.match_evidence = dedupe_evidence(c.match_evidence)
        
    return sorted(candidates, key=lambda c: (-c.final_score, c.suraid, c.verse_num))

def dedupe_evidence(evidence: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for e in evidence:
        key = str(sorted(e.items()))
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique
