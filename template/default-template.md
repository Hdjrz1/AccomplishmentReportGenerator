# Default Accomplishment Report Template

This file defines the **default Word report layout** used by Accomplishment Report Builder (ARB).  
The app copies `default-template.docx` from this folder as the document shell, then fills it with your fetched Git data.

---

## Document Title Block

| Element | Style |
|---------|--------|
| **DAILY ACCOMPLISHMENT REPORT** | Arial, bold, 14pt (28 half-points), centered feel |
| **{Project Title} Development** | Arial, 11pt (22 half-points) |

---

## Metadata Table

Two-column table with borders.

| Label (navy header `#002060` on light blue `#C7DAF1`) | Value |
|--------------------------------------------------------|--------|
| Developer Name | `{developer_name}` |
| Date of Report | `{date_range_text}` |
| Project Title | `{project_title}` |
| Branch / Repository | `{branches_text}` |

---

## Section 1 — Executive Summary

**Heading:** `1. Executive Summary` (Arial bold, 12pt)

**Body:** Multi-paragraph text from `{executive_summary}`.

---

## Section 2 — Key Accomplishments & Technical Enhancements

**Heading:** `2. Key Accomplishments & Technical Enhancements`

**Body:** Bulleted list from `{key_accomplishments}`.

Each line supports optional **Title: detail** formatting (title in bold).

Example:

```
API Integration: Connected payment gateway endpoints.
UI Polish: Refined sidebar spacing and dark mode transitions.
```

---

## Section 3 — Detailed File Adjustments & Code Changes

**Heading:** `3. Detailed File Adjustments & Code Changes`

**Body:** Table with navy header row (`#002060`, white text).

| File Affected | Modifications Made |
|---------------|-------------------|
| `{file_path}` | Bullet list of changes |

Populated from `{detailed_files}`. View modes in the app (Full / Compact / Summary Only) control how much detail is exported.

---

## Section 4 — Impact and Verification

**Heading:** `4. Impact and Verification`

**Body:** Bulleted list from `{impact_verification}` (same **Title: detail** format as Section 2).

---

## Section 5 — Verification Status

**Heading:** `5. Verification Status`

**Body:** Paragraph from `{verification_status}`.

---

## Signature Block

```
Prepared By:

{developer_name}   (bold)
{job_title}
```

---

## Output File Naming

Generated reports are saved to the configured output folder as:

`Accomplishment Report - {date_range_text}.docx`

Invalid filename characters in the date range are replaced with `-`.

---

## Customization

- **Layout & styles:** Edit `default-template.docx` in this folder (Word styles, margins, fonts). Re-run `node template/build-default-template.js` only if you delete the `.docx` and need to regenerate the base shell.
- **Section content:** Edited in the app before clicking **Generate DOCX Report**.
- **This markdown file** is the source of truth for section order and placeholders; keep it in sync if you change the generator.
