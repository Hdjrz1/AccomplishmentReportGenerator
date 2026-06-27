const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const TEMPLATE_DIR = path.join(__dirname, 'template');
const DEFAULT_TEMPLATE_DOCX = path.join(TEMPLATE_DIR, 'default-template.docx');
const DEFAULT_TEMPLATE_MD = path.join(TEMPLATE_DIR, 'default-template.md');
const ACTS_TEMPLATE_DOCX = path.join(TEMPLATE_DIR, 'acts-template.docx');
const ACTS_TEMPLATE_MD = path.join(TEMPLATE_DIR, 'acts-template.md');

const REPORT_TEMPLATES = {
  default: {
    id: 'default',
    label: 'Default (5-section)',
    docx: DEFAULT_TEMPLATE_DOCX,
    spec: DEFAULT_TEMPLATE_MD,
    build: 'buildDefaultTemplateDocx'
  },
  acts: {
    id: 'acts',
    label: 'ACTS Colleges (Extended)',
    docx: ACTS_TEMPLATE_DOCX,
    spec: ACTS_TEMPLATE_MD,
    build: null
  }
};

const DEFAULT_CONFIG = {
  system_dirs: [],
  output_dir: path.join(os.homedir(), 'Documents', 'Accomplishment Reports')
};

function expandPath(value) {
  if (!value) return '';
  const home = os.homedir();
  const username = process.env.USERNAME || process.env.USER || '';
  let expanded = String(value)
    .replace(/%USERPROFILE%/gi, home)
    .replace(/%HOMEPATH%/gi, home)
    .replace(/%USERNAME%/gi, username);
  return path.normalize(expanded);
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return {
        system_dirs: Array.isArray(parsed.system_dirs)
          ? parsed.system_dirs.map(expandPath).filter(Boolean)
          : [],
        output_dir: expandPath(parsed.output_dir || DEFAULT_CONFIG.output_dir)
      };
    }
  } catch {
    // fall through to defaults
  }

  return {
    system_dirs: [],
    output_dir: expandPath(DEFAULT_CONFIG.output_dir)
  };
}

function resolveSystemDirs(requestedDirs) {
  const config = loadConfig();
  const source = Array.isArray(requestedDirs) && requestedDirs.length
    ? requestedDirs
    : config.system_dirs;

  return [...new Set(
    source
      .map(dir => expandPath(String(dir || '').trim()))
      .filter(Boolean)
  )];
}

