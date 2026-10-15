package api

import "testing"

func TestCompareStatusMapping(t *testing.T) {
	// Every pair, including identical custom answers, must follow the same
	// mapping for either role. Same concrete answers are still not decided.
	for _, a := range []string{"a", "b", "c", "other", "unsure"} {
		for _, b := range []string{"a", "b", "c", "other", "unsure"} {
			t.Run(a+"_"+b, func(t *testing.T) {
				c := newClient(t)
				owner := c.createSalon()
				c.expect("PUT", "/api/project/cards", owner, map[string]any{"cardIds": []string{"booking"}}, 200)
				invite := c.lock(owner)
				c.expect("PUT", "/api/answers", owner, answerBody("booking", a, "same custom text"), 200)
				c.expect("PUT", "/api/answers", invite, answerBody("booking", b, "same custom text"), 200)
				c.expect("POST", "/api/answers/submit", invite, nil, 200)
				before := c.expect("GET", "/api/session", owner, nil, 200)
				if before["stage"] != "answering" || before["compare"] != nil || before["counts"] != nil {
					t.Fatal("premature reveal")
				}
				c.expect("POST", "/api/answers/submit", owner, nil, 200)
				want, bucket := "needs_discussion", "discussion"
				if a == "other" || b == "other" || a == "unsure" || b == "unsure" {
					want, bucket = "needs_clarification", "clarification"
				} else if a == b {
					want, bucket = "same_answer", "same"
				}
				for _, token := range []string{owner, invite} {
					s := c.expect("GET", "/api/session", token, nil, 200)
					comparison := s["compare"].([]any)[0].(map[string]any)
					if s["stage"] != "compare" || comparison["status"] != want || comparison["cardId"] != "booking" {
						t.Fatalf("unexpected compare: %v", s)
					}
					counts := s["counts"].(map[string]any)
					if counts["decided"] != float64(0) || counts["total"] != float64(1) || counts[bucket] != float64(1) {
						t.Fatalf("counts = %v", counts)
					}
				}
			})
		}
	}
}
