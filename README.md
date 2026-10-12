# ResumeIQ — AI Resume Analyzer

A lightweight, browser-based tool that compares resume text with a target job description and gives practical resume-improvement guidance.

## Current capabilities

- Compares terms found in a job description against resume text.
- Highlights overlapping terms and possible missing keywords.
- Estimates skill alignment using a small built-in list of common skills.
- Checks for common resume sections and action-oriented experience language.
- Offers suggestions for clearer, more measurable resume bullets.
- Runs locally in the browser; resume and job-description text are not sent to an AI provider by this version.

## Important limitations

- Scores are heuristic indicators for guidance, **not official ATS scores, hiring predictions, or AI-generated assessments**.
- Keyword overlap cannot understand context, synonyms, seniority, or the quality of a candidate's work.
- The current login/signup flow is a demo and is not production authentication.
- Do not treat the results as a hiring decision. Verify every suggestion and only include truthful skills and experience.

## Run locally

This version is a static HTML app. Open `resume-analyzer.html` in a modern browser. An internet connection may be needed for the externally hosted fonts; analysis itself is local.

## Tests

Requires Node.js 18 or newer.

```bash
npm test
```

The test suite uses Node's built-in test runner and does not require paid APIs or third-party packages.

## Next engineering steps

1. Expand test coverage and refactor the scoring algorithm into a separate, testable module.
2. Add a backend only when needed for secure AI-powered analysis; keep provider keys server-side.
3. Replace demo authentication with a secure authentication provider and persistent user data.
4. Add accessibility checks, deployment instructions, and CI.