function isValidSystemDir(dir) {
  const resolved = expandPath(dir);
  try {
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

function resolveOutputDir(requestedDir) {
  if (requestedDir && String(requestedDir).trim()) {
    return expandPath(requestedDir);
  }
  return loadConfig().output_dir;
}

function buildOutputFileName(dateRangeText) {
  const safeDate = String(dateRangeText || '').replace(/[\\/:*?"<>|]/g, '-');
  return `Accomplishment Report - ${safeDate}.docx`;
}

function ensureTemplateDocx(templateId = 'default') {
  const entry = REPORT_TEMPLATES[templateId] || REPORT_TEMPLATES.default;
  if (fs.existsSync(entry.docx)) {
    return entry.docx;
  }

  if (entry.id === 'acts') {
    throw new Error(`ACTS report template not found at ${entry.docx}. Copy your ACTS Colleges .docx to template/acts-template.docx.`);
  }

  try {
    const builder = require('./template/build-default-template');
    const buildFn = builder[entry.build];
    if (typeof buildFn === 'function') {
      return buildFn();
    }
  } catch {
    // fall through
  }

  throw new Error(`Report template not found at ${entry.docx}`);
}

function ensureDefaultTemplate() {
  return ensureTemplateDocx('default');
}

function getTemplateInfo(templateId = 'default') {
  const entry = REPORT_TEMPLATES[templateId] || REPORT_TEMPLATES.default;
  try {
    const templatePath = ensureTemplateDocx(entry.id);
    const stat = fs.statSync(templatePath);
    return {
      id: entry.id,
      label: entry.label,
      name: path.basename(templatePath),
      path: templatePath,
      mtime: stat.mtimeMs,
      source: 'bundled',
      spec_path: fs.existsSync(entry.spec) ? entry.spec : null
    };
  } catch {
    return {
      id: entry.id,
      label: entry.label,
      name: path.basename(entry.docx),
      path: entry.docx,
      mtime: null,
      source: 'bundled',
      spec_path: fs.existsSync(entry.spec) ? entry.spec : null,
      missing: true
    };
  }
}

function listReportTemplates() {
  return Object.keys(REPORT_TEMPLATES).map(id => getTemplateInfo(id));
}

function getDefaultTemplateInfo() {
  return getTemplateInfo('default');
}

function resolveReportTemplate(templateId = 'default') {
  const entry = REPORT_TEMPLATES[templateId] ? templateId : 'default';
  return ensureTemplateDocx(entry);
}

function listOutputDocs(requestedDir = null) {
  const outputDir = resolveOutputDir(requestedDir);
  const result = {
    output_dir: outputDir,
    dir_exists: false,
    files: [],
    template: getDefaultTemplateInfo(),
    templates: listReportTemplates()
  };

  if (!fs.existsSync(outputDir)) {
    return result;
  }

  let stat;
  try {
    stat = fs.statSync(outputDir);
  } catch {
    return result;
  }

  if (!stat.isDirectory()) {
    return result;
  }

  result.dir_exists = true;

  const files = fs.readdirSync(outputDir)
    .filter(name => name.toLowerCase().endsWith('.docx') && !name.startsWith('~$'))
    .map(name => {
      const fullPath = path.join(outputDir, name);
      const fileStat = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        mtime: fileStat.mtimeMs,
        size: fileStat.size
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  result.files = files;

  return result;
}

function resolveGitExecutable() {
  const { execFileSync } = require('child_process');
  const candidates = [
    process.env.GIT_EXECUTABLE,
    process.env.GIT_PATH,
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(process.env.ProgramFiles || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
    'C:\\laragon\\bin\\git\\cmd\\git.exe',
    'C:\\laragon\\bin\\git\\bin\\git.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // continue
    }
  }

  try {
    const whereOutput = execFileSync('where.exe', ['git'], {
      windowsHide: true,
      encoding: 'utf8'
    }).trim();
    const first = whereOutput.split(/\r?\n/).map(line => line.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch {
    // fall through
  }

  return 'git';
}

const REPO_SCAN_MAX_DEPTH = 4;

const REPO_SCAN_SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', '.next', '.nuxt', 'coverage',
  '__pycache__', '.venv', 'venv', 'target', 'bin', 'obj', 'packages',
  'bower_components', '.cache', '.turbo', 'out', '.gradle', '.idea', 'tmp', 'temp'
]);

function isGitRepository(dirPath) {
  try {
    return fs.existsSync(path.join(dirPath, '.git'));
  } catch {
    return false;
  }
}

function getRepoDisplayName(repoPath, systemRoot) {
  const resolvedRepo = path.resolve(repoPath);
  const resolvedRoot = path.resolve(systemRoot);
  if (resolvedRepo.toLowerCase() === resolvedRoot.toLowerCase()) {
    return path.basename(resolvedRoot);
  }
  const rel = path.relative(resolvedRoot, resolvedRepo);
  if (!rel || rel.startsWith('..')) return path.basename(resolvedRepo);
  return rel.split(path.sep).join('/');
}

function discoverGitRepoPaths(systemDir, maxDepth = REPO_SCAN_MAX_DEPTH) {
  const resolvedRoot = expandPath(systemDir);
  if (!isValidSystemDir(resolvedRoot)) return [];

  const results = [];
  const seen = new Set();

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;

    if (isGitRepository(currentDir)) {
      const key = path.resolve(currentDir).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          path: path.resolve(currentDir),
          system_root: resolvedRoot,
          name: getRepoDisplayName(currentDir, resolvedRoot)
        });
      }
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirName = entry.name;
      if (dirName === '.' || dirName === '..') continue;
      if (dirName.startsWith('.')) continue;
      if (REPO_SCAN_SKIP_DIRS.has(dirName.toLowerCase())) continue;

      walk(path.join(currentDir, dirName), depth + 1);
    }
  }

  walk(resolvedRoot, 0);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function findRepoPathsFromSystemDirs(systemDirs, limit = 8) {
  const repos = [];
  const dirs = Array.isArray(systemDirs) ? systemDirs : [];

  for (const systemDir of dirs) {
    for (const hit of discoverGitRepoPaths(systemDir)) {
      if (!repos.includes(hit.path)) {
        repos.push(hit.path);
        if (repos.length >= limit) return repos;
      }
    }
  }

  return repos;
}

function buildSuggestedAuthor(name, email) {
  const cleanName = String(name || '').trim();
  if (cleanName) return cleanName;
  const cleanEmail = String(email || '').trim();
  if (cleanEmail && cleanEmail.includes('@')) {
    return cleanEmail.split('@')[0];
  }
  return '';
}

async function getGitIdentity(options = {}) {
  const { execFile } = require('child_process');
  const opts = typeof options === 'string' ? { repo_path: options } : (options || {});
  const explicitRepo = expandPath(opts.repo_path || '');
  const systemDirs = Array.isArray(opts.system_dirs) ? opts.system_dirs : [];
  const gitExe = resolveGitExecutable();

  const runGit = (args) => new Promise(resolve => {
    execFile(gitExe, args, { windowsHide: true }, (error, stdout) => {
      resolve(error ? '' : String(stdout || '').trim());
    });
  });

  const probe = await runGit(['--version']);
  if (!probe) {
    return {
      name: '',
      email: '',
      suggested_author: '',
      source: '',
      git_found: false,
      error: 'Git was not found. Install Git for Windows or add it to your system PATH.'
    };
  }

  let name = '';
  let email = '';
  let source = '';

  const tryConfig = async (args, configSource) => {
    if (name && email) return;
    const configName = await runGit([...args, 'user.name']);
    const configEmail = await runGit([...args, 'user.email']);
    if (!name && configName) {
      name = configName;
      source = configSource;
    }
    if (!email && configEmail) {
      email = configEmail;
      if (!source) source = configSource;
    }
  };

  await tryConfig(['config', '--global'], 'global');
  await tryConfig(['config', '--system'], 'system');

  const repoCandidates = [];
  if (explicitRepo && fs.existsSync(explicitRepo)) repoCandidates.push(explicitRepo);
  for (const repoPath of findRepoPathsFromSystemDirs(systemDirs)) {
    if (!repoCandidates.includes(repoPath)) repoCandidates.push(repoPath);
  }

  for (const repoPath of repoCandidates) {
    if (name && email) break;
    await tryConfig(['-C', repoPath, 'config'], 'repo_config');
  }

  if (!name || !email) {
    for (const repoPath of repoCandidates) {
      const logLine = await runGit(['-C', repoPath, 'log', '-1', '--format=%an|%ae']);
      if (!logLine || !logLine.includes('|')) continue;

      const [logName, logEmail] = logLine.split('|', 2);
      if (!name && logName) {
        name = logName.trim();
        source = 'recent_commit';
      }
      if (!email && logEmail) {
        email = logEmail.trim();
        if (!source) source = 'recent_commit';
      }
      if (name && email) break;
    }
  }

  const suggestedAuthor = buildSuggestedAuthor(name, email);

  if (!suggestedAuthor) {
    return {
      name,
      email,
      suggested_author: '',
      source: '',
      git_found: true,
      error: repoCandidates.length
        ? 'No git user identity found in config or recent commits. Add your username manually.'
        : 'No git user identity found. Set git config user.name or add a project folder first.'
    };
  }

  return {
    name,
    email,
    suggested_author: suggestedAuthor,
    source,
    git_found: true,
    error: ''
  };
}

module.exports = {
  loadConfig,
  resolveSystemDirs,
  resolveOutputDir,
  buildOutputFileName,
  listOutputDocs,
  getDefaultTemplateInfo,
  getTemplateInfo,
  listReportTemplates,
  resolveReportTemplate,
  ensureDefaultTemplate,
  ensureTemplateDocx,
  expandPath,
  isValidSystemDir,
  getGitIdentity,
  resolveGitExecutable,
  discoverGitRepoPaths,
  REPO_SCAN_MAX_DEPTH
};
