-- Infrastructure only; business tables will follow once the domain is defined.
CREATE TABLE app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_metadata (key, value) VALUES ('application', 'soundpark');
