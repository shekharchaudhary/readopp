-- Resume builder: when the source document is a resume/CV we keep the
-- structured ResumeDoc (contact, experience, skills, …) alongside the
-- rendered carousel so the single-page résumé PDF can be re-rendered on
-- demand. Null for every non-resume explainer.
alter table public.explainers
  add column if not exists resume_doc jsonb;
