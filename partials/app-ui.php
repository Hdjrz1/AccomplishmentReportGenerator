<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ARB Accomplishment Report Builder — generate developer accomplishment reports from Git logs.">
    <title>ARB Accomplishment Report Builder</title>
    <link rel="icon" type="image/png" href="assets/arb-logo.png">
    <link rel="apple-touch-icon" href="assets/arb-logo.png">
    <!-- Self-hosted fonts and icons (fully offline) -->
    <link rel="stylesheet" href="css/fonts-local.css">
    <link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">
    <!-- Custom styling -->
    <link rel="stylesheet" href="css/style.css">
    <script>window.ARG_API_BASE = "";</script>
</head>
<body class="dark-theme">
    <div class="app-container">
        <!-- Sidebar Configuration panel -->
        <aside class="sidebar" id="app-sidebar">
            <div class="brand">
                <div class="brand-logo-wrap brand-logo-wrap--circle">
                    <img src="assets/arb-logo.png" alt="" class="brand-logo" width="64" height="64">
                </div>
                <p class="brand-name">Accomplishment Report Builder</p>
            </div>
            
            <form id="config-form" class="sidebar-form">
                <input type="hidden" id="developer-name">
                <input type="hidden" id="job-title">
                <input type="hidden" id="project-title">

                <div class="sidebar-form-scroll">
                    <div class="form-section sidebar-settings-summary" id="sidebar-settings-summary">
                        <div id="settings-profile-card" class="settings-profile-card">
                            <div id="settings-avatar" class="settings-avatar" aria-hidden="true">?</div>
                            <div class="settings-profile-text">
                                <span id="settings-profile-name" class="settings-profile-name">Your profile</span>
                                <span id="settings-profile-meta" class="settings-profile-meta">Complete setup to begin</span>
                            </div>
                        </div>
                        <div id="settings-summary-content" class="settings-summary-content" hidden></div>
                    </div>

                    <div class="form-section form-section-dates">
                        <h3><i class="fa-solid fa-calendar-days"></i> Date Range</h3>
                        <div class="date-presets" role="group" aria-label="Quick date ranges">
                            <button type="button" class="date-preset-chip" data-preset="today">Today</button>
                            <button type="button" class="date-preset-chip" data-preset="week">This week</button>
                            <button type="button" class="date-preset-chip" data-preset="month">This month</button>
                            <button type="button" class="date-preset-chip" data-preset="last30">Last 30 days</button>
                        </div>
                        <div class="form-group-row">
                            <div class="form-group">
                                <label for="date-since">Since</label>
                                <input type="date" id="date-since" required>
                            </div>
                            <div class="form-group">
                                <label for="date-until">Until</label>
                                <input type="date" id="date-until" required>
                            </div>
                        </div>
                    </div>

                    <div class="form-section form-section-repos">
                        <h3><i class="fa-solid fa-cubes"></i> Select Systems</h3>
                        <div class="repos-list-container">
                            <input type="search" id="repo-search-input" class="repo-search-input" placeholder="Search repositories…" autocomplete="off" spellcheck="false" hidden>
                            <div class="repos-select-all">
                                <label class="checkbox-container">
                                    <input type="checkbox" id="select-all-repos">
                                    <span class="checkmark"></span>
                                    Select All Repositories
                                </label>
                            </div>
                            <div id="repos-checkboxes" class="repos-checkboxes">
                                <div class="loading-spinner-small"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <button type="submit" id="fetch-logs-btn" class="btn btn-primary btn-block">
                    <i class="fa-solid fa-sync"></i> Fetch Git Logs
                </button>
                <p id="last-fetch-hint" class="last-fetch-hint" hidden></p>
            </form>
            
            <div class="sidebar-footer">
                <p>ARB · Build • Track • Report • Achieve</p>
            </div>
        </aside>

        <!-- Main Workspace -->
        <main class="main-content">
            <!-- Header bar -->
            <header class="top-header">
                <div class="header-title">
                    <h1>Accomplishment Report Builder</h1>
                    <p>Pick dates and repos in the sidebar, fetch logs, then generate your report.</p>
                </div>
                <div class="header-status">
                    <button type="button" id="theme-toggle" class="theme-icon-toggle" aria-label="Toggle theme" aria-pressed="true">
                        <span class="theme-icon-track">
                            <i class="fa-solid fa-sun theme-icon theme-icon-sun" aria-hidden="true"></i>
                            <i class="fa-solid fa-moon theme-icon theme-icon-moon" aria-hidden="true"></i>
                        </span>
                    </button>
                    <button type="button" id="settings-btn" class="settings-header-btn" aria-label="Open settings" title="Settings" hidden>
                        <i class="fa-solid fa-gear"></i>
                        <span>Settings</span>
                    </button>
                    <div class="status-badge" id="header-status-badge">
                        <span class="pulse-dot" id="header-status-dot"></span>
                        <span id="header-status-text">Loading…</span>
                    </div>
                </div>
            </header>

            <!-- Working Area -->
            <div class="workspace-area">
                <div id="empty-state" class="empty-state">
                    <div class="empty-icon empty-icon-logo">
                        <img src="assets/arb-logo.png" alt="ARB" class="empty-state-logo" width="160" height="160">
                    </div>
                    <h2>No git data yet</h2>
                    <p id="empty-state-hint" class="empty-state-lead">Set your date range and repositories in the sidebar, then click <strong>Fetch Git Logs</strong>.</p>
                </div>

                <!-- Main editor workspace (hidden until logs are fetched) -->
                <div id="editor-workspace" class="editor-workspace" style="display: none;">
                    
                    <!-- Commits Checklist -->
                    <section class="editor-card">
                        <div class="card-header">
                            <div class="header-left">
                                <i class="fa-solid fa-code-commit text-primary"></i>
                                <h2>Git Commits Checklist</h2>
                            </div>
                            <div class="header-right">
                                <span id="commits-count" class="badge">0 Commits Found</span>
                            </div>
                        </div>
                        <div class="card-body scroll-y max-h-300">
                            <div class="commits-select-all">
                                <label class="checkbox-container">
                                    <input type="checkbox" id="select-all-commits" checked>
                                    <span class="checkmark"></span>
                                    Toggle All Commits
                                </label>
                            </div>
                            <div id="commits-list" class="commits-list">
                                <!-- Populated dynamically by JS -->
                            </div>
                        </div>
                    </section>

                    <!-- Report Content Sections -->
                    <section class="editor-card mt-24" id="report-sections-card">
                        <div class="card-header border-bottom">
                            <div class="header-left">
                                <i class="fa-solid fa-pen-to-square text-success"></i>
                                <h2>Report Sections Draft</h2>
                            </div>
                            <p class="subtitle">Edit the draft below before generating your DOCX.</p>
                        </div>
                        
                        <div class="card-body">
                            <div class="editor-field-group">
                                <div class="field-label-row">
                                    <label class="field-label" for="field-executive-summary">1. Executive Summary</label>
                                    <button type="button" class="btn btn-text btn-regenerate" data-field="executive_summary">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate
                                    </button>
                                </div>
                                <textarea id="field-executive-summary" class="field-textarea" rows="8" placeholder="Brief summary of work done during the period..."></textarea>
                            </div>

                            <div class="editor-field-group mt-24">
                                <label class="field-label" for="field-key-accomplishments">2. Key Accomplishments &amp; Technical Enhancements</label>
                                <textarea id="field-key-accomplishments" class="field-textarea" rows="6" placeholder="Bullet points of accomplishments (one per line, format: 'Title: Detail explanation')"></textarea>
                            </div>

                            <div class="editor-field-group mt-24">
                                <div class="field-header-row field-header-row-stacked">
                                    <label class="field-label">3. Detailed File Adjustments &amp; Code Changes</label>
                                    <div class="field-header-actions">
                                        <div class="file-section-mode" role="radiogroup" aria-label="File section display mode">
                                            <span class="file-section-mode-label">View</span>
                                            <label class="mode-option">
                                                <input type="radio" name="file-section-mode" value="full">
                                                <span>Full</span>
                                            </label>
                                            <label class="mode-option">
                                                <input type="radio" name="file-section-mode" value="compact" checked>
                                                <span>Compact</span>
                                            </label>
                                            <label class="mode-option">
                                                <input type="radio" name="file-section-mode" value="summary">
                                                <span>Summary Only</span>
                                            </label>
                                        </div>
                                        <span class="file-sort-label" id="file-sort-label">Sorted A–Z by file path</span>
                                    </div>
                                </div>
                                
                                <div class="table-container mt-12">
                                    <table class="grid-table" id="file-changes-table">
                                        <thead>
                                            <tr>
                                                <th width="35%">File Affected</th>
                                                <th width="65%">Modifications Made</th>
                                            </tr>
                                        </thead>
                                        <tbody id="file-changes-tbody">
                                        </tbody>
                                    </table>
                                </div>
                                <div class="table-pagination" id="file-table-pagination" hidden>
                                    <span class="pagination-info" id="file-table-pagination-info"></span>
                                    <div class="pagination-controls">
                                        <button type="button" id="file-table-prev" class="btn btn-secondary btn-sm" disabled>
                                            <i class="fa-solid fa-chevron-left"></i> Prev
                                        </button>
                                        <span class="pagination-page-label" id="file-table-page-label">Page 1 of 1</span>
                                        <button type="button" id="file-table-next" class="btn btn-secondary btn-sm" disabled>
                                            Next <i class="fa-solid fa-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="editor-field-group mt-24">
                                <div class="field-label-row">
                                    <label class="field-label" for="field-impact-verification">4. Impact and Verification</label>
                                    <button type="button" class="btn btn-text btn-regenerate" data-field="impact_verification">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate
                                    </button>
                                </div>
                                <textarea id="field-impact-verification" class="field-textarea" rows="4" placeholder="Bullet points of verification metrics/actions (one per line, format: 'Verification Area: Description')"></textarea>
                            </div>

                            <div class="editor-field-group mt-24">
                                <label class="field-label" for="field-verification-status">5. Verification Status</label>
                                <textarea id="field-verification-status" class="field-textarea" rows="3" placeholder="Statements regarding staging deployments, lint checks, build checks..."></textarea>
                            </div>
                        </div>

                        <div class="card-footer card-footer-export border-top">
                            <div class="export-panel">
                                <div class="export-panel-header">
                                    <div class="export-panel-heading">
                                        <span class="export-panel-icon" aria-hidden="true">
                                            <i class="fa-solid fa-file-export"></i>
                                        </span>
                                        <div>
                                            <h3 class="export-panel-title">Export Settings</h3>
                                            <p class="export-panel-subtitle">Choose a template and review output details before generating</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="export-panel-grid">
                                    <div class="export-panel-section">
                                        <h4 class="export-section-label">Report Configuration</h4>
                                        <div class="export-fields">
                                            <div class="export-field">
                                                <label class="export-field-label" for="report-template-select">
                                                    <i class="fa-solid fa-file-lines"></i>
                                                    Report Template
                                                </label>
                                                <div class="export-field-input-wrap">
                                                    <select id="report-template-select" class="report-template-select" aria-label="Report template">
                                                        <option value="default">Default (5-section)</option>
                                                        <option value="acts">ACTS Colleges (Extended)</option>
                                                    </select>
                                                    <i class="fa-solid fa-chevron-down export-select-chevron" aria-hidden="true"></i>
                                                </div>
                                            </div>

                                            <div class="export-field acts-template-meta" id="acts-template-meta" hidden>
                                                <label class="export-field-label" for="acts-environment">
                                                    <i class="fa-solid fa-server"></i>
                                                    ACTS Environment
                                                </label>
                                                <input type="text" id="acts-environment" class="acts-meta-input" placeholder="e.g. Laragon (PHP 8.3, MySQL)">
                                            </div>

                                            <div class="export-field acts-template-meta" hidden>
                                                <label class="export-field-label" for="acts-system-phase">
                                                    <i class="fa-solid fa-layer-group"></i>
                                                    ACTS System Phase
                                                </label>
                                                <input type="text" id="acts-system-phase" class="acts-meta-input" placeholder="e.g. Student Portal Backend, SSOT, Audit">
                                            </div>

                                            <div class="export-field acts-template-meta" hidden>
                                                <label class="export-field-label" for="acts-status">
                                                    <i class="fa-solid fa-circle-check"></i>
                                                    ACTS Status
                                                </label>
                                                <input type="text" id="acts-status" class="acts-meta-input" placeholder="e.g. Completed / For Continued Validation">
                                            </div>
                                        </div>
                                    </div>

                                    <div class="export-panel-section export-panel-section--details">
                                        <h4 class="export-section-label">Output Details</h4>
                                        <div class="export-details">
                                            <div class="export-detail-card">
                                                <span class="export-detail-icon export-detail-icon--branch" aria-hidden="true">
                                                    <i class="fa-solid fa-code-branch"></i>
                                                </span>
                                                <div class="export-detail-content">
                                                    <span class="export-detail-label">Branch / Repository</span>
                                                    <span id="meta-branches-display" class="export-detail-value meta-value">—</span>
                                                </div>
                                            </div>
                                            <div class="export-detail-card">
                                                <span class="export-detail-icon export-detail-icon--folder" aria-hidden="true">
                                                    <i class="fa-solid fa-folder-open"></i>
                                                </span>
                                                <div class="export-detail-content">
                                                    <span class="export-detail-label">Output Directory</span>
                                                    <span id="meta-output-dir" class="export-detail-value export-detail-value--path meta-value">Documents\Accomplishment Reports</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div id="report-output-preview" class="visually-hidden" aria-hidden="true">
                    <span id="preview-filename"></span>
                    <span id="preview-path"></span>
                    <span id="preview-template"></span>
                    <p id="preview-warning" hidden></p>
                    <ul id="preview-sections"></ul>
                </div>

                <div id="sticky-generate-bar" class="sticky-generate-bar" hidden>
                    <div class="sticky-generate-meta">
                        <span id="sticky-filename" class="sticky-filename">—</span>
                        <span id="sticky-commits-meta" class="sticky-commits-meta">0 commits selected</span>
                        <span id="sticky-template-meta" class="sticky-template-meta">Default template</span>
                        <span id="sticky-generate-block-reason" class="sticky-generate-block-reason" hidden></span>
                        <span id="sticky-output-hint" class="sticky-output-hint" hidden></span>
                    </div>
                    <button type="button" id="generate-report-btn" class="btn btn-success btn-lg" disabled>
                        <i class="fa-solid fa-eye"></i> Preview Report
                    </button>
                </div>
            </div>
        </main>
    </div>

    <!-- First-run Setup Wizard -->
    <div id="setup-wizard" class="setup-wizard" hidden>
        <div class="setup-wizard-backdrop"></div>
        <div class="setup-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-wizard-title">
            <div class="setup-wizard-header">
                <img src="assets/arb-logo.png" alt="" class="setup-wizard-logo" width="120" height="120">
                <h2 id="setup-wizard-title">Welcome — Quick Setup</h2>
                <p class="setup-wizard-subtitle">Configure your profile and project folders to get started.</p>
            </div>
            <div class="setup-wizard-steps">
                <span class="setup-step-indicator active" data-step="1">1. Profile</span>
                <span class="setup-step-indicator" data-step="2">2. Git Identity</span>
                <span class="setup-step-indicator" data-step="3">3. Project folders</span>
            </div>
            <div class="setup-wizard-body">
                <div class="setup-step" data-step="1">
                    <div class="form-group">
                        <label for="setup-dev-name">Developer Name</label>
                        <input type="text" id="setup-dev-name" placeholder="Last Name, First Name">
                    </div>
                    <div class="form-group">
                        <label for="setup-job-title">Job Title</label>
                        <input type="text" id="setup-job-title" placeholder="e.g. Software Developer">
                    </div>
                    <div class="form-group">
                        <label for="setup-project-title">Default Project Title</label>
                        <input type="text" id="setup-project-title" placeholder="e.g. Internal Systems">
                    </div>
                </div>
                <div class="setup-step" data-step="2" hidden>
                    <p class="help-text">Enter the git username that appears in your commit history. Use Detect to read from git config.</p>
                    <div class="form-group">
                        <label for="setup-git-author-input">Git Username</label>
                        <div class="git-author-add-row">
                            <input type="text" id="setup-git-author-input" placeholder="e.g. Hdjrz1">
                            <button type="button" id="setup-detect-git-author-btn" class="btn btn-secondary btn-sm" title="Detect from git config">
                                <i class="fa-solid fa-magnifying-glass"></i> Detect
                            </button>
                        </div>
                    </div>
                    <div class="form-group mt-12">
                        <label>Work to Include</label>
                        <div class="work-mode-options" role="radiogroup">
                            <label class="mode-option">
                                <input type="radio" name="setup-work-mode" value="both" checked>
                                <span>Commits + Uncommitted</span>
                            </label>
                            <label class="mode-option">
                                <input type="radio" name="setup-work-mode" value="commits">
                                <span>Commits Only</span>
                            </label>
                            <label class="mode-option">
                                <input type="radio" name="setup-work-mode" value="uncommitted">
                                <span>Uncommitted Only</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="setup-step" data-step="3" hidden>
                    <div class="setup-folders-panel">
                        <h3 class="setup-folders-heading">Where are your Git projects?</h3>
                        <p class="setup-folders-intro help-text">
                            Choose one or more folders on your computer. ARB will scan them and list every Git repository it finds — including nested projects up to 4 levels deep.
                        </p>

                        <div class="setup-folders-block">
                            <span class="setup-section-label">Your project folders</span>
                            <div id="setup-system-dirs-list" class="system-dirs-list setup-folders-list"></div>
                        </div>

                        <div class="setup-folders-add">
                            <button type="button" id="setup-browse-folder-btn" class="btn btn-primary btn-block btn-browse-folder">
                                <i class="fa-solid fa-folder-open" aria-hidden="true"></i> Choose folder on this PC
                            </button>
                            <details class="setup-folders-manual">
                                <summary class="setup-folders-manual-summary">Or paste a folder path manually</summary>
                                <div class="system-dir-add-row">
                                    <input type="text" id="setup-folder-path-input" class="setup-folder-path-input" placeholder="e.g. C:\Projects or C:\laragon\www" autocomplete="off" spellcheck="false">
                                    <button type="button" id="setup-add-folder-path-btn" class="btn btn-secondary">Add folder</button>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
            <div class="setup-wizard-footer">
                <button type="button" id="setup-cancel-btn" class="btn btn-secondary wizard-cancel-btn" hidden>Cancel</button>
                <div class="setup-wizard-footer-actions">
                    <button type="button" id="setup-back-btn" class="btn btn-secondary" hidden>Back</button>
                    <button type="button" id="setup-next-btn" class="btn btn-primary">Next</button>
                    <button type="button" id="setup-finish-btn" class="btn btn-success" hidden>Finish Setup</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Report Generation Loading Screen -->
    <div id="report-loading-overlay" class="report-loading-overlay" hidden aria-live="polite" aria-busy="true" role="alertdialog" aria-labelledby="report-loading-title" aria-describedby="report-loading-subtitle">
        <div class="report-loading-backdrop"></div>
        <div class="report-loading-panel">
            <div class="report-loading-hero">
                <div class="report-loading-spinner-wrap" aria-hidden="true">
                    <div class="report-loading-ring"></div>
                    <span class="report-loading-icon-badge">
                        <i class="fa-solid fa-file-word report-loading-doc-icon"></i>
                    </span>
                </div>
                <div class="report-loading-heading">
                    <span class="report-loading-status-badge" id="report-loading-status-badge">In progress</span>
                    <h2 id="report-loading-title" class="report-loading-title">Generating DOCX Report</h2>
                    <p id="report-loading-subtitle" class="report-loading-subtitle">Compiling your accomplishment data into a professional document…</p>
                </div>
            </div>

            <div class="report-loading-filename-card">
                <span class="report-loading-filename-icon" aria-hidden="true">
                    <i class="fa-solid fa-file-word"></i>
                </span>
                <span id="report-loading-filename" class="report-loading-filename">Accomplishment Report.docx</span>
            </div>

            <div class="report-loading-steps-card">
                <ul id="report-loading-steps" class="report-loading-steps">
                    <li class="report-loading-step" data-step="0">
                        <span class="report-loading-step-icon"><i class="fa-solid fa-check"></i></span>
                        <span class="report-loading-step-label">Validating report sections</span>
                    </li>
                    <li class="report-loading-step" data-step="1">
                        <span class="report-loading-step-icon"><i class="fa-solid fa-check"></i></span>
                        <span class="report-loading-step-label">Compiling file modifications</span>
                    </li>
                    <li class="report-loading-step" data-step="2">
                        <span class="report-loading-step-icon"><i class="fa-solid fa-check"></i></span>
                        <span class="report-loading-step-label">Building document structure</span>
                    </li>
                    <li class="report-loading-step" data-step="3">
                        <span class="report-loading-step-icon"><i class="fa-solid fa-check"></i></span>
                        <span class="report-loading-step-label">Writing DOCX file</span>
                    </li>
                    <li class="report-loading-step" data-step="4">
                        <span class="report-loading-step-icon"><i class="fa-solid fa-check"></i></span>
                        <span class="report-loading-step-label">Preparing preview</span>
                    </li>
                </ul>
            </div>

            <div class="report-loading-footer">
                <div class="report-loading-progress-meta">
                    <span class="report-loading-progress-label">Progress</span>
                    <span id="report-loading-percent" class="report-loading-percent">0%</span>
                </div>
                <div class="report-loading-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="report-loading-progress">
                    <div class="report-loading-progress-bar" id="report-loading-progress-bar"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Report preview modal (confirm before saving to Documents) -->
    <div id="report-preview-modal" class="report-preview-modal" hidden>
        <div class="report-preview-backdrop"></div>
        <div class="report-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
            <header class="report-preview-header">
                <div class="report-preview-title-row">
                    <div class="report-preview-icon-badge" aria-hidden="true">
                        <i class="fa-solid fa-file-word"></i>
                    </div>
                    <div class="report-preview-heading">
                        <h2 id="report-preview-title">Accomplishment Report</h2>
                        <p id="report-preview-stats" class="report-preview-stats">—</p>
                    </div>
                    <span id="report-preview-draft-badge" class="report-preview-draft-badge">Not saved</span>
                    <button type="button" id="report-preview-close-btn" class="report-preview-close-btn" title="Discard preview" aria-label="Discard preview">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </header>

            <div class="report-preview-location-bar">
                <div class="report-preview-location-main">
                    <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
                    <div class="report-preview-location-text">
                        <span class="report-preview-meta-label">Save to</span>
                        <span id="report-preview-folder" class="report-preview-folder">—</span>
                        <span id="report-preview-filename" class="report-preview-filename">—</span>
                    </div>
                </div>
                <button type="button" id="report-preview-copy-path-btn" class="btn btn-secondary btn-sm" title="Copy full save path">
                    <i class="fa-solid fa-copy"></i> Copy path
                </button>
            </div>
            <details class="report-preview-path-details">
                <summary>View full path</summary>
                <code id="report-preview-path" class="report-preview-path-code">—</code>
            </details>

            <div class="report-preview-body">
                <div class="report-preview-toolbar" role="toolbar" aria-label="Preview zoom controls">
                    <span class="report-preview-toolbar-label">Zoom</span>
                    <button type="button" id="report-preview-zoom-fit" class="btn btn-secondary btn-sm report-preview-zoom-btn is-active" data-zoom="fit">Fit width</button>
                    <button type="button" id="report-preview-zoom-100" class="btn btn-secondary btn-sm report-preview-zoom-btn" data-zoom="100">100%</button>
                    <button type="button" id="report-preview-zoom-out" class="btn btn-secondary btn-sm report-preview-zoom-btn" data-zoom="out" aria-label="Zoom out">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <button type="button" id="report-preview-zoom-in" class="btn btn-secondary btn-sm report-preview-zoom-btn" data-zoom="in" aria-label="Zoom in">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <span id="report-preview-zoom-label" class="report-preview-zoom-label" aria-live="polite">Fit width</span>
                </div>
                <div class="report-preview-viewport">
                    <div id="report-preview-loading" class="report-preview-loading" hidden>
                        <div class="report-preview-loading-ring" aria-hidden="true"></div>
                        <span>Rendering document preview…</span>
                    </div>
                    <div id="report-preview-doc" class="report-preview-doc" aria-live="polite"></div>
                </div>
            </div>

            <footer class="report-preview-footer">
                <button type="button" id="report-preview-back-btn" class="btn btn-secondary">
                    <i class="fa-solid fa-arrow-left"></i> Back to edit
                </button>
                <p class="report-preview-footer-hint">Review the report above, then save when ready.</p>
                <button type="button" id="report-preview-confirm-btn" class="btn btn-success btn-lg">
                    <i class="fa-solid fa-floppy-disk"></i> Save to Documents
                </button>
            </footer>
        </div>
    </div>

    <!-- ARB confirm dialog (replaces native browser confirm) -->
    <div id="app-confirm-dialog" class="app-confirm" hidden>
        <div class="app-confirm-backdrop"></div>
        <div class="app-confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message">
            <div class="app-confirm-icon" aria-hidden="true">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 id="app-confirm-title" class="app-confirm-title">Are you sure?</h3>
            <p id="app-confirm-message" class="app-confirm-message"></p>
            <div class="app-confirm-actions">
                <button type="button" id="app-confirm-cancel" class="btn btn-secondary">Cancel</button>
                <button type="button" id="app-confirm-ok" class="btn btn-danger">Confirm</button>
            </div>
        </div>
    </div>

    <!-- Notification Toast -->
    <div id="toast" class="toast">
        <i class="toast-icon fa-solid fa-circle-check"></i>
        <div class="toast-body">
            <h4 class="toast-title">Success</h4>
            <p class="toast-msg">Operation completed successfully.</p>
        </div>
    </div>

    <!-- Script file -->
    <script src="assets/vendor/docx-preview/jszip.min.js"></script>
    <script src="assets/vendor/docx-preview/docx-preview.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
