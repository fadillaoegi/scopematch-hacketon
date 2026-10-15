package library

import (
	"strings"
	"unicode"
	"unicode/utf16"
)

// Match is where a card's keyword was found in the brief. Start and End are
// UTF-16 offsets so the frontend can slice the brief string directly.
type Match struct {
	CardID   string `json:"cardId"`
	Phrase   string `json:"phrase"`
	Start    int    `json:"start"`
	End      int    `json:"end"`
	Sentence string `json:"sentence"`
}

// MatchBrief finds, for each card, the first whole-word occurrence of its
// most specific keyword. Matches never overlap: a span already claimed by an
// earlier card is skipped.
func MatchBrief(brief string) map[string]Match {
	runes := []rune(brief)
	lower := make([]rune, len(runes))
	for i, r := range runes {
		lower[i] = unicode.ToLower(r)
	}

	type span struct{ start, end int }
	var claimed []span
	overlaps := func(s, e int) bool {
		for _, c := range claimed {
			if s < c.end && c.start < e {
				return true
			}
		}
		return false
	}

	out := map[string]Match{}
	for _, card := range cards {
	keywords:
		for _, kw := range card.Keywords {
			k := []rune(strings.ToLower(kw))
			for from := 0; ; {
				i := indexRunes(lower, k, from)
				if i < 0 {
					break
				}
				end := i + len(k)
				from = i + 1
				if !isBoundary(lower, i-1) || !isBoundary(lower, end) || overlaps(i, end) {
					continue
				}
				claimed = append(claimed, span{i, end})
				out[card.ID] = Match{
					CardID:   card.ID,
					Phrase:   string(runes[i:end]),
					Start:    utf16Len(runes[:i]),
					End:      utf16Len(runes[:end]),
					Sentence: sentenceAround(runes, i, end),
				}
				break keywords
			}
		}
	}
	return out
}

// Suggested returns the ids of cards to pre-select for a brief, in library
// order: every matched card plus cards marked alwaysSuggest.
func Suggested(brief string) []string {
	m := MatchBrief(brief)
	var ids []string
	for _, c := range cards {
		if _, ok := m[c.ID]; ok || c.AlwaysSuggest {
			ids = append(ids, c.ID)
		}
	}
	return ids
}

func indexRunes(s, sub []rune, from int) int {
	for i := from; i+len(sub) <= len(s); i++ {
		match := true
		for j := range sub {
			if s[i+j] != sub[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

func isBoundary(s []rune, i int) bool {
	if i < 0 || i >= len(s) {
		return true
	}
	r := s[i]
	return !unicode.IsLetter(r) && !unicode.IsDigit(r)
}

func isSentenceEnd(r rune) bool { return r == '.' || r == '!' || r == '?' || r == '\n' }

func sentenceAround(runes []rune, start, end int) string {
	s := start
	for s > 0 && !isSentenceEnd(runes[s-1]) {
		s--
	}
	e := end
	for e < len(runes) && !isSentenceEnd(runes[e]) {
		e++
	}
	if e < len(runes) && runes[e] != '\n' {
		e++ // keep the sentence's own punctuation
	}
	return strings.TrimSpace(string(runes[s:e]))
}

func utf16Len(rs []rune) int { return len(utf16.Encode(rs)) }
