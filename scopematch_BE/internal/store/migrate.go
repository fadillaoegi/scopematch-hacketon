package store

// schema is applied on every start; every statement is idempotent.
// Stage is derived from these rows, never stored.
const schema = `
CREATE TABLE IF NOT EXISTS projects (
	id              TEXT PRIMARY KEY,
	name            TEXT NOT NULL,
	freelancer_name TEXT NOT NULL,
	client_name     TEXT NOT NULL,
	brief           TEXT NOT NULL,
	locked_at       TEXT,
	agreed_version  INTEGER,
	created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_tokens (
	token_hash TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES projects(id),
	role       TEXT NOT NULL CHECK (role IN ('owner', 'client')),
	UNIQUE (project_id, role)
);

CREATE TABLE IF NOT EXISTS project_cards (
	project_id TEXT NOT NULL REFERENCES projects(id),
	card_id    TEXT NOT NULL,
	position   INTEGER NOT NULL,
	PRIMARY KEY (project_id, card_id)
);

CREATE TABLE IF NOT EXISTS participants (
	project_id   TEXT NOT NULL REFERENCES projects(id),
	role         TEXT NOT NULL CHECK (role IN ('owner', 'client')),
	submitted_at TEXT,
	PRIMARY KEY (project_id, role)
);

CREATE TABLE IF NOT EXISTS answers (
	project_id  TEXT NOT NULL REFERENCES projects(id),
	role        TEXT NOT NULL CHECK (role IN ('owner', 'client')),
	card_id     TEXT NOT NULL,
	option_id   TEXT NOT NULL,
	custom_text TEXT,
	updated_at  TEXT NOT NULL,
	PRIMARY KEY (project_id, role, card_id)
);

CREATE TABLE IF NOT EXISTS proposals (
	id                     TEXT PRIMARY KEY,
	project_id             TEXT NOT NULL REFERENCES projects(id),
	card_id                TEXT NOT NULL,
	proposed_by            TEXT NOT NULL CHECK (proposed_by IN ('owner', 'client', 'system')),
	option_id              TEXT,
	custom_text            TEXT,
	why                    TEXT,
	active                 INTEGER NOT NULL,
	confirmed_by_owner_at  TEXT,
	confirmed_by_client_at TEXT,
	created_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS proposals_by_card ON proposals (project_id, card_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_proposal ON proposals(project_id, card_id) WHERE active = 1;

-- Upgrade projects revealed before proposals were implemented. Never recreate
-- a cancelled proposal or carry over confirmations from a replaced decision.
INSERT INTO proposals (id, project_id, card_id, proposed_by, option_id, active, created_at)
SELECT lower(hex(randomblob(16))), a.project_id, a.card_id, 'system', a.option_id, 1, a.updated_at
FROM answers a JOIN answers b ON a.project_id=b.project_id AND a.card_id=b.card_id
WHERE a.role='owner' AND b.role='client' AND a.option_id=b.option_id
AND a.option_id NOT IN ('other','unsure')
AND (SELECT count(*) FROM participants p WHERE p.project_id=a.project_id AND p.submitted_at IS NOT NULL)=2
AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.project_id=a.project_id AND p.card_id=a.card_id);

CREATE TABLE IF NOT EXISTS scope_versions (
	project_id          TEXT NOT NULL REFERENCES projects(id),
	version             INTEGER NOT NULL,
	summary_json        TEXT NOT NULL,
	created_at          TEXT NOT NULL,
	owner_confirm_name  TEXT,
	owner_confirmed_at  TEXT,
	client_confirm_name TEXT,
	client_confirmed_at TEXT,
	PRIMARY KEY (project_id, version)
);
`
