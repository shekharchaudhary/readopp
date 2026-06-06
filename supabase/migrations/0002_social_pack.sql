-- Phase 8 week 1 — caption + hashtag generator.
-- Adds a column to persist the SocialPack produced by the new "social"
-- agent step. JSON blob keeps the schema flexible while the shape
-- stabilises; we'll normalise if it ever matters for queries.

alter table public.explainers
  add column if not exists social_pack jsonb;
