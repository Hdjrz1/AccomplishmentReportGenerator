const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { loadConfig, resolveSystemDirs, resolveOutputDir, listOutputDocs, listReportTemplates, expandPath, isValidSystemDir, detectCommonDirs, getGitIdentity } = require('./config');

const ROOT = __dirname;
const ROOT_NORMALIZED = path.resolve(ROOT).toLowerCase();
const PORT = Number(process.env.PORT || 3000);

const IGNORED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff',
  'woff', 'woff2', 'ttf', 'eot', 'otf', 'mp4', 'mp3', 'wav',
  'zip', 'tar', 'gz', 'rar', '7z', 'pdf', 'docx', 'xlsx', 'pptx'
]);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function runGit(repoPath, args) {
  return new Promise(resolve => {
    execFile('git', ['-C', repoPath, ...args], { windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        output: `${stdout || ''}${stderr || ''}`.trim()
      });
    });
  });
}

function parseRepoOwnerRepo(url) {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.endsWith('.git')) cleaned = cleaned.slice(0, -4);

  const githubMatch = cleaned.match(/github\.com[:/](.+)$/i);
  if (githubMatch) return githubMatch[1];

  const parts = cleaned.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  return path.basename(cleaned);
}

function shouldIgnoreFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  return normalized.includes('vendor/') ||
    normalized.includes('node_modules/') ||
    normalized.includes('composer.lock') ||
    normalized.includes('package-lock.json') ||
    normalized.includes('.git') ||
    IGNORED_EXTENSIONS.has(ext);
}

async function getRepositories(systemDirs) {
  const repos = [];
  const dirs = resolveSystemDirs(systemDirs);

  for (const systemDir of dirs) {
    if (!fs.existsSync(systemDir)) continue;

    const entries = fs.readdirSync(systemDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(systemDir, entry.name);
      if (!fs.existsSync(path.join(fullPath, '.git'))) continue;

      const branchRes = await runGit(fullPath, ['branch', '--show-current']);
      const remoteRes = await runGit(fullPath, ['remote', 'get-url', 'origin']);
      const remoteUrl = remoteRes.success ? remoteRes.output.trim() : '';
      const repoIdentifier = parseRepoOwnerRepo(remoteUrl) || entry.name;

      repos.push({
        name: entry.name,
        path: fullPath,
        branch: branchRes.success && branchRes.output.trim() ? branchRes.output.trim() : 'main',
        remote_url: remoteUrl,
        repo_identifier: repoIdentifier,
        system_root: systemDir
      });
    }
  }

  return repos;
}

function formatDateTodayManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function statusDescription(statusRaw) {
  if (statusRaw.includes('?') || statusRaw.includes('A')) {
    return { status: 'A', desc: 'Created new file and implemented initial structure.' };
  }
  if (statusRaw.includes('D')) {
    return { status: 'D', desc: 'Deleted file from repository.' };
  }
  if (statusRaw.includes('R')) {
    return { status: 'M', desc: 'Renamed/moved file and refined content.' };
  }
  return { status: 'M', desc: 'Modified and updated application logic.' };
}

function defaultImpact(file, status) {
  const ext = path.extname(file).replace('.', '').toLowerCase();
  if (status === 'A') return 'Establishes new system components and expands application feature set.';
  if (['css', 'scss'].includes(ext)) return 'Refines user interface style, consistency, and responsive layouts.';
  if (['js', 'ts'].includes(ext)) return 'Enhances interactive UI controls, validation, and event handling.';
  if (['php', 'py', 'java'].includes(ext)) return 'Optimizes backend business logic, API requests, and data security.';
  if (ext === 'sql') return 'Updates database schema and structures core system tables.';
  return 'Improves application structure and code organization.';
}

