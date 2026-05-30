import type { JobErrorReason } from "./shared/schemas";

export interface FailureCopy {
  title: string;
  hint: string;
}

const COPY: Record<JobErrorReason, FailureCopy> = {
  invalid_url: {
    title: "That URL didn’t look right.",
    hint: "Make sure it starts with http:// or https:// and points to a public article.",
  },
  fetch_failed: {
    title: "The page couldn’t be fetched.",
    hint: "It may have moved, returned an error, or be blocking automated fetches.",
  },
  paywalled: {
    title: "This article is behind a paywall.",
    hint: "Readopp only reads what an anonymous visitor can see. Try a non-paywalled source.",
  },
  login_required: {
    title: "This page needs a login.",
    hint: "Readopp can’t sign in. Try a publicly-readable version of the article.",
  },
  empty_content: {
    title: "There wasn’t enough text to explain.",
    hint: "The page may be mostly media, navigation, or a stub. Try a longer article.",
  },
  comprehension_failed: {
    title: "The pipeline couldn’t understand the article.",
    hint: "This happens occasionally on very unusual layouts. A retry usually works.",
  },
  render_failed: {
    title: "The pipeline couldn’t render the panels.",
    hint: "A retry usually works. If it keeps happening, try a simpler article.",
  },
  timeout: {
    title: "It took too long.",
    hint: "The article fetch or a model call timed out. Try again.",
  },
  unknown: {
    title: "Something went wrong.",
    hint: "Try again. If it keeps failing, the API key or the chosen model may be the issue.",
  },
};

export function failureCopy(reason: JobErrorReason | string): FailureCopy {
  return COPY[reason as JobErrorReason] ?? COPY.unknown;
}
