CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  login text NOT NULL UNIQUE,
  password_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (code, name) VALUES ('admin', 'Администратор');

CREATE TABLE helpers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL UNIQUE,
  phone text,
  comment text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(full_name) <> ''),
  CHECK (phone IS NULL OR btrim(phone) <> '')
);

CREATE TABLE work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  event_name text,
  venue text,
  filled_by_name text NOT NULL,
  filled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  transport text,
  light_amount numeric(12, 2),
  sound_amount numeric(12, 2),
  structures_amount numeric(12, 2),
  total_amount numeric(12, 2) GENERATED ALWAYS AS (
    COALESCE(light_amount, 0) + COALESCE(sound_amount, 0) + COALESCE(structures_amount, 0)
  ) STORED,
  status text NOT NULL DEFAULT 'draft',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(number) <> ''),
  CHECK (ends_on >= starts_on),
  CHECK (status IN ('draft', 'in_progress', 'completed', 'calculated', 'closed')),
  CHECK (light_amount IS NULL OR light_amount >= 0),
  CHECK (sound_amount IS NULL OR sound_amount >= 0),
  CHECK (structures_amount IS NULL OR structures_amount >= 0)
);

CREATE TABLE work_order_helpers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL REFERENCES helpers(id) ON DELETE RESTRICT,
  loading boolean NOT NULL DEFAULT false,
  loading_amount numeric(12, 2),
  unloading boolean NOT NULL DEFAULT false,
  unloading_amount numeric(12, 2),
  installation boolean NOT NULL DEFAULT false,
  installation_amount numeric(12, 2),
  dismantling boolean NOT NULL DEFAULT false,
  dismantling_amount numeric(12, 2),
  flat_rate boolean NOT NULL DEFAULT false,
  flat_rate_amount numeric(12, 2),
  total_amount numeric(12, 2) GENERATED ALWAYS AS (
    COALESCE(loading_amount, 0) + COALESCE(unloading_amount, 0) +
    COALESCE(installation_amount, 0) + COALESCE(dismantling_amount, 0) +
    COALESCE(flat_rate_amount, 0)
  ) STORED,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, helper_id),
  CHECK (loading_amount IS NULL OR (loading AND loading_amount >= 0)),
  CHECK (unloading_amount IS NULL OR (unloading AND unloading_amount >= 0)),
  CHECK (installation_amount IS NULL OR (installation AND installation_amount >= 0)),
  CHECK (dismantling_amount IS NULL OR (dismantling AND dismantling_amount >= 0)),
  CHECK (flat_rate_amount IS NULL OR (flat_rate AND flat_rate_amount >= 0))
);

CREATE INDEX work_orders_period_idx ON work_orders (starts_on, ends_on);
CREATE INDEX work_order_helpers_helper_idx ON work_order_helpers (helper_id);