async function fetchGitLogs(repos, since, until, authors = [], workMode = 'both') {
  const commits = [];
  const filesMap = new Map();
  const inactiveRepos = [];
  const sinceQuery = since ? `${since} 00:00:00` : '';
  const untilQuery = until ? `${until} 23:59:59` : '';
  const today = formatDateTodayManila();
  const includeCommitted = workMode !== 'uncommitted';
  const includeUncommittedChanges = workMode !== 'commits';
  const authorFilters = (Array.isArray(authors) ? authors : [authors])
    .map(author => String(author || '').trim())
    .filter(Boolean);

  const appendAuthorFilter = (args) => {
    authorFilters.forEach(author => args.push(`--author=${author}`));
  };

  for (const repo of repos) {
    const repoPath = repo.path;
    const repoName = repo.name;
    let hasCommits = false;

    if (includeCommitted) {
      const logArgs = ['log'];

      if (sinceQuery) logArgs.push(`--since=${sinceQuery}`);
      if (untilQuery) logArgs.push(`--until=${untilQuery}`);
      appendAuthorFilter(logArgs);
      logArgs.push('--pretty=format:%H|%ad|%an|%s', '--date=short');

      const logRes = await runGit(repoPath, logArgs);
      if (logRes.success && logRes.output.trim()) {
        for (const rawLine of logRes.output.split(/\r?\n/)) {
          const line = rawLine.trim().replace(/^"|"$/g, '');
          if (!line) continue;

          const parts = line.split('|');
          if (parts.length >= 4) {
            commits.push({
              hash: parts[0],
              date: parts[1],
              author: parts[2],
              message: parts.slice(3).join('|'),
              repo: repoName
            });
            hasCommits = true;
          }
        }
      }
    }

    const uncommittedFiles = [];
    const mockHash = `uncommitted_${repoName}`;
    const shouldScanStatus = includeUncommittedChanges && (
      workMode === 'uncommitted' ||
      ((!since || since <= today) && (!until || until >= today))
    );

    if (shouldScanStatus) {
      const statusRes = await runGit(repoPath, ['status', '--porcelain']);
      if (statusRes.success && statusRes.output.trim()) {
        for (const rawLine of statusRes.output.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line) continue;

          const status = line.slice(0, 2);
          let filePath = line.slice(2).trim();
          if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop().trim();
          if (shouldIgnoreFile(filePath)) continue;

          uncommittedFiles.push({ file: filePath, status });
        }

        if (uncommittedFiles.length) {
          commits.push({
            hash: mockHash,
            date: today,
            author: 'Local Workspace',
            message: 'Uncommitted Changes (Work in Progress)',
            repo: repoName
          });
          hasCommits = true;
        }
      }
    }

    if (!hasCommits) inactiveRepos.push(repoName);

    if (includeCommitted) {
      const fileLogArgs = ['log'];
      if (sinceQuery) fileLogArgs.push(`--since=${sinceQuery}`);
      if (untilQuery) fileLogArgs.push(`--until=${untilQuery}`);
      appendAuthorFilter(fileLogArgs);
      fileLogArgs.push('--name-status', '--pretty=format:COMMIT:%H|%s');

      const fileRes = await runGit(repoPath, fileLogArgs);
      if (fileRes.success && fileRes.output.trim()) {
        let currentCommitHash = '';
        let currentCommitMsg = '';

        for (const rawLine of fileRes.output.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.startsWith('COMMIT:')) {
            const commitData = line.slice(7);
            const splitAt = commitData.indexOf('|');
            currentCommitHash = splitAt >= 0 ? commitData.slice(0, splitAt) : commitData;
            currentCommitMsg = splitAt >= 0 ? commitData.slice(splitAt + 1) : '';
            continue;
          }

          const match = line.match(/^([AMDR])\s+(.+)$/);
          if (!currentCommitMsg || !match) continue;

          const status = match[1];
          const filePath = match[2];
          if (shouldIgnoreFile(filePath)) continue;

          const key = `${repoName}:${filePath}`;
          if (!filesMap.has(key)) {
            filesMap.set(key, {
              file: filePath,
              repo: repoName,
              status,
              modifications: []
            });
          }

          const item = filesMap.get(key);
          if (!item.modifications.some(mod => mod.hash === currentCommitHash)) {
            item.modifications.push({ hash: currentCommitHash, message: currentCommitMsg });
          }
        }
      }
    }

    for (const file of uncommittedFiles) {
      const { status, desc } = statusDescription(file.status.trim());
      const key = `${repoName}:${file.file}`;
      if (!filesMap.has(key)) {
        filesMap.set(key, {
          file: file.file,
          repo: repoName,
          status,
          modifications: []
        });
      }
      filesMap.get(key).modifications.push({ hash: mockHash, message: desc });
    }
  }

  const files = Array.from(filesMap.values()).map(file => ({
    ...file,
    modifications_text: file.modifications.map(mod => `• ${mod.message}`).join('\n'),
    impact: defaultImpact(file.file, file.status)
  })).sort((a, b) => {
    if (a.repo === b.repo) return a.file.localeCompare(b.file);
    return a.repo.localeCompare(b.repo);
  });

  return { commits, files, inactive_repos: inactiveRepos };
}

