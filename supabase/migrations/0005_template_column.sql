-- Templates feature: each explainer can be rendered with a different
-- visual identity at export time. Null = the original "tachyon" look
-- (kept as the implicit default so existing rows render unchanged).
alter table public.explainers
  add column if not exists template text;
