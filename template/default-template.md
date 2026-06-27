# Default Accomplishment Report Template (v3)

Professional **5-section** Word layout — Gitmore / CodePulse hybrid design.  
Built by `template/default-docx.js` and copied into `default-template.docx` on generate.

---

## Design System

| Token | Value | Usage |
|-------|-------|--------|
| Navy | `#002060` | Banner, headings, table headers |
| Accent | `#0078A8` | Section numbers, callout border, header date |
| Status green | `#1E7D4E` | Overall status line |
| Label fill | `#E8EEF7` | Metadata label column |
| Callout fill | `#F4F7FB` | Executive summary box |
| Body muted | `#44546A` | Subtitles, footer, job title |
| Alt row | `#F8FAFC` | Zebra striping |

**Fonts:** Calibri (body), Consolas (file paths)

---

## Cover Banner

Full-width navy table with white text:

- **DAILY ACCOMPLISHMENT REPORT**
- **{Project Title}**
- **{Reporting Period}**

---

## Status Line

**Overall Status:** `On Track / For Review` (green)

---

## Metadata & Git Metrics Table

| Label | Value |
|-------|--------|
| Developer Name | `{developer_name}` |
| Role / Department | `{job_title}` |
| Reporting Period | `{date_range_text}` |
| Project Title | `{project_title}` |
| Branch / Repository | `{branches_text}` |
| Report Generated | `{generated_date}` |
| Commits Selected | `{commit_count}` |
| Files Modified | `{file_count}` |
| Repositories | `{repo_count}` |

---

## Sections

### [1] Executive Summary
Shaded callout box with accent left border.

### [2] Key Accomplishments & Technical Enhancements
Grouped bullets:
- **Features & Improvements**
- **Bug Fixes**
- **Technical / Infrastructure**

### [3] Detailed File & Commit Activity
- Git activity summary table (commits, files, repos)
- File adjustments table (zebra rows, monospace paths)

### [4] Impact and Verification
Bulleted verification items.

### [5] Verification Status
Paragraph + dual-column signature:

| Prepared By | Date Submitted |
|-------------|----------------|
| `{developer_name}` | `{generated_date}` |
| `{job_title}` | *Submitted for technical review.* |

---

## Header (every page)

`{Project Title} · Accomplishment Report · {Period}`

---

## Footer (every page)

`{Project Title} · Page {n}`

---

## Customization

- **Layout code:** `template/default-docx.js`
- **Rebuild shell:** `node template/build-default-template.js`
- **Metrics:** sent automatically from the app on generate
