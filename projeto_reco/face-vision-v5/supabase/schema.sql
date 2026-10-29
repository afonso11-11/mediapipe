-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.face_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 40),
  signature jsonb NOT NULL CHECK (jsonb_typeof(signature) = 'array'::text AND jsonb_array_length(signature) = 306),
  samples integer NOT NULL DEFAULT 1,
  consent boolean NOT NULL DEFAULT false CHECK (consent = true),
  consent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT face_registry_pkey PRIMARY KEY (id),
  CONSTRAINT face_registry_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
