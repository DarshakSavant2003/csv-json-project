CREATE TABLE public.users (
  id serial PRIMARY KEY,
  "name" varchar NOT NULL,
  age int4 NOT NULL,
  address jsonb NULL,
  additional_info jsonb NULL
);
