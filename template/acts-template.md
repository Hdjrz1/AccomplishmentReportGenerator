# ACTS Colleges Extended Accomplishment Report Template

This file defines the **ACTS Colleges extended Word report layout** used when `template_id` is `acts`.

The app uses the bundled `acts-template.docx` — the official ACTS Colleges accomplishment report Word layout (headers, footers, styles, margins, and table formatting). Content is generated into that shell at report time.

---

## Template File

Place the official ACTS layout at:

`template/acts-template.docx`

The bundled file is based on the ACTS Colleges Student Portal accomplishment report format. To replace it, copy your updated `.docx` over `acts-template.docx` (keep the same filename).

---

## Document Title Block

| Element | Style |
|---------|--------|
| `{project_title} \| Accomplishment Report` | Arial, bold, 12pt |
| `{project_title} \| {date_range_text} Accomplishment Report` | Arial, 11pt |
| **DAILY ACCOMPLISHMENT REPORT** | Arial, bold, 14pt |
| `{project_title}` | Arial, 11pt |

---

## Extended Metadata

Label/value lines (not a bordered table):

| Label | Placeholder |
|-------|-------------|
| Date | `{date_range_text}` |
| Prepared by | `{developer_name}` |
| Environment | `{acts_environment}` |
| Role / Department | `{job_title}` |
| System Phase | `{acts_system_phase}` |
| Status | `{acts_status}` |
| Source Folder | `{branches_text}` |

---

## Sections

1. **Executive Summary** — from `{executive_summary}`
2. **Objectives** — table (#, Objective, Status); derived from key accomplishments
3. **Key Accomplishments & Features Completed** — from `{key_accomplishments}`
4. **Detailed Module Breakdown** — from `{detailed_files}` (Area / Files / Purpose)
5. **Critical Fixes and Improvements Delivered** — derived from impact verification
6. **Technical Outcomes** — derived from file/commit stats
7. **Testing and Validation Performed / Required** — derived from verification status
8. **Deliverables** — derived from detailed files
9. **Impact** — from `{impact_verification}`
10. **Follow-up / Remaining Work** — derived from verification status
11. **Summary Statement** — condensed from executive summary

---

## Signature Block

```
Prepared by:

{developer_name}   (bold)
{job_title}
```

---

## Output File Naming

Same as default: `Accomplishment Report - {date_range_text}.docx`

---

## Customization

- **Layout & styles:** Replace `acts-template.docx` with your official ACTS Word layout file. The generator preserves headers, footers, page setup, and Word styles from that file.
- **Section content:** Edited in the app before clicking **Generate DOCX Report** (core sections). Extended ACTS sections are auto-derived at generate time.
