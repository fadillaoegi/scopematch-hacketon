// Package library holds the curated scenario cards and the deterministic
// brief matching that suggests them. Nothing here is AI: matching is a
// whole-word search for each card's keywords.
package library

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// Option ids every card accepts in addition to its own options.
const (
	OptionOther  = "other"  // "Something else" — requires custom text
	OptionUnsure = "unsure" // "Not sure yet" — can never become a decision
)

type PreviewStep struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type Option struct {
	ID                     string        `json:"id"`
	Label                  string        `json:"label"`
	Included               []string      `json:"included"`
	Excluded               []string      `json:"excluded"`
	ClientResponsibilities []string      `json:"clientResponsibilities"`
	AcceptanceCriteria     []string      `json:"acceptanceCriteria"`
	Preview                []PreviewStep `json:"preview,omitempty"`
}

type Card struct {
	ID            string   `json:"id"`
	Number        int      `json:"number"`
	Title         string   `json:"title"`
	Question      string   `json:"question"`
	Keywords      []string `json:"keywords"`
	AlwaysSuggest bool     `json:"alwaysSuggest,omitempty"`
	Options       []Option `json:"options"`
}

// Option returns the card's option with the given id, if it is one of the
// card's own options (not "other" or "unsure").
func (c Card) Option(id string) (Option, bool) {
	for _, o := range c.Options {
		if o.ID == id {
			return o, true
		}
	}
	return Option{}, false
}

// ValidAnswer reports whether optionID is selectable on this card.
func (c Card) ValidAnswer(optionID string) bool {
	if optionID == OptionOther || optionID == OptionUnsure {
		return true
	}
	_, ok := c.Option(optionID)
	return ok
}

//go:embed cards.json
var cardsJSON []byte

var cards []Card
var byID = map[string]Card{}

func init() {
	if err := json.Unmarshal(cardsJSON, &cards); err != nil {
		panic(fmt.Sprintf("library: bad cards.json: %v", err))
	}
	for _, c := range cards {
		byID[c.ID] = c
	}
}

// All returns every card in library order.
func All() []Card { return cards }

// Get returns a card by id.
func Get(id string) (Card, bool) {
	c, ok := byID[id]
	return c, ok
}
