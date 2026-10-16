// Package domain contains persistence-neutral records shared by the use cases
// and their adapters. It has no dependency on SQL, HTTP, or application code.
package domain

import "errors"

var ErrNotFound = errors.New("not found")

type Project struct {
	ID             string
	Name           string
	FreelancerName string
	ClientName     string
	Brief          string
	LockedAt       string
	AgreedVersion  int
	CreatedAt      string
}

type Answer struct {
	CardID     string `json:"cardId"`
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText,omitempty"`
}

type Proposal struct {
	ID         string `json:"id"`
	CardID     string `json:"cardId"`
	ProposedBy string `json:"proposedBy"`
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText,omitempty"`
	Why        string `json:"why,omitempty"`
	OwnerAt    string `json:"ownerConfirmedAt,omitempty"`
	ClientAt   string `json:"clientConfirmedAt,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

func (p Proposal) Decided() bool { return p.OwnerAt != "" && p.ClientAt != "" }

// VersionRecord holds the saved snapshot and confirmation records. Its JSON
// payload is encoded by the application; SQL nullability stays in the adapter.
type VersionRecord struct {
	Number       int
	SnapshotJSON string
	CreatedAt    string
	OwnerName    string
	OwnerAt      string
	ClientName   string
	ClientAt     string
}

// CustomCardRecord is a project-specific question (for example one suggested
// by AI and accepted by the freelancer). CardJSON holds the card exactly as
// accepted; the use case layer owns its shape and validation.
type CustomCardRecord struct {
	CardID    string
	CardJSON  string
	CreatedAt string
}
