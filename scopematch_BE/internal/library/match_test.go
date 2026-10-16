package library

import (
	"reflect"
	"testing"
	"unicode/utf16"
)

const salonBrief = "We need a salon website with booking, two languages, and editable content."

func TestSalonBriefMatchesCards(t *testing.T) {
	m := MatchBrief(salonBrief)
	want := map[string]string{"booking": "booking", "languages": "two languages", "editable": "editable content"}
	for id, phrase := range want {
		got, ok := m[id]
		if !ok {
			t.Fatalf("card %s not matched", id)
		}
		if got.Phrase != phrase {
			t.Errorf("card %s phrase = %q, want %q", id, got.Phrase, phrase)
		}
		if got.Sentence != salonBrief {
			t.Errorf("card %s sentence = %q", id, got.Sentence)
		}
		if salonBrief[got.Start:got.End] != phrase {
			t.Errorf("card %s offsets [%d:%d] = %q", id, got.Start, got.End, salonBrief[got.Start:got.End])
		}
	}
	if got := Suggested(salonBrief); !reflect.DeepEqual(got, []string{"booking", "languages", "editable", "launch-content"}) {
		t.Errorf("Suggested = %v", got)
	}
}

func TestNoMatchSuggestsOnlyLaunchContent(t *testing.T) {
	brief := "A simple landing page for my bakery."
	if m := MatchBrief(brief); len(m) != 0 {
		t.Errorf("unexpected matches: %v", m)
	}
	if got := Suggested(brief); !reflect.DeepEqual(got, []string{"launch-content"}) {
		t.Errorf("Suggested = %v", got)
	}
}

func TestWholeWordsOnly(t *testing.T) {
	// "bookkeeping" must not match "book"; "editor" must not match "edit".
	if m := MatchBrief("Help with bookkeeping and an editor."); len(m) != 0 {
		t.Errorf("unexpected matches: %v", m)
	}
}

func TestOffsetsAreUTF16(t *testing.T) {
	brief := "Salon “Cantik” 💇 needs booking."
	m := MatchBrief(brief)["booking"]
	units := utf16.Encode([]rune(brief))
	if got := string(utf16.Decode(units[m.Start:m.End])); got != "booking" {
		t.Errorf("utf16 slice = %q", got)
	}
}

func TestSentenceAround(t *testing.T) {
	brief := "Hi! We want a site. Customers should book online.\nThanks"
	m := MatchBrief(brief)["booking"]
	if m.Sentence != "Customers should book online." {
		t.Errorf("sentence = %q", m.Sentence)
	}
}

func TestNewCardsCoverShopAndServiceBriefs(t *testing.T) {
	cases := map[string][]string{
		// Previously matched only launch content.
		"Online store for handmade batik. Customers pick a product, pay, and we ship it. We need photos of every product.": {"launch-content", "payments", "delivery"},
		"A site for my bakery with a contact form, and please handle the domain and hosting.":                              {"launch-content", "contact", "hosting"},
	}
	for brief, want := range cases {
		if got := Suggested(brief); !reflect.DeepEqual(got, want) {
			t.Errorf("Suggested(%q) = %v, want %v", brief, got, want)
		}
	}
}

func TestNewKeywordsAreWholeWords(t *testing.T) {
	// "membership", "paypal", "ghost", "contacts" must not trigger the new cards.
	if m := MatchBrief("A membership page with PayPal-free ghost stories."); len(m) != 0 {
		t.Errorf("unexpected matches: %v", m)
	}
}