async function generateReport(data) {
  const tempFile = path.join(os.tmpdir(), `arg_${Date.now()}_${Math.random().toString(16).slice(2)}.json`);
  const payload = {
    ...data,
    output_dir: resolveOutputDir(data.output_dir)
  };
  fs.writeFileSync(tempFile, JSON.stringify(payload), 'utf8');

  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(ROOT, 'generator.js'), tempFile], { windowsHide: true }, (error, stdout, stderr) => {
      fs.rmSync(tempFile, { force: true });
      const output = `${stdout || ''}${stderr || ''}`.trim();

      try {
        const result = JSON.parse(output);
        if (error || !result.success) {
          reject(new Error(`Node.js DOCX Generation Failed: ${result.error || output}`));
        } else {
          resolve(result);
        }
      } catch {
        reject(new Error(`Node.js DOCX Generation Failed: ${output || error?.message || 'Unknown error'}`));
      }
    });
  });
}

function serveFavicon(res) {
  const faviconPath = path.join(ROOT, 'assets', 'arb-logo.png');
  if (!fs.existsSync(faviconPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'image/png' });
  fs.createReadStream(faviconPath).pipe(res);
}

function serveIndex(res) {
  const source = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
  const phpEnd = source.indexOf('?>');
  const html = phpEnd >= 0 ? source.slice(phpEnd + 2) : source;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function serveStatic(req, res, pathname) {
  const filePath = path.resolve(ROOT, pathname);
  if (!filePath.toLowerCase().startsWith(ROOT_NORMALIZED)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
  };
  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function validateFolderPath(requestedPath) {
  const folderPath = expandPath(String(requestedPath || '').trim());
  if (!folderPath) {
    return { valid: false, path: '', error: 'Enter a folder path.' };
  }
  try {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { valid: false, path: folderPath, error: 'That folder does not exist or is not accessible.' };
    }
  } catch {
    return { valid: false, path: folderPath, error: 'That folder does not exist or is not accessible.' };
  }
  return { valid: true, path: folderPath, error: '' };
}

async function handleApi(req, res, action) {
  try {
    if (action === 'get_config') {
      return sendJson(res, 200, loadConfig());
    }

    if (action === 'get_repos') {
      const input = req.method === 'POST' ? await readJsonBody(req) : {};
      const systemDirs = resolveSystemDirs(input.system_dirs);
      const repos = await getRepositories(systemDirs);
      return sendJson(res, 200, {
        repos,
        system_dirs: systemDirs,
        output_dir: loadConfig().output_dir,
        suggested_folders: loadConfig().suggested_folders
      });
    }

    if (action === 'detect_common_dirs') {
      return sendJson(res, 200, { dirs: detectCommonDirs() });
    }

    if (action === 'get_git_identity') {
      const input = req.method === 'POST' ? await readJsonBody(req) : {};
      return sendJson(res, 200, await getGitIdentity(input));
    }

    if (action === 'validate_folder') {
      const input = req.method === 'POST' ? await readJsonBody(req) : {};
      return sendJson(res, 200, validateFolderPath(input.path));
    }

    if (action === 'fetch_logs') {
      const input = await readJsonBody(req);
      return sendJson(res, 200, await fetchGitLogs(
        input.repos || [],
        input.since || '',
        input.until || '',
        input.git_authors || (input.git_author ? [input.git_author] : []),
        input.work_mode || 'both'
      ));
    }

    if (action === 'generate_report') {
      return sendJson(res, 200, await generateReport(await readJsonBody(req)));
    }

    if (action === 'list_output_docs') {
      const input = req.method === 'POST' ? await readJsonBody(req) : {};
      return sendJson(res, 200, listOutputDocs(input.output_dir));
    }

    if (action === 'list_report_templates') {
      return sendJson(res, 200, { templates: listReportTemplates() });
    }

    return sendJson(res, 404, { error: 'Action not found' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action');

    if (action) {
      handleApi(req, res, action);
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/favicon.ico') {
      serveFavicon(res);
      return;
    }

    if (pathname === '/' || pathname === '/index.php' || pathname.endsWith('/index.php')) {
      serveIndex(res);
      return;
    }

    serveStatic(req, res, decodeURIComponent(url.pathname.replace(/^\/+/, '')));
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && port < PORT + 10) {
      createServer(port + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`ARB Accomplishment Report Builder running at http://localhost:${port}`);
  });
}

createServer(PORT);
