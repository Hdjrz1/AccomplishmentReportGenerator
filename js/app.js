// Git Accomplishment Report Generator Frontend Application

function resolveApiBase() {
    if (typeof window.ARG_API_BASE === 'string') {
        return window.ARG_API_BASE.replace(/\\/g, '/').replace(/\/$/, '');
    }

    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.toLowerCase().endsWith('.php')) {
        return path.replace(/\/[^/]*$/, '') || '';
    }

    return path.endsWith('/') ? path.slice(0, -1) : path;
}

function apiUrl(action) {
    const base = resolveApiBase();
    const apiPath = `${base}/index.php`.replace(/\/{2,}/g, '/');
    const url = new URL(apiPath, window.location.origin);
    url.searchParams.set('action', action);
    return url.toString();
}

async function apiFetch(action, options = {}) {
    const response = await fetch(apiUrl(action), options);
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = { error: `Invalid response (${response.status})` };
    }
    if (!response.ok && !data.error) {
        data.error = `Request failed (${response.status})`;
    }
    return { response, data };
}

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let repositories = [];
    let fetchedCommits = [];
    let fetchedFiles = [];
    let inactiveRepositories = [];
    let lastFetchedRepos = [];
    let logsFetched = false;
    let isGeneratingReport = false;
    
    // UI Elements
    const themeToggle = document.getElementById('theme-toggle');
    const configForm = document.getElementById('config-form');
    const devNameInput = document.getElementById('developer-name');
    const jobTitleInput = document.getElementById('job-title');
    const projTitleInput = document.getElementById('project-title');
    const sinceInput = document.getElementById('date-since');
    const untilInput = document.getElementById('date-until');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsSummaryContent = document.getElementById('settings-summary-content');
    const settingsAvatar = document.getElementById('settings-avatar');
    const settingsProfileName = document.getElementById('settings-profile-name');
    const settingsProfileMeta = document.getElementById('settings-profile-meta');
    const emptyStateHint = document.getElementById('empty-state-hint');
    const repoSearchInput = document.getElementById('repo-search-input');
    const lastFetchHint = document.getElementById('last-fetch-hint');
    const headerStatusBadge = document.getElementById('header-status-badge');
    const headerStatusText = document.getElementById('header-status-text');
    const stickyGenerateBar = document.getElementById('sticky-generate-bar');
    const stickyFilename = document.getElementById('sticky-filename');
    const stickyCommitsMeta = document.getElementById('sticky-commits-meta');
    const stickyTemplateMeta = document.getElementById('sticky-template-meta');
    const stickyOutputHint = document.getElementById('sticky-output-hint');
    const stickyGenerateBlockReason = document.getElementById('sticky-generate-block-reason');
    
    const selectAllReposCheck = document.getElementById('select-all-repos');
    const reposContainer = document.getElementById('repos-checkboxes');
    const appSidebar = document.getElementById('app-sidebar');
    const metaOutputDir = document.getElementById('meta-output-dir');

    const setupWizard = document.getElementById('setup-wizard');
    const setupWizardDialog = document.querySelector('.setup-wizard-dialog');
    const setupWizardTitle = document.getElementById('setup-wizard-title');
    const setupWizardSubtitle = document.querySelector('.setup-wizard-subtitle');
    const setupDevNameInput = document.getElementById('setup-dev-name');
    const setupJobTitleInput = document.getElementById('setup-job-title');
    const setupProjectTitleInput = document.getElementById('setup-project-title');
    const setupGitAuthorInput = document.getElementById('setup-git-author-input');
    const setupDetectGitAuthorBtn = document.getElementById('setup-detect-git-author-btn');
    const setupSystemDirsList = document.getElementById('setup-system-dirs-list');
    const setupBrowseFolderBtn = document.getElementById('setup-browse-folder-btn');
    const setupFolderPathInput = document.getElementById('setup-folder-path-input');
    const setupAddFolderPathBtn = document.getElementById('setup-add-folder-path-btn');
    const setupBackBtn = document.getElementById('setup-back-btn');
    const setupNextBtn = document.getElementById('setup-next-btn');
    const setupFinishBtn = document.getElementById('setup-finish-btn');
    const setupCancelBtn = document.getElementById('setup-cancel-btn');

    const reportLoadingOverlay = document.getElementById('report-loading-overlay');
    const reportLoadingFilename = document.getElementById('report-loading-filename');
    const reportLoadingSteps = document.getElementById('report-loading-steps');
    const reportLoadingProgress = document.getElementById('report-loading-progress');
    const reportLoadingProgressBar = document.getElementById('report-loading-progress-bar');
    const reportLoadingPercent = document.getElementById('report-loading-percent');
    const reportLoadingStatusBadge = document.getElementById('report-loading-status-badge');
    
    const SYSTEM_DIRS_STORAGE_KEY = 'system_dirs';
    const GIT_AUTHORS_STORAGE_KEY = 'git_authors';
    const WORK_MODE_STORAGE_KEY = 'work_mode';
    const SETUP_COMPLETE_KEY = 'setup_complete';
    const VALID_WORK_MODES = ['commits', 'uncommitted', 'both'];
    let systemDirs = [];
    let gitAuthors = [];
    let setupSystemDirs = [];
    let setupStep = 1;
    let wizardMode = 'setup';
    let currentWorkMode = 'both';
    let outputDir = '';
    
    const emptyState = document.getElementById('empty-state');
    const editorWorkspace = document.getElementById('editor-workspace');
    
    const commitsCountBadge = document.getElementById('commits-count');
    const selectAllCommitsCheck = document.getElementById('select-all-commits');
    const commitsListContainer = document.getElementById('commits-list');
    
    // Form Draft Fields
    const fieldExecSummary = document.getElementById('field-executive-summary');
    const fieldKeyAccomplishments = document.getElementById('field-key-accomplishments');
    const fieldImpactVerification = document.getElementById('field-impact-verification');
    const fieldVerificationStatus = document.getElementById('field-verification-status');
    const reportTemplateSelect = document.getElementById('report-template-select');
    const actsEnvironmentInput = document.getElementById('acts-environment');
    const actsSystemPhaseInput = document.getElementById('acts-system-phase');
    const actsStatusInput = document.getElementById('acts-status');
    const actsTemplateMetaFields = document.querySelectorAll('.acts-template-meta');
    const metaBranchesDisplay = document.getElementById('meta-branches-display');
    const fileChangesTbody = document.getElementById('file-changes-tbody');
    const fileTablePagination = document.getElementById('file-table-pagination');
    const fileTablePaginationInfo = document.getElementById('file-table-pagination-info');
    const fileTablePageLabel = document.getElementById('file-table-page-label');
    const fileTablePrevBtn = document.getElementById('file-table-prev');
    const fileTableNextBtn = document.getElementById('file-table-next');
    const fileSortLabel = document.getElementById('file-sort-label');
    const fileSectionModeRadios = document.querySelectorAll('input[name="file-section-mode"]');
    
    const FILE_SECTION_MODE_KEY = 'file_section_mode';
    const REPORT_TEMPLATE_KEY = 'report_template';
    const ACTS_ENVIRONMENT_KEY = 'acts_environment';
    const ACTS_SYSTEM_PHASE_KEY = 'acts_system_phase';
    const ACTS_STATUS_KEY = 'acts_status';
    const VALID_REPORT_TEMPLATES = ['default', 'acts'];
    const VALID_FILE_SECTION_MODES = ['full', 'compact', 'summary'];
    const COMPACT_MAX_BULLETS = 2;
    const FILE_TABLE_PAGE_SIZE = 10;
    let cachedFileDisplayRows = [];
    let fileTableCurrentPage = 1;
    const generateReportBtn = document.getElementById('generate-report-btn');
    const fetchLogsBtn = document.getElementById('fetch-logs-btn');

    let outputDocsCache = null;
    let outputDocsCacheKey = '';
    let previewRequestToken = 0;
    let lastFetchedAt = null;
    let isFetchingLogs = false;

    function formatLocalDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getProfileInitials(name) {
        const trimmed = String(name || '').trim();
        if (!trimmed) return '?';
        const parts = trimmed.split(/[,\s]+/).filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
        }
        return trimmed.slice(0, 2).toUpperCase();
    }

    function getCheckedRepoCount() {
        return document.querySelectorAll('.repo-checkbox:checked').length;
    }

    function hasDateRangeSelected() {
        return Boolean(sinceInput?.value && untilInput?.value);
    }

    function applyDatePreset(preset) {
        const today = new Date();
        const until = formatLocalDate(today);
        let since = until;

        if (preset === 'week') {
            const start = new Date(today);
            const day = start.getDay();
            const diff = day === 0 ? 6 : day - 1;
            start.setDate(start.getDate() - diff);
            since = formatLocalDate(start);
        } else if (preset === 'month') {
            since = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
        } else if (preset === 'last30') {
            const start = new Date(today);
            start.setDate(start.getDate() - 30);
            since = formatLocalDate(start);
        }

        sinceInput.value = since;
        untilInput.value = until;
        document.querySelectorAll('.date-preset-chip').forEach(chip => {
            chip.classList.toggle('is-active', chip.dataset.preset === preset);
        });
        updateAppStatus();
    }

    function syncDatePresetHighlight() {
        if (!sinceInput?.value || !untilInput?.value) return;
        const today = new Date();
        const weekStart = new Date(today);
        const day = weekStart.getDay();
        const diff = day === 0 ? 6 : day - 1;
        weekStart.setDate(weekStart.getDate() - diff);
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        const checks = [
            { key: 'today', since: formatLocalDate(today), until: formatLocalDate(today) },
            { key: 'week', since: formatLocalDate(weekStart), until: formatLocalDate(today) },
            { key: 'month', since: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), until: formatLocalDate(today) },
            { key: 'last30', since: formatLocalDate(last30), until: formatLocalDate(today) }
        ];
        const match = checks.find(item => item.since === sinceInput.value && item.until === untilInput.value);
        document.querySelectorAll('.date-preset-chip').forEach(chip => {
            chip.classList.toggle('is-active', Boolean(match && chip.dataset.preset === match.key));
        });
    }

    function filterRepositories(query) {
        const term = String(query || '').trim().toLowerCase();
        document.querySelectorAll('.repos-checkboxes .checkbox-item-wrapper').forEach(item => {
            const name = item.dataset.repoName || '';
            item.hidden = term !== '' && !name.includes(term);
        });
        document.querySelectorAll('.repos-checkboxes .repo-group-divider').forEach(divider => {
            let sibling = divider.nextElementSibling;
            let hasVisible = false;
            while (sibling && !sibling.classList.contains('repo-group-divider')) {
                if (sibling.classList.contains('checkbox-item-wrapper') && !sibling.hidden) {
                    hasVisible = true;
                    break;
                }
                sibling = sibling.nextElementSibling;
            }
            divider.hidden = term !== '' && !hasVisible;
        });
    }

    function updateHeaderStatus() {
        if (!headerStatusText || !headerStatusBadge) return;

        headerStatusBadge.classList.remove('is-ready', 'is-warn');

        if (isFetchingLogs) {
            headerStatusText.textContent = 'Fetching git logs…';
            return;
        }

        if (!isSetupComplete()) {
            headerStatusBadge.classList.add('is-warn');
            headerStatusText.textContent = 'Setup required';
            return;
        }

        if (logsFetched) {
            headerStatusBadge.classList.add('is-ready');
            const selected = document.querySelectorAll('.commit-checkbox:checked').length;
            headerStatusText.textContent = `Ready · ${selected}/${fetchedCommits.length} commits`;
            return;
        }

        if (repositories.length > 0) {
            headerStatusText.textContent = `${repositories.length} repos · ${systemDirs.length} folder${systemDirs.length === 1 ? '' : 's'}`;
            return;
        }

        headerStatusBadge.classList.add('is-warn');
        headerStatusText.textContent = systemDirs.length ? 'No repositories found' : 'Add a project folder';
    }

    function updateEmptyStateHint() {
        if (!emptyStateHint) return;
        if (!isSetupComplete()) {
            emptyStateHint.innerHTML = 'Complete setup in <strong>Settings</strong>, then set dates and repositories in the sidebar and click <strong>Fetch Git Logs</strong>.';
            return;
        }
        emptyStateHint.innerHTML = 'Set your date range and repositories in the sidebar, then click <strong>Fetch Git Logs</strong>.';
    }

    function updateStickyGenerateBar() {
        if (!stickyGenerateBar) return;

        if (!logsFetched) {
            stickyGenerateBar.hidden = true;
            return;
        }

        stickyGenerateBar.hidden = false;
        const dateRangeStr = formatDateRange(sinceInput.value, untilInput.value);
        if (stickyFilename) stickyFilename.textContent = buildOutputFileName(dateRangeStr) || 'Accomplishment Report.docx';
        if (stickyCommitsMeta) {
            const checked = document.querySelectorAll('.commit-checkbox:checked').length;
            stickyCommitsMeta.textContent = `${checked} of ${fetchedCommits.length} commits selected`;
        }
    }

    function updateAppStatus() {
        syncDatePresetHighlight();
        updateHeaderStatus();
        updateEmptyStateHint();
        updateStickyGenerateBar();
    }

    function setGenerateButtonBusy(isBusy) {
        isGeneratingReport = isBusy;
        const idleHtml = '<i class="fa-solid fa-file-word"></i> Generate DOCX Report';
        const busyHtml = '<i class="fa-solid fa-spinner fa-spin"></i> Writing DOCX Report...';

        if (!generateReportBtn) return;
        if (isBusy) {
            generateReportBtn.disabled = true;
            generateReportBtn.innerHTML = busyHtml;
        } else {
            generateReportBtn.innerHTML = idleHtml;
        }
    }

    let reportLoadingStepTimer = null;
    let reportLoadingHideTimer = null;
    let reportLoadingCurrentStep = 0;

    const REPORT_LOADING_PROGRESS = [8, 24, 44, 68, 88];

    function setReportLoadingProgress(percent) {
        if (reportLoadingProgressBar) {
            reportLoadingProgressBar.style.width = `${percent}%`;
        }
        if (reportLoadingProgress) {
            reportLoadingProgress.setAttribute('aria-valuenow', String(Math.round(percent)));
        }
        if (reportLoadingPercent) {
            reportLoadingPercent.textContent = `${Math.round(percent)}%`;
        }
    }

    function resetReportLoadingSteps() {
        reportLoadingCurrentStep = 0;
        if (!reportLoadingSteps) return;
        reportLoadingSteps.querySelectorAll('.report-loading-step').forEach((el, index) => {
            el.classList.remove('is-active', 'is-done');
            if (index === 0) el.classList.add('is-active');
        });
        setReportLoadingProgress(REPORT_LOADING_PROGRESS[0]);
    }

    function advanceReportLoadingStep() {
        const steps = reportLoadingSteps?.querySelectorAll('.report-loading-step');
        if (!steps || reportLoadingCurrentStep >= steps.length - 1) return;

        steps[reportLoadingCurrentStep].classList.remove('is-active');
        steps[reportLoadingCurrentStep].classList.add('is-done');
        reportLoadingCurrentStep += 1;
        steps[reportLoadingCurrentStep].classList.add('is-active');
        setReportLoadingProgress(REPORT_LOADING_PROGRESS[reportLoadingCurrentStep] || 88);
    }

    function startReportLoadingStepTimer() {
        window.clearInterval(reportLoadingStepTimer);
        reportLoadingStepTimer = window.setInterval(advanceReportLoadingStep, 750);
    }

    function stopReportLoadingStepTimer() {
        window.clearInterval(reportLoadingStepTimer);
        reportLoadingStepTimer = null;
    }

    function showReportLoadingOverlay(filename) {
        if (!reportLoadingOverlay) return;

        stopReportLoadingStepTimer();
        window.clearTimeout(reportLoadingHideTimer);
        reportLoadingOverlay.classList.remove('is-open', 'is-closing', 'is-complete');
        resetReportLoadingSteps();

        if (reportLoadingFilename) {
            reportLoadingFilename.textContent = filename || 'Accomplishment Report.docx';
        }
        if (reportLoadingStatusBadge) {
            reportLoadingStatusBadge.textContent = 'In progress';
        }

        reportLoadingOverlay.hidden = false;
        reportLoadingOverlay.setAttribute('aria-busy', 'true');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                reportLoadingOverlay.classList.add('is-open');
            });
        });
        startReportLoadingStepTimer();
    }

    function finishReportLoadingSteps() {
        stopReportLoadingStepTimer();
        const steps = reportLoadingSteps?.querySelectorAll('.report-loading-step');
        if (steps) {
            steps.forEach((el) => {
                el.classList.remove('is-active');
                el.classList.add('is-done');
            });
        }
        setReportLoadingProgress(100);
        reportLoadingOverlay?.classList.add('is-complete');
        if (reportLoadingStatusBadge) {
            reportLoadingStatusBadge.textContent = 'Complete';
        }
    }

    function hideReportLoadingOverlay(options = {}) {
        const { success = false } = options;

        return new Promise((resolve) => {
            if (!reportLoadingOverlay || reportLoadingOverlay.hidden) {
                resolve();
                return;
            }

            stopReportLoadingStepTimer();
            window.clearTimeout(reportLoadingHideTimer);

            const performHide = () => {
                if (!reportLoadingOverlay.classList.contains('is-open')) {
                    reportLoadingOverlay.hidden = true;
                    reportLoadingOverlay.classList.remove('is-open', 'is-closing', 'is-complete');
                    reportLoadingOverlay.setAttribute('aria-busy', 'false');
                    resolve();
                    return;
                }

                reportLoadingOverlay.classList.remove('is-open');
                reportLoadingOverlay.classList.add('is-closing');

                const panel = reportLoadingOverlay.querySelector('.report-loading-panel');
                if (!panel) {
                    reportLoadingOverlay.hidden = true;
                    reportLoadingOverlay.classList.remove('is-closing', 'is-complete');
                    reportLoadingOverlay.setAttribute('aria-busy', 'false');
                    resolve();
                    return;
                }

                let completed = false;
                const finish = () => {
                    if (completed) return;
                    completed = true;
                    panel.removeEventListener('animationend', onAnimationEnd);
                    reportLoadingOverlay.hidden = true;
                    reportLoadingOverlay.classList.remove('is-closing', 'is-complete');
                    reportLoadingOverlay.setAttribute('aria-busy', 'false');
                    resolve();
                };

                const onAnimationEnd = (event) => {
                    if (event.target === panel) finish();
                };

                panel.addEventListener('animationend', onAnimationEnd);
                reportLoadingHideTimer = window.setTimeout(finish, 300);
            };

            if (success) {
                finishReportLoadingSteps();
                reportLoadingHideTimer = window.setTimeout(performHide, 480);
            } else {
                performHide();
            }
        });
    }
    
    let themeSwitchTimer = null;

    function applyTheme(theme, animate = false) {
        const isDark = theme === 'dark';
        const root = document.documentElement;

        if (animate) {
            root.classList.add('theme-switching');
            window.clearTimeout(themeSwitchTimer);
        }

        document.body.classList.toggle('dark-theme', isDark);
        document.body.classList.toggle('light-theme', !isDark);
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        if (animate) {
            themeSwitchTimer = window.setTimeout(() => {
                root.classList.remove('theme-switching');
            }, 450);
        }
    }

    applyTheme(localStorage.getItem('theme') === 'light' ? 'light' : 'dark', false);

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        applyTheme(isDark ? 'light' : 'dark', true);
    });

    // Toast Notification
    function showToast(title, message, type = 'success') {
        const toast = document.getElementById('toast');
        let iconClass = 'fa-circle-check';
        let typeClass = '';
        
        // Handle boolean arguments for legacy calls (isError)
        if (type === true || type === 'error') {
            iconClass = 'fa-circle-xmark';
            typeClass = ' toast-error';
        } else if (type === 'warning') {
            iconClass = 'fa-triangle-exclamation';
            typeClass = ' toast-warning';
        }
        
        toast.className = 'toast' + typeClass + ' show';
        toast.querySelector('.toast-icon').className = 'toast-icon fa-solid ' + iconClass;
        toast.querySelector('.toast-title').textContent = title;
        toast.querySelector('.toast-msg').textContent = message;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    function getSelectedGitAuthors() {
        return [...gitAuthors];
    }

    function saveGitAuthors() {
        localStorage.setItem(GIT_AUTHORS_STORAGE_KEY, JSON.stringify(gitAuthors));
    }

    function renderSettingsSummary() {
        const devName = devNameInput?.value?.trim() || '';
        const jobTitle = jobTitleInput?.value?.trim() || '';
        const projectTitle = projTitleInput?.value?.trim() || '';
        const gitUser = gitAuthors[0] || '';
        const workMode = getWorkMode();
        const workModeLabels = {
            both: 'Commits + Uncommitted',
            commits: 'Commits Only',
            uncommitted: 'Uncommitted Only'
        };

        if (settingsAvatar) {
            settingsAvatar.textContent = getProfileInitials(devName);
        }
        if (settingsProfileName) {
            settingsProfileName.textContent = devName || 'Your profile';
        }
        if (settingsProfileMeta) {
            if (!devName && !isSetupComplete()) {
                settingsProfileMeta.textContent = 'Complete setup to begin';
            } else {
                const parts = [jobTitle, `${systemDirs.length} folder${systemDirs.length === 1 ? '' : 's'}`].filter(Boolean);
                settingsProfileMeta.textContent = parts.join(' · ') || 'Profile configured';
            }
        }
        if (!settingsSummaryContent) {
            updateAppStatus();
            return;
        }

        if (!devName && !isSetupComplete()) {
            settingsSummaryContent.hidden = true;
            settingsSummaryContent.innerHTML = '';
            updateAppStatus();
            return;
        }

        const folderTitle = systemDirs.join('\n');
        const folderPreview = systemDirs.length
            ? (systemDirs.length <= 2
                ? systemDirs.map(dir => escapeHtml(dir)).join(', ')
                : `${systemDirs.slice(0, 2).map(dir => escapeHtml(dir)).join(', ')} <span class="help-text">+${systemDirs.length - 2} more</span>`)
            : '<span class="help-text">No project folders</span>';

        settingsSummaryContent.hidden = true;
        settingsSummaryContent.innerHTML = `
            <div class="settings-summary-row"><span class="settings-summary-label">Name</span><span class="settings-summary-value">${escapeHtml(devName) || '—'}</span></div>
            <div class="settings-summary-row"><span class="settings-summary-label">Role</span><span class="settings-summary-value">${escapeHtml(jobTitle) || '—'}</span></div>
            <div class="settings-summary-row"><span class="settings-summary-label">Project</span><span class="settings-summary-value">${escapeHtml(projectTitle) || '—'}</span></div>
            <div class="settings-summary-row"><span class="settings-summary-label">Git</span><span class="settings-summary-value">${escapeHtml(gitUser) || '—'}</span></div>
            <div class="settings-summary-row"><span class="settings-summary-label">Work</span><span class="settings-summary-value">${workModeLabels[workMode] || workMode}</span></div>
            <div class="settings-summary-row settings-summary-row--folders"><span class="settings-summary-label">Project folders</span><span class="settings-summary-value" title="${escapeHtml(folderTitle)}">${folderPreview}</span></div>
        `;
        updateAppStatus();
    }

    function getSetupGitUsername() {
        return setupGitAuthorInput ? setupGitAuthorInput.value.trim() : '';
    }

    function setSetupGitUsername(value) {
        if (setupGitAuthorInput) {
            setupGitAuthorInput.value = String(value || '').trim();
            updateFinishButtonState();
        }
    }

    function addGitAuthor(value) {
        const author = String(value || '').trim();
        if (!author) return false;
        if (gitAuthors.some(item => item.toLowerCase() === author.toLowerCase())) return false;
        gitAuthors = [author];
        saveGitAuthors();
        renderSettingsSummary();
        return true;
    }

    async function detectGitIdentity() {
        const systemDirsForDetect = [...setupSystemDirs];
        const authorList = [getSetupGitUsername()].filter(Boolean);
        const inputValue = setupGitAuthorInput?.value?.trim() || '';

        try {
            const { data } = await apiFetch('get_git_identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_dirs: systemDirsForDetect })
            });

            if (data.git_found === false) {
                showToast('Git Not Found', data.error || 'Git is not installed or not accessible from the server.', 'warning');
                return;
            }

            const suggested = (data.suggested_author || data.name || '').trim();
            if (!suggested) {
                if (inputValue) {
                    setSetupGitUsername(inputValue);
                    showToast('Saved', `Using "${inputValue}" as your git username.`);
                    return;
                }
                showToast('Not Found', data.error || 'Could not detect git identity. Add your username manually.', 'warning');
                return;
            }

            if (authorList.some(author => author.toLowerCase() === suggested.toLowerCase())) {
                const sourceLabel = formatDetectSource(data.source);
                showToast('Detected', `"${suggested}" is already set (${sourceLabel}).`);
                return;
            }

            const extra = data.email ? ` (${data.email})` : '';
            const sourceLabel = formatDetectSource(data.source);
            setSetupGitUsername(suggested);
            showToast('Detected', `Set username to "${suggested}" from ${sourceLabel}${extra}.`);
        } catch (err) {
            console.error(err);
            showToast('Error', 'Failed to detect git identity.', true);
        }
    }

    function formatDetectSource(source) {
        const labels = {
            global: 'global git config',
            system: 'system git config',
            repo_config: 'repository git config',
            recent_commit: 'recent commit history'
        };
        return labels[source] || 'git';
    }

    function isSetupComplete() {
        return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
    }

    function setSidebarLocked(locked) {
        if (appSidebar) appSidebar.classList.toggle('sidebar-locked', locked);
        if (configForm) configForm.classList.toggle('sidebar-locked', locked);
    }

    function clearSidebarState() {
        devNameInput.value = '';
        jobTitleInput.value = '';
        projTitleInput.value = '';
        gitAuthors = [];
        systemDirs = [];
        repositories = [];
        if (reposContainer) {
            reposContainer.innerHTML = '<p class="help-text">Complete setup to load repositories.</p>';
        }
        if (selectAllReposCheck) selectAllReposCheck.checked = false;
        setWorkMode('both', false);
        renderSettingsSummary();
    }

    function loadSidebarFromStorage() {
        devNameInput.value = localStorage.getItem('dev_name') || '';
        jobTitleInput.value = localStorage.getItem('job_title') || '';
        projTitleInput.value = localStorage.getItem('project_title') || '';

        const storedAuthors = localStorage.getItem(GIT_AUTHORS_STORAGE_KEY);
        gitAuthors = [];
        if (storedAuthors) {
            try {
                const parsed = JSON.parse(storedAuthors);
                if (Array.isArray(parsed)) {
                    gitAuthors = parsed.map(item => String(item).trim()).filter(Boolean);
                }
            } catch {
                if (storedAuthors.trim()) gitAuthors = [storedAuthors.trim()];
            }
        }

        const storedDirs = getStoredSystemDirs();
        systemDirs = storedDirs || [];

        const storedMode = localStorage.getItem(WORK_MODE_STORAGE_KEY);
        setWorkMode(VALID_WORK_MODES.includes(storedMode) ? storedMode : 'both', false);
        loadActsMetaFromStorage();
        renderSettingsSummary();
    }

    function getWorkMode() {
        return VALID_WORK_MODES.includes(currentWorkMode) ? currentWorkMode : 'both';
    }

    function setWorkMode(mode, persist = true) {
        if (!VALID_WORK_MODES.includes(mode)) return;
        currentWorkMode = mode;
        if (persist) localStorage.setItem(WORK_MODE_STORAGE_KEY, mode);
        document.querySelectorAll('input[name="setup-work-mode"]').forEach(radio => {
            radio.checked = radio.value === mode;
        });
    }

    function initWorkModeListeners() {
        document.querySelectorAll('input[name="setup-work-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setWorkMode(radio.value, wizardMode === 'settings' || isSetupComplete());
                    updateFinishButtonState();
                }
            });
        });
    }

    initWorkModeListeners();
    const today = new Date();
    untilInput.value = formatLocalDate(today);

    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 7);
    sinceInput.value = formatLocalDate(pastDate);
    syncDatePresetHighlight();

    document.querySelectorAll('.date-preset-chip').forEach(chip => {
        chip.addEventListener('click', () => applyDatePreset(chip.dataset.preset));
    });
    sinceInput.addEventListener('change', updateAppStatus);
    untilInput.addEventListener('change', updateAppStatus);

    if (repoSearchInput) {
        repoSearchInput.addEventListener('input', () => filterRepositories(repoSearchInput.value));
    }

    function normalizeFolderPath(pathValue) {
        return String(pathValue || '').trim().replace(/\//g, '\\');
    }

    function saveSystemDirs() {
        localStorage.setItem(SYSTEM_DIRS_STORAGE_KEY, JSON.stringify(systemDirs));
    }

    function getStoredSystemDirs() {
        const stored = localStorage.getItem(SYSTEM_DIRS_STORAGE_KEY);
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map(normalizeFolderPath).filter(Boolean);
            }
        } catch {
            return null;
        }
        return null;
    }

    function renderSetupSystemDirsList() {
        setupSystemDirsList.innerHTML = '';
        if (setupSystemDirs.length === 0) {
            setupSystemDirsList.innerHTML = '<p class="help-text setup-folders-empty">No folders yet. Click <strong>Choose folder on this PC</strong> below to add where your Git projects live.</p>';
            return;
        }
        setupSystemDirs.forEach(dir => {
            const row = document.createElement('div');
            row.className = 'system-dir-row';
            row.innerHTML = `
                <span class="system-dir-path" title="${escapeHtml(dir)}">${escapeHtml(dir)}</span>
                <button type="button" class="btn-remove-system-dir" title="Remove folder">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            row.querySelector('.btn-remove-system-dir').addEventListener('click', () => {
                setupSystemDirs = setupSystemDirs.filter(item => item !== dir);
                renderSetupSystemDirsList();
                updateFinishButtonState();
            });
            setupSystemDirsList.appendChild(row);
        });
    }

    function addSetupSystemDir(folderPath) {
        const normalized = normalizeFolderPath(folderPath);
        if (!normalized) return false;
        if (setupSystemDirs.some(dir => dir.toLowerCase() === normalized.toLowerCase())) {
            showToast('Warning', 'That folder is already in your list.', 'warning');
            return false;
        }
        setupSystemDirs.push(normalized);
        renderSetupSystemDirsList();
        updateFinishButtonState();
        return true;
    }

    function setFolderPickerBusy(isBusy) {
        if (setupBrowseFolderBtn) setupBrowseFolderBtn.disabled = isBusy;
        if (setupAddFolderPathBtn) setupAddFolderPathBtn.disabled = isBusy;
        if (setupFolderPathInput) setupFolderPathInput.disabled = isBusy;
    }

    async function addSetupFolderFromInput() {
        const raw = setupFolderPathInput?.value?.trim();
        if (!raw) {
            showToast('Warning', 'Enter the full folder path (e.g. C:\\Projects).', 'warning');
            return;
        }

        try {
            const { response, data } = await apiFetch('validate_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: raw })
            });

            if (!response.ok || !data.valid) {
                showToast('Warning', data.error || 'That folder does not exist or is not accessible.', 'warning');
                return;
            }

            if (addSetupSystemDir(data.path || raw)) {
                setupFolderPathInput.value = '';
                setupFolderPathInput.placeholder = 'e.g. C:\\Projects or C:\\laragon\\www';
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Could not validate the folder path.', true);
        }
    }

    function promptForFolderPathCompletion(folderName) {
        const manualSection = document.querySelector('.setup-folders-manual');
        if (manualSection) manualSection.open = true;
        if (setupFolderPathInput) {
            setupFolderPathInput.placeholder = `Enter full path for "${folderName}" (e.g. C:\\${folderName})`;
            setupFolderPathInput.focus();
            setupFolderPathInput.select();
        }
        showToast(
            'Path needed',
            `Browser picked "${folderName}". Open "Or paste a folder path manually" and enter the full path, then click Add folder.`,
            'warning'
        );
    }

    const BROWSE_FOLDER_BTN_HTML = '<i class="fa-solid fa-folder-open" aria-hidden="true"></i> Choose folder on this PC';

    async function browseForFolder() {
        const button = setupBrowseFolderBtn;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Opening...';
        }
        setFolderPickerBusy(true);

        try {
            const browserResult = await tryBrowserDirectoryPicker();

            if (browserResult === 'cancelled') {
                return;
            }
            if (typeof browserResult === 'string') {
                addSetupSystemDir(browserResult);
                return;
            }
            if (browserResult?.partial) {
                promptForFolderPathCompletion(browserResult.folderName);
                return;
            }

            if (shouldTryBrowserPickerFirst()) {
                showToast('Unavailable', 'Could not open the browser folder picker. Paste the folder path above instead.', 'warning');
            } else {
                showToast('Unavailable', 'Browse is not supported in this browser. Paste the folder path above instead.', 'warning');
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Could not open the folder picker.', true);
        } finally {
            setFolderPickerBusy(false);
            if (button) {
                button.disabled = false;
                button.innerHTML = BROWSE_FOLDER_BTN_HTML;
            }
        }
    }

    function shouldTryBrowserPickerFirst() {
        return window.isSecureContext && typeof window.showDirectoryPicker === 'function';
    }

    async function tryBrowserDirectoryPicker() {
        if (!shouldTryBrowserPickerFirst()) {
            return null;
        }

        try {
            const handle = await window.showDirectoryPicker({
                id: 'arg-system-folder',
                mode: 'read'
            });
            const path = await resolveDirectoryHandlePath(handle);
            if (path) {
                return path;
            }

            const folderName = String(handle.name || '').trim();
            if (folderName) {
                return { partial: true, folderName };
            }
            return null;
        } catch (err) {
            if (err?.name === 'AbortError') {
                return 'cancelled';
            }
            return null;
        }
    }

    async function resolveDirectoryHandlePath(handle) {
        if (!handle) return null;

        if (typeof handle.path === 'string' && handle.path.trim()) {
            return handle.path.trim();
        }

        const folderName = String(handle.name || '').trim();
        if (!folderName) return null;

        const candidates = [...new Set([
            ...setupSystemDirs,
            ...systemDirs
        ])];

        const match = candidates.find(candidate => {
            const normalized = candidate.replace(/\\/g, '/').replace(/\/$/, '');
            const base = normalized.split('/').pop();
            return base && base.toLowerCase() === folderName.toLowerCase();
        });

        return match || null;
    }

    function renderRepositories() {
        reposContainer.innerHTML = '';

        if (repositories.length === 0) {
            const folderHint = systemDirs.length
                ? systemDirs.join(', ')
                : 'your project folders';
            reposContainer.innerHTML = `<p class="help-text">No git repositories found in ${folderHint}.</p>`;
            if (repoSearchInput) repoSearchInput.hidden = true;
            updateAppStatus();
            return;
        }

        if (repoSearchInput) {
            repoSearchInput.hidden = false;
            repoSearchInput.value = '';
        }

        const groupedRepos = new Map();
        const groupOrder = [];

        repositories.forEach(repo => {
            const root = repo.system_root || 'Other';
            if (!groupedRepos.has(root)) {
                groupedRepos.set(root, []);
                groupOrder.push(root);
            }
            groupedRepos.get(root).push(repo);
        });

        const renderRepoItem = (repo) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item-wrapper';
            div.dataset.repoName = `${repo.name} ${repo.branch} ${repo.repo_identifier}`.toLowerCase();
            div.innerHTML = `
                <label class="checkbox-container">
                    <input type="checkbox" class="repo-checkbox" value="${repo.path}" data-name="${repo.name}" data-branch="${repo.branch}" data-ident="${repo.repo_identifier}">
                    <span class="checkmark"></span>
                    ${repo.name}
                </label>
                <span class="repo-badge">${repo.branch}</span>
            `;
            div.querySelector('.repo-checkbox').addEventListener('change', () => {
                updateGenerateButtonState();
                updateAppStatus();
            });
            reposContainer.appendChild(div);
        };

        groupOrder.forEach(root => {
            const repos = groupedRepos.get(root) || [];
            if (repos.length === 0) return;

            const divider = document.createElement('div');
            divider.className = 'repo-group-divider';
            divider.innerHTML = `<span class="repo-group-label">${root}</span>`;
            reposContainer.appendChild(divider);

            repos.sort((a, b) => a.name.localeCompare(b.name)).forEach(renderRepoItem);
        });
        updateAppStatus();
    }

    async function loadRepositories() {
        try {
            const repoResult = await apiFetch('get_repos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_dirs: systemDirs })
            });
            const data = repoResult.data;
            repositories = data.repos || data || [];
            if (data.output_dir) {
                outputDir = data.output_dir;
                if (metaOutputDir) metaOutputDir.textContent = outputDir;
            }
            renderRepositories();
            updateGenerateButtonState();
            updateAppStatus();
        } catch (err) {
            console.error(err);
            showToast('Error', 'Failed to load repositories from the selected folders.', true);
        }
    }

    async function initData() {
        try {
            const configResult = await apiFetch('get_config');
            const config = configResult.data;
            outputDir = config.output_dir || '';
            if (metaOutputDir && outputDir) {
                metaOutputDir.textContent = outputDir;
            }

            if (isSetupComplete()) {
                loadSidebarFromStorage();
                await loadRepositories();
            } else {
                clearSidebarState();
                openSetupWizard(true);
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Failed to retrieve setup details from backend.', true);
        } finally {
            updateAppStatus();
        }
    }

    function setWizardFooterButtons(step) {
        const onStep1 = step === 1;
        const onStep3 = step === 3;

        setupBackBtn.hidden = onStep1;
        setupNextBtn.hidden = onStep3;
        setupFinishBtn.hidden = !onStep3;

        setupBackBtn.classList.toggle('wizard-footer-btn-hidden', onStep1);
        setupNextBtn.classList.toggle('wizard-footer-btn-hidden', onStep3);
        setupFinishBtn.classList.toggle('wizard-footer-btn-hidden', !onStep3);
    }

    function showSetupStep(step) {
        setupStep = step;
        document.querySelectorAll('.setup-step').forEach(el => {
            el.hidden = parseInt(el.dataset.step, 10) !== step;
        });
        document.querySelectorAll('.setup-step-indicator').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.step, 10) === step);
            el.classList.toggle('done', parseInt(el.dataset.step, 10) < step);
        });
        setWizardFooterButtons(step);
        if (step === 3) {
            renderSetupSystemDirsList();
            updateFinishButtonState();
        }
    }

    function setWizardMode(mode) {
        wizardMode = mode;
        const isSetup = mode === 'setup';
        if (setupWizardTitle) {
            setupWizardTitle.textContent = isSetup ? 'Welcome — Quick Setup' : 'Settings';
        }
        if (setupWizardSubtitle) {
            setupWizardSubtitle.textContent = isSetup
                ? 'Configure your profile and project folders to get started.'
                : 'Update your profile, git identity, and project folders.';
        }
        if (setupFinishBtn) {
            setupFinishBtn.textContent = isSetup ? 'Finish Setup' : 'Save Settings';
        }
        if (setupCancelBtn) {
            setupCancelBtn.hidden = isSetup;
        }
    }

    function populateWizardFromAppState() {
        setupDevNameInput.value = devNameInput.value;
        setupJobTitleInput.value = jobTitleInput.value;
        setupProjectTitleInput.value = projTitleInput.value;
        setSetupGitUsername(gitAuthors[0] || '');
        setWorkMode(getWorkMode(), false);
        setupSystemDirs = [...systemDirs];
        renderSetupSystemDirsList();
    }

    function revealSetupWizard() {
        if (!setupWizard) return;
        if (setupWizard.classList.contains('is-closing')) return;
        setupWizard.hidden = false;
        setupWizard.classList.remove('is-closing');
        setupWizard.classList.remove('is-open');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setupWizard.classList.add('is-open');
            });
        });
    }

    function hideSetupWizard(onComplete) {
        if (!setupWizard || setupWizard.hidden) return;

        const finish = () => {
            setupWizard.hidden = true;
            setupWizard.classList.remove('is-open', 'is-closing');
            if (typeof onComplete === 'function') onComplete();
        };

        if (!setupWizard.classList.contains('is-open')) {
            finish();
            return;
        }

        setupWizard.classList.remove('is-open');
        setupWizard.classList.add('is-closing');

        const dialog = setupWizardDialog || setupWizard.querySelector('.setup-wizard-dialog');
        if (!dialog) {
            finish();
            return;
        }

        let completed = false;
        const completeOnce = () => {
            if (completed) return;
            completed = true;
            dialog.removeEventListener('animationend', handleAnimationEnd);
            finish();
        };

        const handleAnimationEnd = (event) => {
            if (event.target === dialog && event.animationName === 'setupWizardDialogOut') {
                completeOnce();
            }
        };

        dialog.addEventListener('animationend', handleAnimationEnd);
        window.setTimeout(completeOnce, 320);
    }

    function openSetupWizard(isFirstRun = false) {
        setWizardMode('setup');
        if (isFirstRun || !isSetupComplete()) {
            setupDevNameInput.value = '';
            setupJobTitleInput.value = '';
            setupProjectTitleInput.value = '';
            setSetupGitUsername('');
            setupSystemDirs = [];
            setWorkMode('both', false);
        } else {
            populateWizardFromAppState();
        }
        showSetupStep(1);
        revealSetupWizard();
        setSidebarLocked(true);
    }

    function openSettingsModal() {
        if (!isSetupComplete()) {
            openSetupWizard(true);
            return;
        }
        setWizardMode('settings');
        populateWizardFromAppState();
        showSetupStep(1);
        revealSetupWizard();
    }

    function closeSetupWizard() {
        const wasSetupMode = wizardMode === 'setup';
        hideSetupWizard(() => {
            if (wasSetupMode) {
                setSidebarLocked(false);
            }
        });
    }

    function applyWizardSettings() {
        if (!validateAllSetupSteps()) return false;

        devNameInput.value = setupDevNameInput.value.trim();
        jobTitleInput.value = setupJobTitleInput.value.trim();
        projTitleInput.value = setupProjectTitleInput.value.trim();
        localStorage.setItem('dev_name', devNameInput.value);
        localStorage.setItem('job_title', jobTitleInput.value);
        localStorage.setItem('project_title', projTitleInput.value);

        const setupUsername = getSetupGitUsername();
        gitAuthors = setupUsername ? [setupUsername] : [];
        saveGitAuthors();

        const setupMode = document.querySelector('input[name="setup-work-mode"]:checked')?.value || 'both';
        setWorkMode(setupMode, true);

        systemDirs = [...setupSystemDirs];
        saveSystemDirs();
        renderSettingsSummary();

        const isFirstRun = wizardMode === 'setup';
        if (isFirstRun) {
            localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
            updateSettingsButtonVisibility();
        }

        closeSetupWizard();
        loadRepositories();

        if (isFirstRun) {
            showToast('Setup Complete', 'You can now select repositories and fetch git logs.');
        } else {
            showToast('Settings Saved', 'Your profile and project folders were updated.');
        }
        return true;
    }

    function isSetupStepValid(step) {
        if (step === 1) {
            return Boolean(
                setupDevNameInput.value.trim() &&
                setupJobTitleInput.value.trim() &&
                setupProjectTitleInput.value.trim()
            );
        }
        if (step === 2) {
            const mode = document.querySelector('input[name="setup-work-mode"]:checked')?.value || 'both';
            if (mode !== 'uncommitted' && !getSetupGitUsername()) return false;
            return true;
        }
        if (step === 3) {
            return setupSystemDirs.length > 0;
        }
        return false;
    }

    function validateSetupStep(step) {
        if (step === 1) {
            if (!setupDevNameInput.value.trim() || !setupJobTitleInput.value.trim() || !setupProjectTitleInput.value.trim()) {
                showToast('Required', 'Fill in developer name, job title, and project title.', 'warning');
                return false;
            }
        }
        if (step === 2) {
            const mode = document.querySelector('input[name="setup-work-mode"]:checked')?.value || 'both';
            if (mode !== 'uncommitted' && !getSetupGitUsername()) {
                showToast('Required', 'Enter your git username for commit filtering.', 'warning');
                return false;
            }
        }
        if (step === 3) {
            if (setupSystemDirs.length === 0) {
                showToast('Required', 'Add at least one project folder using Choose folder or paste a path manually.', 'warning');
                return false;
            }
        }
        return true;
    }

    function validateAllSetupSteps() {
        for (let step = 1; step <= 3; step += 1) {
            if (!validateSetupStep(step)) {
                showSetupStep(step);
                return false;
            }
        }
        return true;
    }

    function updateFinishButtonState() {
        if (!setupFinishBtn) return;
        const allValid = isSetupStepValid(1) && isSetupStepValid(2) && isSetupStepValid(3);
        setupFinishBtn.disabled = !allValid;
    }

    function updateSettingsButtonVisibility() {
        if (settingsBtn) {
            settingsBtn.hidden = !isSetupComplete();
        }
    }

    function finishSetupWizard() {
        applyWizardSettings();
    }

    setupGitAuthorInput.addEventListener('input', updateFinishButtonState);
    setupDevNameInput.addEventListener('input', updateFinishButtonState);
    setupJobTitleInput.addEventListener('input', updateFinishButtonState);
    setupProjectTitleInput.addEventListener('input', updateFinishButtonState);
    setupDetectGitAuthorBtn.addEventListener('click', async () => {
        await detectGitIdentity();
        updateFinishButtonState();
    });
    setupBrowseFolderBtn.addEventListener('click', () => browseForFolder());
    if (setupAddFolderPathBtn) {
        setupAddFolderPathBtn.addEventListener('click', () => addSetupFolderFromInput());
    }
    if (setupFolderPathInput) {
        setupFolderPathInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addSetupFolderFromInput();
            }
        });
    }
    setupBackBtn.addEventListener('click', () => showSetupStep(setupStep - 1));
    setupNextBtn.addEventListener('click', () => {
        if (!validateSetupStep(setupStep)) return;
        showSetupStep(setupStep + 1);
    });
    setupFinishBtn.addEventListener('click', finishSetupWizard);
    if (setupCancelBtn) {
        setupCancelBtn.addEventListener('click', closeSetupWizard);
    }
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }

    updateSettingsButtonVisibility();
    initData();
    
    // Select all Repositories
    function toggleAllRepositories(checked) {
        document.querySelectorAll('.repo-checkbox').forEach(cb => {
            cb.checked = checked;
        });
    }
    
    selectAllReposCheck.addEventListener('change', () => {
        toggleAllRepositories(selectAllReposCheck.checked);
        updateGenerateButtonState();
        updateAppStatus();
    });
    
    // Submit config to fetch Git Logs
    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Cache Inputs
        localStorage.setItem('dev_name', devNameInput.value);
        localStorage.setItem('git_authors', JSON.stringify(getSelectedGitAuthors()));
        localStorage.setItem('job_title', jobTitleInput.value);

        const workMode = getWorkMode();
        const selectedAuthors = getSelectedGitAuthors();
        if (workMode !== 'uncommitted' && selectedAuthors.length === 0) {
            showToast('Warning', 'Add at least one Git Username for commit filtering.', true);
            return;
        }
        if (systemDirs.length === 0) {
            showToast('Warning', 'Add at least one project folder in Settings.', true);
            return;
        }
        localStorage.setItem('project_title', projTitleInput.value);
        saveSystemDirs();
        
        // Find checked repos
        const checkedBoxes = document.querySelectorAll('.repo-checkbox:checked');
        if (checkedBoxes.length === 0) {
            showToast('Warning', 'Select at least one repository from the list.', true);
            return;
        }
        
        const selectedRepos = Array.from(checkedBoxes).map(cb => ({
            name: cb.dataset.name,
            path: cb.value,
            branch: cb.dataset.branch,
            repo_identifier: cb.dataset.ident
        }));
        
        // Set UI loading status
        isFetchingLogs = true;
        updateAppStatus();
        fetchLogsBtn.disabled = true;
        fetchLogsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Extracting Logs...';
        inactiveRepositories = [];
        
        try {
            const logResult = await apiFetch('fetch_logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repos: selectedRepos,
                    since: sinceInput.value,
                    until: untilInput.value,
                    git_authors: getSelectedGitAuthors(),
                    work_mode: getWorkMode()
                })
            });
            const response = logResult.response;
            const data = logResult.data;

            if (!response.ok) {
                throw new Error(data.error || 'Backend error fetching logs');
            }

            fetchedCommits = data.commits || [];
            fetchedFiles = data.files || [];
            inactiveRepositories = data.inactive_repos || [];
            lastFetchedRepos = selectedRepos;
            logsFetched = true;
            
            // Build UI
            renderCommitsList();
            uncheckInactiveRepositories();
            generateDraftSections(selectedRepos);
            
            // Toggle view
            emptyState.style.display = 'none';
            editorWorkspace.style.display = 'flex';
            lastFetchedAt = new Date();
            if (lastFetchHint) {
                lastFetchHint.hidden = false;
                lastFetchHint.textContent = `Last fetched ${lastFetchedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${fetchedCommits.length} commit${fetchedCommits.length === 1 ? '' : 's'}`;
            }
            
            showToast('Success', `Successfully retrieved ${fetchedCommits.length} commits!`);
            updateGenerateButtonState();
            updateAppStatus();
            
            // Check for inactive repositories and warn the user
            if (data.inactive_repos && data.inactive_repos.length > 0) {
                setTimeout(() => {
                    showToast(
                        'Repos Unchecked',
                        `No commits in date range for: ${data.inactive_repos.join(', ')}. Those repos were unchecked automatically.`,
                        'warning'
                    );
                }, 1500);
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Failed to read git logs. Make sure Git is installed and repositories are accessible.', true);
        } finally {
            isFetchingLogs = false;
            fetchLogsBtn.disabled = false;
            fetchLogsBtn.innerHTML = '<i class="fa-solid fa-sync"></i> Fetch Git Logs';
            updateAppStatus();
        }
    });
    
    // Render the Git commit checklist
    function renderCommitsList() {
        commitsCountBadge.textContent = `${fetchedCommits.length} Commits Found`;
        commitsListContainer.innerHTML = '';
        
        if (fetchedCommits.length === 0) {
            commitsListContainer.innerHTML = '<p class="help-text">No commits found in the selected date range.</p>';
            selectAllCommitsCheck.checked = false;
            return;
        }
        
        selectAllCommitsCheck.checked = true;
        
        fetchedCommits.forEach((c, index) => {
            const div = document.createElement('div');
            div.className = 'commit-item';
            
            div.innerHTML = `
                <label class="checkbox-container">
                    <input type="checkbox" class="commit-checkbox" value="${c.hash}" data-index="${index}" checked>
                    <span class="checkmark"></span>
                </label>
                <div class="commit-meta">
                    <div class="commit-msg">${c.message}</div>
                    <div class="commit-details">
                        <span class="commit-repo-tag"><i class="fa-solid fa-folder-open"></i> ${c.repo}</span>
                        <span><i class="fa-solid fa-user"></i> ${c.author}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${c.date}</span>
                    </div>
                </div>
            `;
            
            // Watch checkbox changes to trigger dynamic updates if needed
            div.querySelector('input').addEventListener('change', () => {
                updateCheckedStats();
                syncGitLinkedReportSections();
                renderFileChangesGrid();
            });
            
            commitsListContainer.appendChild(div);
        });
    }
    
    // Toggle all commits
    selectAllCommitsCheck.addEventListener('change', () => {
        const checked = selectAllCommitsCheck.checked;
        document.querySelectorAll('.commit-checkbox').forEach(cb => {
            cb.checked = checked;
        });
        updateCheckedStats();
        syncGitLinkedReportSections();
        renderFileChangesGrid();
    });
    
    function hasSelectedInactiveRepo() {
        const checkedBoxes = document.querySelectorAll('.repo-checkbox:checked');
        const checkedNames = Array.from(checkedBoxes).map(cb => cb.dataset.name);
        return inactiveRepositories.some(name => checkedNames.includes(name));
    }

    function uncheckInactiveRepositories() {
        if (!inactiveRepositories.length) return;
        let changed = false;
        inactiveRepositories.forEach(name => {
            document.querySelectorAll('.repo-checkbox').forEach(cb => {
                if (cb.dataset.name === name && cb.checked) {
                    cb.checked = false;
                    changed = true;
                }
            });
        });
        if (changed && selectAllReposCheck) {
            const allChecked = document.querySelectorAll('.repo-checkbox').length ===
                document.querySelectorAll('.repo-checkbox:checked').length;
            selectAllReposCheck.checked = allChecked;
        }
    }

    function buildFallbackFileRowsFromCommits(activeCommits) {
        if (!activeCommits.length) return [];

        const byRepo = new Map();
        activeCommits.forEach(commit => {
            if (!byRepo.has(commit.repo)) byRepo.set(commit.repo, []);
            const messages = byRepo.get(commit.repo);
            const msg = String(commit.message || '').trim();
            if (msg && !messages.includes(msg)) messages.push(msg);
        });

        return [...byRepo.entries()].map(([repo, messages]) => ({
            file: `${repo} (selected commits)`,
            modifications: messages,
            modificationsText: messages.map(m => `• ${m}`).join('\n'),
            impact: 'General'
        }));
    }

    function getGenerateReadiness() {
        if (!logsFetched) {
            return { canGenerate: false, reason: 'Fetch git logs first.' };
        }

        const devName = devNameInput.value.trim();
        const jobTitle = jobTitleInput.value.trim();
        const projTitle = projTitleInput.value.trim();
        const sinceDate = sinceInput.value;
        const untilDate = untilInput.value;

        if (!devName || !jobTitle || !projTitle) {
            return { canGenerate: false, reason: 'Complete your profile in Settings (name, job title, project).' };
        }
        if (!sinceDate || !untilDate) {
            return { canGenerate: false, reason: 'Set a date range in the sidebar.' };
        }

        const activeCommits = getActiveCommits();
        const hasFileData = getFilteredFileData().length > 0;
        if (activeCommits.length === 0 && !hasFileData) {
            return { canGenerate: false, reason: 'Select at least one commit from the fetched log.' };
        }

        const execSummaryVal = fieldExecSummary.value.trim();
        const keyAccomplishmentsVal = fieldKeyAccomplishments.value.trim().split('\n').filter(l => l.trim() !== '');
        const impactVerificationVal = fieldImpactVerification.value.trim().split('\n').filter(l => l.trim() !== '');
        const verificationStatusVal = fieldVerificationStatus.value.trim();
        const fileRows = collectFileRowsForReport();

        if (!execSummaryVal) {
            return { canGenerate: false, reason: 'Fill in the Executive Summary section.' };
        }
        if (keyAccomplishmentsVal.length === 0) {
            return { canGenerate: false, reason: 'Fill in Key Accomplishments (or fetch logs again to auto-draft).' };
        }
        if (fileRows.length === 0) {
            return { canGenerate: false, reason: 'No file changes found. Select commits that include code changes.' };
        }
        if (impactVerificationVal.length === 0) {
            return { canGenerate: false, reason: 'Fill in Impact and Verification.' };
        }
        if (!verificationStatusVal) {
            return { canGenerate: false, reason: 'Fill in Verification Status.' };
        }

        const validationFailed = fileRows.some(row => !row.file || !row.modifications);
        if (validationFailed) {
            return { canGenerate: false, reason: 'File adjustments data is incomplete. Try fetching Git logs again.' };
        }

        return { canGenerate: true, reason: '' };
    }

    function getBranchesTextForReport() {
        const activeRepos = new Set(getActiveCommits().map(c => c.repo));
        const branchLines = [];

        document.querySelectorAll('.repo-checkbox:checked').forEach(cb => {
            if (activeRepos.has(cb.dataset.name)) {
                branchLines.push(`${cb.dataset.branch} / ${cb.dataset.ident}`);
            }
        });

        if (branchLines.length === 0 && lastFetchedRepos.length) {
            return lastFetchedRepos.map(r => `${r.branch} / ${r.repo_identifier}`).join('\n');
        }

        return branchLines.join('\n');
    }

    function buildOutputFileName(dateRangeText) {
        const safeDate = (dateRangeText || '').replace(/[\\/:*?"<>|]/g, '-');
        return `Accomplishment Report - ${safeDate}.docx`;
    }

    function joinOutputPath(dir, fileName) {
        if (!dir) return fileName || '';
        const trimmed = dir.replace(/[\\/]+$/, '');
        const sep = dir.includes('\\') ? '\\' : '/';
        return `${trimmed}${sep}${fileName}`;
    }

    function invalidateOutputDocsCache() {
        outputDocsCache = null;
        outputDocsCacheKey = '';
    }

    async function getOutputDocsInfo() {
        const key = outputDir || '';
        if (outputDocsCache && outputDocsCacheKey === key) {
            return outputDocsCache;
        }
        const { data } = await apiFetch('list_output_docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ output_dir: outputDir })
        });
        outputDocsCache = data;
        outputDocsCacheKey = key;
        return data;
    }

    function getReportSectionPreviewStats() {
        const exec = fieldExecSummary.value.trim();
        const execBlocks = exec ? exec.split(/\n\s*\n/).filter(block => block.trim()) : [];
        const execLines = exec ? exec.split('\n').filter(line => line.trim()) : [];
        const execCount = execBlocks.length > 1 ? execBlocks.length : execLines.length;

        const keyBullets = fieldKeyAccomplishments.value.trim().split('\n').filter(line => line.trim()).length;
        const fileRows = collectFileRowsForReport().length;
        const mode = getFileSectionMode();
        const modeLabels = { full: 'Full', compact: 'Compact', summary: 'Summary Only' };
        const impactBullets = fieldImpactVerification.value.trim().split('\n').filter(line => line.trim()).length;
        const verification = fieldVerificationStatus.value.trim();

        return [
            {
                ready: Boolean(exec),
                label: `Executive Summary${exec ? ` (${execCount} paragraph${execCount === 1 ? '' : 's'})` : ''}`
            },
            {
                ready: keyBullets > 0,
                label: `Key Accomplishments${keyBullets ? ` (${keyBullets} bullet${keyBullets === 1 ? '' : 's'})` : ''}`
            },
            {
                ready: fileRows > 0,
                label: `File Adjustments${fileRows ? ` (${fileRows} row${fileRows === 1 ? '' : 's'}, ${modeLabels[mode] || mode} mode)` : ''}`
            },
            {
                ready: impactBullets > 0,
                label: `Impact and Verification${impactBullets ? ` (${impactBullets} bullet${impactBullets === 1 ? '' : 's'})` : ''}`
            },
            {
                ready: Boolean(verification),
                label: 'Verification Status'
            }
        ];
    }

    async function updateReportOutputPreview() {
        if (!logsFetched) {
            if (stickyOutputHint) stickyOutputHint.hidden = true;
            return;
        }

        const token = ++previewRequestToken;

        const dateRangeStr = formatDateRange(sinceInput.value, untilInput.value);
        const fileName = buildOutputFileName(dateRangeStr);
        const previewFilename = document.getElementById('preview-filename');
        const previewPath = document.getElementById('preview-path');
        const previewTemplate = document.getElementById('preview-template');
        const previewWarning = document.getElementById('preview-warning');
        const previewSections = document.getElementById('preview-sections');

        if (previewFilename) previewFilename.textContent = fileName || '—';
        if (previewPath) previewPath.textContent = joinOutputPath(outputDir, fileName) || '—';

        const sections = getReportSectionPreviewStats();
        if (previewSections) {
            previewSections.innerHTML = sections.map(section => {
                const icon = section.ready ? 'fa-circle-check' : 'fa-circle';
                const cls = section.ready ? 'is-ready' : 'is-empty';
                return `<li class="${cls}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHtml(section.label)}</span></li>`;
            }).join('');
        }

        let hintText = '';

        try {
            const info = await getOutputDocsInfo();
            if (token !== previewRequestToken) return;

            if (previewTemplate) {
                const selectedTemplate = getSelectedTemplateInfoFromList(info.templates) || info.template;
                if (!selectedTemplate || selectedTemplate.missing) {
                    previewTemplate.textContent = `${getReportTemplateLabel()} — template file missing`;
                } else {
                    previewTemplate.textContent = selectedTemplate.name;
                }
            }

            if (previewWarning) {
                const exists = Array.isArray(info.files) && info.files.some(file => file.name === fileName);
                previewWarning.hidden = false;
                previewWarning.className = 'preview-warning';
                const selectedTemplate = getSelectedTemplateInfoFromList(info.templates) || info.template;

                if (!selectedTemplate || selectedTemplate.missing) {
                    previewWarning.classList.add('is-error');
                    hintText = 'Selected template file is missing from the app.';
                    previewWarning.textContent = 'Run: node template/build-default-template.js';
                } else if (!info.dir_exists) {
                    previewWarning.classList.add('is-warn');
                    hintText = 'Output folder will be created on generate.';
                    previewWarning.textContent = 'The output folder will be created when you generate, if the path is valid.';
                } else if (exists) {
                    previewWarning.classList.add('is-warn');
                    hintText = 'Existing file will be overwritten.';
                    previewWarning.textContent = 'A file with this name already exists and will be overwritten.';
                } else {
                    previewWarning.hidden = true;
                    previewWarning.textContent = '';
                }
            }
        } catch {
            if (token !== previewRequestToken) return;
            if (previewTemplate) previewTemplate.textContent = 'Could not load template info';
        }

        if (stickyOutputHint) {
            if (hintText) {
                stickyOutputHint.textContent = hintText;
                stickyOutputHint.hidden = false;
            } else {
                stickyOutputHint.hidden = true;
                stickyOutputHint.textContent = '';
            }
        }

        updateStickyTemplateMeta();
    }
    
    function updateGenerateButtonState() {
        const readiness = getGenerateReadiness();

        if (generateReportBtn) {
            generateReportBtn.disabled = isGeneratingReport || !logsFetched;
            generateReportBtn.classList.toggle('is-not-ready', !readiness.canGenerate && logsFetched && !isGeneratingReport);
            generateReportBtn.setAttribute('aria-disabled', String(!readiness.canGenerate && logsFetched && !isGeneratingReport));
        }

        if (stickyGenerateBlockReason) {
            if (!readiness.canGenerate && logsFetched && !isGeneratingReport) {
                stickyGenerateBlockReason.textContent = readiness.reason;
                stickyGenerateBlockReason.hidden = false;
            } else {
                stickyGenerateBlockReason.hidden = true;
                stickyGenerateBlockReason.textContent = '';
            }
        }

        updateReportOutputPreview();
        updateAppStatus();
    }
    
    function updateCheckedStats() {
        const checkedCount = document.querySelectorAll('.commit-checkbox:checked').length;
        commitsCountBadge.textContent = `${checkedCount} / ${fetchedCommits.length} Selected`;
        updateGenerateButtonState();
    }
    
    // Format Date Range into standard user string
    function formatDateRange(since, until) {
        if (!since || !until) return '';
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const d1 = new Date(since);
        const d2 = new Date(until);
        
        const m1 = months[d1.getMonth()];
        const m2 = months[d2.getMonth()];
        const y1 = d1.getFullYear();
        const y2 = d2.getFullYear();
        const day1 = d1.getDate();
        const day2 = d2.getDate();
        
        if (since === until) {
            return `${m1} ${day1}, ${y1}`;
        }
        
        if (y1 === y2) {
            if (m1 === m2) {
                return `${m1} ${day1} - ${day2}, ${y1}`;
            } else {
                return `${m1} ${day1} - ${m2} ${day2}, ${y1}`;
            }
        } else {
            return `${m1} ${day1}, ${y1} - ${m2} ${day2}, ${y2}`;
        }
    }
    
    // Generate draft descriptions for report sections
    function generateDraftSections(selectedRepos) {
        const devName = devNameInput.value;
        const sinceDate = sinceInput.value;
        const untilDate = untilInput.value;
        const dateRangeStr = formatDateRange(sinceDate, untilDate);
        
        // Compile branches metadata text
        const branchLines = selectedRepos.map(r => `${r.branch} / ${r.repo_identifier}`);
        const branchesStr = branchLines.join("\n");
        metaBranchesDisplay.innerHTML = branchLines.join("<br>");
        
        fieldKeyAccomplishments.value = generateKeyAccomplishmentsDraft();
        ensureActsSystemPhaseDefault();
        syncGitLinkedReportSections();
        renderFileChangesGrid();
        updateReportOutputPreview();
        
        // 5. Verification Status
        fieldVerificationStatus.value = "All updates serve correctly on staging. Local build checks confirm zero styling or layout collisions. External links were verified using internal tools and manual checks.";
    }

    function setTextareaValue(textarea, value) {
        if (!textarea) return;
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function getReportContext() {
        const selectedRepos = lastFetchedRepos.length > 0
            ? lastFetchedRepos
            : getSelectedReposFromSidebar();
        return {
            devName: devNameInput.value.trim(),
            dateRangeStr: formatDateRange(sinceInput.value, untilInput.value),
            selectedRepos
        };
    }

    function syncGitLinkedReportSections() {
        if (!logsFetched) return;
        const { devName, dateRangeStr, selectedRepos } = getReportContext();
        setTextareaValue(fieldExecSummary, generateExecSummaryDraft(devName, dateRangeStr, selectedRepos));
        setTextareaValue(fieldImpactVerification, generateImpactVerificationDraft());
        updateReportOutputPreview();
    }
    
    function generateExecSummaryDraft(devName, dateRangeStr, selectedRepos) {
        const activeCommits = getActiveCommits();
        const fileData = getFilteredFileData();
        const repoNames = selectedRepos.map(r => r.name).join(', ');
        const displayName = devName || 'the developer';

        if (activeCommits.length === 0) {
            return `On ${dateRangeStr}, ${displayName} reviewed work in the ${repoNames} system(s).\n\nNo commits are currently selected from the fetched git log.`;
        }

        const sortedCommits = [...activeCommits].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return a.message.localeCompare(b.message);
        });

        const uniqueCommits = [];
        const seen = new Set();
        sortedCommits.forEach(commit => {
            const key = `${commit.repo}|${commit.message.trim().toLowerCase()}`;
            if (seen.has(key)) return;
            seen.add(key);
            uniqueCommits.push(commit);
        });

        const lines = [
            `On ${dateRangeStr}, ${displayName} completed ${activeCommits.length} selected commit${activeCommits.length === 1 ? '' : 's'} across ${repoNames}, affecting ${fileData.length} file${fileData.length === 1 ? '' : 's'}.`,
            '',
            'Work from the fetched git log:'
        ];

        uniqueCommits.slice(0, 10).forEach(commit => {
            let message = commit.message.trim();
            if (!message.endsWith('.')) message += '.';
            lines.push(`• ${message} (${commit.repo}, ${commit.date})`);
        });

        if (uniqueCommits.length > 10) {
            lines.push(`• Plus ${uniqueCommits.length - 10} more distinct commit${uniqueCommits.length - 10 === 1 ? '' : 's'} in the selected period.`);
        }

        return lines.join('\n');
    }
    
    function generateKeyAccomplishmentsDraft() {
        const activeCommits = getActiveCommits();
        if (activeCommits.length === 0) {
            return "System Integration: Successfully deployed code updates to local repository and staging servers.\nCode Quality: Cleaned redundant styling configuration files and corrected documentation typos.";
        }
        
        // Group commits or translate them into formatted bullets
        let accomplishments = [];
        
        // Pick top commits and format them
        activeCommits.forEach(c => {
            const msg = c.message;
            // Clean up message
            let cleanMsg = msg.charAt(0).toUpperCase() + msg.slice(1);
            if (!cleanMsg.endsWith('.')) cleanMsg += '.';
            
            // Assign a category based on commit message keywords
            let category = 'Portal Enhancement';
            const lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('fix') || lowerMsg.includes('bug')) {
                category = 'System Fix & Debug';
            } else if (lowerMsg.includes('deploy') || lowerMsg.includes('workflow') || lowerMsg.includes('htaccess')) {
                category = 'Workflow & Deployment';
            } else if (lowerMsg.includes('ui') || lowerMsg.includes('ux') || lowerMsg.includes('style') || lowerMsg.includes('layout')) {
                category = 'UI/UX Improvements';
            } else if (lowerMsg.includes('remove') || lowerMsg.includes('delete') || lowerMsg.includes('cleanup')) {
                category = 'Repository Cleanup';
            } else if (lowerMsg.includes('add') || lowerMsg.includes('create') || lowerMsg.includes('new')) {
                category = 'Feature Addition';
            }
            
            accomplishments.push(`${category}: ${cleanMsg}`);
        });
        
        // Remove duplicates and limit to top 6
        accomplishments = [...new Set(accomplishments)].slice(0, 6);
        return accomplishments.join('\n');
    }
    
    function generateImpactVerificationDraft() {
        const activeCommits = getActiveCommits();
        const fileData = getFilteredFileData();

        if (activeCommits.length === 0) {
            return 'No verification items generated. Select commits from the fetched git log.';
        }

        const impacts = [];
        const repos = [...new Set(activeCommits.map(c => c.repo))];

        impacts.push(`Commit Coverage: Verified ${activeCommits.length} selected commit${activeCommits.length === 1 ? '' : 's'} from ${repos.join(', ')}.`);

        if (fileData.length > 0) {
            impacts.push(`File Changes: Confirmed ${fileData.length} modified file${fileData.length === 1 ? '' : 's'} match the selected commit history.`);
        }

        const uiFiles = fileData.filter(f => shortImpactLabel(f.file) === 'UI').length;
        const backendFiles = fileData.filter(f => shortImpactLabel(f.file) === 'Backend').length;
        const dbFiles = fileData.filter(f => shortImpactLabel(f.file) === 'Database').length;

        if (uiFiles > 0) {
            impacts.push(`Visual Quality: Reviewed ${uiFiles} UI-related file${uiFiles === 1 ? '' : 's'} for layout and styling consistency.`);
        }
        if (backendFiles > 0) {
            impacts.push(`Application Logic: Checked ${backendFiles} backend file${backendFiles === 1 ? '' : 's'} for request handling and business logic integrity.`);
        }
        if (dbFiles > 0) {
            impacts.push(`Data Layer: Validated ${dbFiles} database file${dbFiles === 1 ? '' : 's'} for schema and query consistency.`);
        }

        const fixCommits = activeCommits.filter(c => /fix|bug|resolve|patch/i.test(c.message));
        if (fixCommits.length > 0) {
            impacts.push(`Issue Resolution: Tracked ${fixCommits.length} fix-related commit${fixCommits.length === 1 ? '' : 's'} from the fetched log.`);
        }

        impacts.push('Workflow Integrity: Changes were cross-checked against the fetched git log for the selected date range.');

        return impacts.join('\n');
    }
    
    // Get checked commits
    function getActiveCommits() {
        const checkedBoxes = document.querySelectorAll('.commit-checkbox:checked');
        return Array.from(checkedBoxes)
            .map(cb => fetchedCommits[parseInt(cb.dataset.index, 10)])
            .filter(Boolean);
    }

    function getReportTemplateId() {
        const stored = localStorage.getItem(REPORT_TEMPLATE_KEY);
        return VALID_REPORT_TEMPLATES.includes(stored) ? stored : 'default';
    }

    function getReportTemplateLabel(templateId = getReportTemplateId()) {
        const option = reportTemplateSelect?.querySelector(`option[value="${templateId}"]`);
        return option ? option.textContent.trim() : (templateId === 'acts' ? 'ACTS Colleges (Extended)' : 'Default (5-section)');
    }

    function setReportTemplateId(templateId, persist = true) {
        const nextId = VALID_REPORT_TEMPLATES.includes(templateId) ? templateId : 'default';
        if (reportTemplateSelect) reportTemplateSelect.value = nextId;
        if (persist) localStorage.setItem(REPORT_TEMPLATE_KEY, nextId);
        syncActsMetaVisibility();
        updateStickyTemplateMeta();
        updateReportOutputPreview();
    }

    function syncActsMetaVisibility() {
        const isActs = getReportTemplateId() === 'acts';
        actsTemplateMetaFields.forEach(field => {
            field.hidden = !isActs;
        });
    }

    function loadActsMetaFromStorage() {
        if (actsEnvironmentInput) {
            actsEnvironmentInput.value = localStorage.getItem(ACTS_ENVIRONMENT_KEY) || 'Laragon (PHP 8.3, MySQL)';
        }
        if (actsSystemPhaseInput) {
            actsSystemPhaseInput.value = localStorage.getItem(ACTS_SYSTEM_PHASE_KEY) || '';
        }
        if (actsStatusInput) {
            actsStatusInput.value = localStorage.getItem(ACTS_STATUS_KEY) || 'Completed / For Continued Validation';
        }
    }

    function saveActsMetaToStorage() {
        if (actsEnvironmentInput) {
            localStorage.setItem(ACTS_ENVIRONMENT_KEY, actsEnvironmentInput.value.trim());
        }
        if (actsSystemPhaseInput) {
            localStorage.setItem(ACTS_SYSTEM_PHASE_KEY, actsSystemPhaseInput.value.trim());
        }
        if (actsStatusInput) {
            localStorage.setItem(ACTS_STATUS_KEY, actsStatusInput.value.trim());
        }
    }

    function ensureActsSystemPhaseDefault() {
        if (!actsSystemPhaseInput || actsSystemPhaseInput.value.trim()) return;
        const projectTitle = projTitleInput.value.trim();
        if (!projectTitle) return;
        actsSystemPhaseInput.value = `${projectTitle} development and integration`;
    }

    function updateStickyTemplateMeta() {
        if (!stickyTemplateMeta) return;
        stickyTemplateMeta.textContent = `Template: ${getReportTemplateLabel()}`;
    }

    function getSelectedTemplateInfoFromList(templates) {
        const templateId = getReportTemplateId();
        if (!Array.isArray(templates)) return null;
        return templates.find(template => template.id === templateId) || templates.find(template => template.id === 'default') || null;
    }

    function initReportTemplateSelect() {
        setReportTemplateId(getReportTemplateId(), false);
        loadActsMetaFromStorage();
        ensureActsSystemPhaseDefault();
        updateStickyTemplateMeta();

        if (reportTemplateSelect) {
            reportTemplateSelect.addEventListener('change', () => {
                setReportTemplateId(reportTemplateSelect.value);
                ensureActsSystemPhaseDefault();
                showToast('Template Updated', `Using ${getReportTemplateLabel()} layout.`);
            });
        }

        [actsEnvironmentInput, actsSystemPhaseInput, actsStatusInput].forEach(input => {
            if (!input) return;
            input.addEventListener('input', () => {
                saveActsMetaToStorage();
            });
        });
    }

    function getFileSectionMode() {
        const stored = localStorage.getItem(FILE_SECTION_MODE_KEY);
        return VALID_FILE_SECTION_MODES.includes(stored) ? stored : 'compact';
    }

    function setFileSectionMode(mode) {
        if (!VALID_FILE_SECTION_MODES.includes(mode)) return;
        localStorage.setItem(FILE_SECTION_MODE_KEY, mode);
        fileSectionModeRadios.forEach(radio => {
            radio.checked = radio.value === mode;
        });
    }

    function initFileSectionMode() {
        const mode = getFileSectionMode();
        fileSectionModeRadios.forEach(radio => {
            radio.checked = radio.value === mode;
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                setFileSectionMode(radio.value);
                if (logsFetched) {
                    renderFileChangesGrid();
                    updateReportOutputPreview();
                    showToast('View Updated', `File table switched to ${radio.parentElement.querySelector('span').textContent} mode.`);
                }
            });
        });
    }

    initFileSectionMode();
    initReportTemplateSelect();

    [fieldExecSummary, fieldKeyAccomplishments, fieldImpactVerification, fieldVerificationStatus].forEach(field => {
        field?.addEventListener('input', () => {
            updateReportOutputPreview();
            updateGenerateButtonState();
        });
    });

    function shortImpactLabel(filePath) {
        const ext = (filePath.split('.').pop() || '').split('?')[0].toLowerCase();
        if (['css', 'scss', 'sass', 'less', 'html', 'htm', 'vue', 'jsx', 'tsx'].includes(ext)) return 'UI';
        if (['js', 'ts', 'mjs', 'cjs'].includes(ext)) return 'UI';
        if (['php', 'py', 'java', 'rb', 'go', 'cs', 'rs'].includes(ext)) return 'Backend';
        if (ext === 'sql') return 'Database';
        if (['json', 'yml', 'yaml', 'xml', 'ini', 'conf', 'config', 'env', 'htaccess', 'toml'].includes(ext)) return 'Config';
        return 'General';
    }

    function getFileFolder(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : '(root)/';
    }

    function dominantImpactLabel(labels) {
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    function formatModificationsBullets(messages, maxBullets = COMPACT_MAX_BULLETS) {
        const unique = [...new Set(messages.map(m => m.trim()).filter(Boolean))];
        const shown = unique.slice(0, maxBullets);
        let text = shown.map(m => `• ${m}`).join('\n');
        const remaining = unique.length - shown.length;
        if (remaining > 0) {
            text += `\n(+${remaining} more changes)`;
        }
        return text;
    }

    function getFilteredFileData() {
        if (fetchedFiles.length === 0) return [];

        const activeCommits = getActiveCommits();
        const activeHashes = activeCommits.map(c => c.hash);
        const activeRepos = [...new Set(activeCommits.map(c => c.repo))];

        return fetchedFiles.filter(f => {
            if (!activeRepos.includes(f.repo)) return false;
            return f.modifications.some(mod => activeHashes.includes(mod.hash));
        }).map(fileInfo => {
            const activeMods = fileInfo.modifications.filter(mod => activeHashes.includes(mod.hash));
            return {
                file: fileInfo.file,
                modifications: activeMods.map(m => m.message),
                modificationsText: activeMods.map(m => `• ${m.message}`).join('\n'),
                impact: fileInfo.impact
            };
        }).sort((a, b) => a.file.localeCompare(b.file, undefined, { sensitivity: 'base' }));
    }

    function updateFileSortLabel(mode) {
        if (!fileSortLabel) return;
        if (mode === 'compact') {
            fileSortLabel.textContent = 'Sorted A–Z by folder';
        } else if (mode === 'summary') {
            fileSortLabel.textContent = 'Summary view from fetched log';
        } else {
            fileSortLabel.textContent = 'Sorted A–Z by file path';
        }
    }

    function compactFileRows(rawRows, mode) {
        if (mode === 'full') {
            return rawRows.map(row => ({
                file: row.file,
                modifications: row.modificationsText
            }));
        }

        if (mode === 'summary') {
            const totalFiles = rawRows.length;
            const folders = new Map();
            const allCommits = new Set();

            rawRows.forEach(row => {
                const folder = getFileFolder(row.file);
                folders.set(folder, (folders.get(folder) || 0) + 1);
                row.modifications.forEach(message => allCommits.add(message));
            });

            const topFolders = [...folders.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([folder, count]) => `${folder} (${count})`)
                .join(', ');

            return [{
                file: `${totalFiles} file${totalFiles === 1 ? '' : 's'} modified`,
                modifications: `Top areas: ${topFolders || 'N/A'}\n• ${allCommits.size} distinct commit change${allCommits.size === 1 ? '' : 's'} across selected repositories`
            }];
        }

        const groups = new Map();
        rawRows.forEach(row => {
            const folder = getFileFolder(row.file);
            if (!groups.has(folder)) groups.set(folder, []);
            groups.get(folder).push(row);
        });

        const groupedRows = [];
        for (const [folder, files] of groups) {
            const allMessages = [];

            files.forEach(file => {
                allMessages.push(...file.modifications);
            });

            groupedRows.push({
                file: files.length === 1 ? files[0].file : `${folder} (${files.length} files)`,
                modifications: formatModificationsBullets(allMessages),
                sortKey: folder,
                fileCount: files.length
            });
        }

        groupedRows.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }));
        return groupedRows.map(({ file, modifications }) => ({ file, modifications }));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    function collectFileRowsForReport() {
        let rawRows = getFilteredFileData();
        if (rawRows.length === 0) {
            rawRows = buildFallbackFileRowsFromCommits(getActiveCommits());
        }
        return compactFileRows(rawRows, getFileSectionMode());
    }

    function getFileTableTotalPages() {
        return Math.max(1, Math.ceil(cachedFileDisplayRows.length / FILE_TABLE_PAGE_SIZE));
    }

    function renderFileTablePagination() {
        const totalRows = cachedFileDisplayRows.length;
        const totalPages = getFileTableTotalPages();

        if (totalRows === 0) {
            fileTablePagination.hidden = true;
            return;
        }

        fileTablePagination.hidden = false;
        const start = (fileTableCurrentPage - 1) * FILE_TABLE_PAGE_SIZE + 1;
        const end = Math.min(fileTableCurrentPage * FILE_TABLE_PAGE_SIZE, totalRows);

        fileTablePaginationInfo.textContent = `Showing ${start}–${end} of ${totalRows} row${totalRows === 1 ? '' : 's'}`;
        fileTablePageLabel.textContent = `Page ${fileTableCurrentPage} of ${totalPages}`;
        fileTablePrevBtn.disabled = fileTableCurrentPage <= 1;
        fileTableNextBtn.disabled = fileTableCurrentPage >= totalPages;
    }

    function renderFileTablePage() {
        fileChangesTbody.innerHTML = '';

        if (cachedFileDisplayRows.length === 0) {
            const activeCommits = getActiveCommits();
            const emptyMessage = fetchedFiles.length === 0 && activeCommits.length === 0
                ? 'No modified files found. Fetch Git logs to populate this table.'
                : activeCommits.length > 0
                    ? 'No per-file changes linked to selected commits. Commit summaries will be used in the report.'
                    : 'No file modifications for selected commits.';
            fileChangesTbody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="2" class="text-center" style="color: var(--text-muted);">${emptyMessage}</td>
                </tr>
            `;
            renderFileTablePagination();
            return;
        }

        const totalPages = getFileTableTotalPages();
        if (fileTableCurrentPage > totalPages) {
            fileTableCurrentPage = totalPages;
        }

        const startIndex = (fileTableCurrentPage - 1) * FILE_TABLE_PAGE_SIZE;
        const pageRows = cachedFileDisplayRows.slice(startIndex, startIndex + FILE_TABLE_PAGE_SIZE);

        pageRows.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'grid-row';
            tr.innerHTML = `
                <td class="cell-file">${escapeHtml(row.file)}</td>
                <td class="cell-mods">${escapeHtml(row.modifications)}</td>
            `;
            fileChangesTbody.appendChild(tr);
        });

        renderFileTablePagination();
    }
    
    function renderFileChangesGrid() {
        fileTableCurrentPage = 1;
        let rawRows = getFilteredFileData();
        if (rawRows.length === 0) {
            rawRows = buildFallbackFileRowsFromCommits(getActiveCommits());
        }
        const mode = getFileSectionMode();
        updateFileSortLabel(mode);
        cachedFileDisplayRows = rawRows.length === 0 ? [] : compactFileRows(rawRows, mode);
        renderFileTablePage();
        updateGenerateButtonState();
    }

    fileTablePrevBtn.addEventListener('click', () => {
        if (fileTableCurrentPage > 1) {
            fileTableCurrentPage -= 1;
            renderFileTablePage();
        }
    });

    fileTableNextBtn.addEventListener('click', () => {
        if (fileTableCurrentPage < getFileTableTotalPages()) {
            fileTableCurrentPage += 1;
            renderFileTablePage();
        }
    });
    
    function getSelectedReposFromSidebar() {
        const checkedBoxes = document.querySelectorAll('.repo-checkbox:checked');
        return Array.from(checkedBoxes).map(cb => ({
            name: cb.dataset.name,
            path: cb.value,
            branch: cb.dataset.branch,
            repo_identifier: cb.dataset.ident
        }));
    }

    function handleRegenerateField(field) {
        if (!logsFetched) {
            showToast('Warning', 'Fetch Git logs first before regenerating report sections.', 'warning');
            return;
        }

        const { devName, dateRangeStr, selectedRepos } = getReportContext();

        if (field === 'executive_summary') {
            const previousValue = fieldExecSummary.value;
            const nextValue = generateExecSummaryDraft(devName, dateRangeStr, selectedRepos);
            setTextareaValue(fieldExecSummary, nextValue);
            const message = nextValue === previousValue
                ? 'Executive Summary is already in sync with the selected commits.'
                : 'Executive Summary updated from the selected git log.';
            showToast('Regenerated', message);
        } else if (field === 'impact_verification') {
            const previousValue = fieldImpactVerification.value;
            const nextValue = generateImpactVerificationDraft();
            setTextareaValue(fieldImpactVerification, nextValue);
            const message = nextValue === previousValue
                ? 'Impact and Verification is already in sync with the selected commits.'
                : 'Impact and Verification updated from the selected git log.';
            showToast('Regenerated', message);
        }
    }

    // Regenerate button event handlers (delegated for reliability)
    editorWorkspace.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-regenerate');
        if (!btn) return;

        e.preventDefault();
        handleRegenerateField(btn.dataset.field);
    });
    
    // Submit/Generate DOCX report action
    async function generateReport() {
        const readiness = getGenerateReadiness();
        if (!readiness.canGenerate) {
            showToast('Cannot Generate', readiness.reason, 'warning');
            return;
        }

        const devName = devNameInput.value.trim();
        const jobTitle = jobTitleInput.value.trim();
        const projTitle = projTitleInput.value.trim();
        const sinceDate = sinceInput.value;
        const untilDate = untilInput.value;
        const branchesTextStr = getBranchesTextForReport();
        const dateRangeStr = formatDateRange(sinceDate, untilDate);
        const fileRows = collectFileRowsForReport();
        const activeCommits = getActiveCommits();
        const repoCount = branchesTextStr.split('\n').filter(Boolean).length;

        const execSummaryVal = fieldExecSummary.value.trim();
        const keyAccomplishmentsVal = fieldKeyAccomplishments.value.trim().split('\n').filter(l => l.trim() !== '');
        const impactVerificationVal = fieldImpactVerification.value.trim().split('\n').filter(l => l.trim() !== '');
        const verificationStatusVal = fieldVerificationStatus.value.trim();

        setGenerateButtonBusy(true);
        showReportLoadingOverlay(buildOutputFileName(dateRangeStr));

        try {
            const payload = {
                template_id: getReportTemplateId(),
                developer_name: devName,
                job_title: jobTitle,
                project_title: projTitle,
                date_range_text: dateRangeStr,
                branches_text: branchesTextStr,
                executive_summary: execSummaryVal,
                key_accomplishments: keyAccomplishmentsVal,
                detailed_files: fileRows,
                file_section_mode: getFileSectionMode(),
                impact_verification: impactVerificationVal,
                verification_status: verificationStatusVal,
                commit_count: activeCommits.length,
                file_count: fileRows.length,
                repo_count: repoCount,
                report_status: 'On Track / For Review',
                generated_date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                acts_environment: actsEnvironmentInput?.value.trim() || '',
                acts_system_phase: actsSystemPhaseInput?.value.trim() || '',
                acts_status: actsStatusInput?.value.trim() || '',
                output_dir: outputDir
            };

            saveActsMetaToStorage();

            const reportResult = await apiFetch('generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!reportResult.response.ok) {
                throw new Error(reportResult.data.error || `Server error (${reportResult.response.status})`);
            }

            const result = reportResult.data;

            if (result.success) {
                const savedPath = result.file_path || joinOutputPath(outputDir, result.file_name);
                await hideReportLoadingOverlay({ success: true });
                const toastMsg = result.alternate_name_used
                    ? `The original file was open or locked. Saved as: ${savedPath}`
                    : `File saved to ${savedPath}`;
                showToast('Report Generated!', toastMsg);
                console.log('Saved to:', savedPath);
                invalidateOutputDocsCache();
                updateReportOutputPreview();
            } else {
                throw new Error(result.error || 'Unknown server error');
            }
        } catch (err) {
            console.error(err);
            await hideReportLoadingOverlay({ success: false });
            showToast('Error', err.message || 'Failed to generate report. Make sure the output path is writable.', true);
        } finally {
            setGenerateButtonBusy(false);
            updateGenerateButtonState();
        }
    }

    generateReportBtn.addEventListener('click', generateReport);
});
