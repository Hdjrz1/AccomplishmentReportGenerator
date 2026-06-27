# Accomplishment Report Builder (ARB)

A local web app that scans your Git repositories, drafts accomplishment report content from your commits and file changes, and exports a formatted **Word (.docx)** report.

**ARB · Build • Track • Report • Achieve**

---

## Prerequisites

Before you start, make sure you have:

| Requirement | Why |
|-------------|-----|
| **Node.js** (v18 or newer recommended) | Runs the local server and generates DOCX files |
| **Git** installed and available in your PATH | Reads commit history and diffs from your repos |

The app ships with two **Word templates** in `template/`:

- **Default (5-section)** — `default-template.docx` (see `template/default-template.md`)
- **ACTS Colleges (Extended)** — `acts-template.docx` (official ACTS Colleges Word layout; see `template/acts-template.md`)

Choose the template in the report editor before generating. You do not need to add your own template before generating reports.

The app works on **Windows** (primary target). It may run on macOS/Linux if Git and Node are installed.

**Fully offline after install:** fonts (Plus Jakarta Sans, Playfair Display) and icons (Font Awesome) are bundled under `assets/` — no Google Fonts or CDN requests at runtime. Internet is only needed for the initial `git clone` and `npm install`.

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Hdjrz1/AccomplishmentReportGenerator.git
   cd AccomplishmentReportGenerator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **(Optional) Configure paths** in `config.json`:

   ```json
   {
     "system_dirs": [],
     "output_dir": "%USERPROFILE%\\Documents\\Accomplishment Reports"
   }
   ```

   - **`output_dir`** — where generated reports are saved (default: `Documents\Accomplishment Reports`)
   - **`system_dirs`** — optional default project folders (usually set through Settings in the app)

4. **(Optional) Customize the report layout** — see `template/default-template.md` for section structure. The bundled `template/default-template.docx` is used automatically. To rebuild the base shell after changes, run:

   ```bash
   node template/build-default-template.js
   ```

---

## Running the App

Start the local server:

```bash
npm start
```

Or:

```bash
node server.js
```

Open your browser at:

**http://localhost:8000**

To use a different port:

```bash
set PORT=3000
node server.js
```

> **Alternative:** You can also serve `index.php` through PHP (e.g. Laragon or XAMPP). The recommended setup is the Node server above.

---

## First-Time Setup

On first launch, a **Quick Setup** wizard opens. You can reopen it anytime from **Settings** (gear icon in the header).

### Step 1 — Profile

- **Developer Name** — e.g. `Last Name, First Name`
- **Job Title** — e.g. `Software Developer`
- **Default Project Title** — e.g. `Internal Systems`

### Step 2 — Git Identity

- **Git Username** — the author name that appears in your commit history (e.g. `Hdjrz1`)
- Click **Detect** to read it from your global Git config
- **Work to Include**
  - **Commits + Uncommitted** — committed work and local uncommitted changes
  - **Commits Only** — committed history only
  - **Uncommitted Only** — current working tree changes only

### Step 3 — Folders

In **Settings → Step 3: Project folders**:

1. Click **Choose folder on this PC** to pick where your Git projects live (e.g. `C:\laragon\www`, `C:\ACTS SYSTEM`, or `%USERPROFILE%\source\repos`).
2. Or expand **Or paste a folder path manually** if browse does not give the full path.

ARB **recursively scans** up to 4 folder levels deep, so nested repos like `C:\Projects\client\my-app` are found automatically.

Click **Finish Setup** when done. Your profile and project folders are saved in the browser (`localStorage`).

---

## How to Use (Daily Workflow)

### 1. Set the date range (sidebar)

Use quick presets or pick custom dates:

- **Today**
- **This week**
- **This month**
- **Last 30 days**

Or set **Since** and **Until** manually.

### 2. Select repositories (sidebar)

- Repositories are discovered from your configured folders
- Use **Search repositories…** when you have many repos
- Check individual repos or use **Select All Repositories**

### 3. Fetch Git logs

Click **Fetch Git Logs** in the sidebar.

The app will:

- Pull commits for the selected date range and Git username
- Include uncommitted file changes (based on your work mode)
- Build draft report sections automatically

The main workspace opens after a successful fetch.

### 4. Review commits

In **Git Commits Checklist**:

- Uncheck commits you do not want in the report
- Use **Toggle All Commits** to select or clear everything

### 5. Edit report sections

Review and edit the draft in **Report Sections Draft**:

1. **Executive Summary**
2. **Key Accomplishments & Technical Enhancements** (one bullet per line)
3. **Detailed File Adjustments & Code Changes** (table; edit file rows as needed)
4. **Impact and Verification** (one bullet per line)
5. **Verification Status**

**Tips:**

- Use **Regenerate** on Executive Summary or Impact sections to rebuild text from selected commits
- For file changes, switch **View** between **Full**, **Compact**, and **Summary Only**
- Large file lists are paginated in the table

### 6. Generate the DOCX

Choose **Report Template** in the export section:

- **Default (5-section)** — standard executive summary, accomplishments, file changes, impact, and verification
- **ACTS Colleges (Extended)** — institutional layout with objectives, module breakdown, deliverables, testing tables, and more (extended sections are auto-derived from your report data)

When using the ACTS template, fill in **Environment**, **System Phase**, and **Status** if needed.

When you are ready, use the sticky bar at the bottom:

**Generate DOCX Report**

The file is saved to your output folder, named like:

`Accomplishment Report - <date-range>.docx`

A success toast shows the full path. Open the file in Microsoft Word or compatible apps.

---

## Settings & Theme

- **Settings** (header) — reopen the setup wizard to change profile, Git username, work mode, or scan folders
- **Theme toggle** (sun/moon) — switch between dark and light mode; your choice is remembered

---

## Project Structure

```
├── index.php          # UI markup (served by Node; full PHP backend also available)
├── server.js          # Node HTTP server and API
├── generator.js       # DOCX generation logic
├── config.js          # Path helpers and config loading
├── config.json        # Default folders and output directory
├── template/
│   ├── default-template.md   # Default report layout specification
│   ├── default-template.docx # Default Word shell used on generate
│   ├── acts-template.md      # ACTS Colleges extended layout specification
│   ├── acts-template.docx    # ACTS Word shell used on generate
│   └── build-default-template.js
├── js/app.js          # Frontend workflow
├── css/
│   ├── style.css      # Styles and themes
│   └── fonts-local.css # Self-hosted web fonts
├── scripts/
│   └── sync-vendor-assets.js # Copies fonts/icons into assets/ (runs on npm install)
└── assets/
    ├── arb-logo.png
    ├── fonts/         # Plus Jakarta Sans + Playfair Display (.woff2)
    └── vendor/fontawesome/  # Font Awesome CSS + webfonts
```

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| No repositories listed | Open **Settings** and add a parent folder that contains git repos (directly or nested up to 4 levels) |
| Fetch returns no commits | Confirm your **Git Username** matches commit author names; widen the date range |
| “No template” / generation fails | Run `node template/build-default-template.js` to recreate `template/default-template.docx` |
| Browse folder does nothing | Use Chrome or Edge; or paste the folder path manually |
| Port already in use | Run `set PORT=8080` then `node server.js` |
| Git not found | Install Git and ensure `git` works in a new terminal |

---

## Development

```bash
npm install
npm start
```

After changing CSS or JS, hard-refresh the browser (`Ctrl+F5`) to avoid cached assets.

---

## License

ISC
