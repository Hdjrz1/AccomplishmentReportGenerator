/**
 * Temp preview sessions — DOCX built here until user confirms save to output_dir.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { resolveOutputDir, buildOutputFileName } = require('./config');

const ROOT = __dirname;
const PREVIEW_ROOT = path.join(os.tmpdir(), 'arb-previews');
const PREVIEW_TTL_MS = 60 * 60 * 1000;

function sanitizePreviewId(previewId) {
  const value = String(previewId || '').trim();
  if (!/^p_[a-z0-9_]+$/i.test(value)) {
    throw new Error('Invalid preview id.');
  }
  return value;
}

function getPreviewDir(previewId) {
  return path.join(PREVIEW_ROOT, sanitizePreviewId(previewId));
}

function runGenerator(payload) {
  const tempFile = path.join(os.tmpdir(), `arg_${Date.now()}_${Math.random().toString(16).slice(2)}.json`);
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

function writePreviewMeta(previewDir, meta) {
  fs.writeFileSync(path.join(previewDir, 'preview-meta.json'), JSON.stringify(meta), 'utf8');
}

function readPreviewMeta(previewDir) {
  const metaPath = path.join(previewDir, 'preview-meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error('Preview session not found or expired.');
  }
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

function cleanupExpiredPreviews() {
  if (!fs.existsSync(PREVIEW_ROOT)) return;
  const now = Date.now();
  for (const entry of fs.readdirSync(PREVIEW_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(PREVIEW_ROOT, entry.name);
    try {
      const meta = readPreviewMeta(dir);
      if (now - Number(meta.created_at || 0) > PREVIEW_TTL_MS) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

async function createPreviewReport(data) {
  cleanupExpiredPreviews();

  const previewId = `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const previewDir = getPreviewDir(previewId);
  fs.mkdirSync(previewDir, { recursive: true });

  const intendedOutputDir = resolveOutputDir(data.output_dir);
  const payload = {
    ...data,
    output_dir: previewDir
  };

  const result = await runGenerator(payload);

  writePreviewMeta(previewDir, {
    preview_id: previewId,
    file_name: result.file_name,
    file_path: result.file_path,
    intended_output_dir: intendedOutputDir,
    template_id: data.template_id || 'default',
    date_range_text: data.date_range_text || '',
    created_at: Date.now()
  });

  return {
    success: true,
    preview_id: previewId,
    file_name: result.file_name,
    intended_output_dir: intendedOutputDir,
    intended_output_path: path.join(intendedOutputDir, result.file_name),
    template_id: data.template_id || 'default',
    alternate_name_used: Boolean(result.alternate_name_used)
  };
}

function resolvePreviewDocPath(previewId) {
  const previewDir = getPreviewDir(previewId);
  const meta = readPreviewMeta(previewDir);

  if (Date.now() - Number(meta.created_at || 0) > PREVIEW_TTL_MS) {
    fs.rmSync(previewDir, { recursive: true, force: true });
    throw new Error('Preview session expired. Build a new preview.');
  }

  const filePath = path.join(previewDir, meta.file_name);
  if (!fs.existsSync(filePath)) {
    throw new Error('Preview document not found.');
  }

  return { filePath, meta };
}

function isLockedFileError(err) {
  return Boolean(err && /locked|EBUSY|EPERM/i.test(String(err.message || err.code || '')));
}

async function confirmPreviewReport(data) {
  const previewId = sanitizePreviewId(data.preview_id);
  const { filePath, meta } = resolvePreviewDocPath(previewId);
  const outputDir = resolveOutputDir(data.output_dir || meta.intended_output_dir);
  const fileName = meta.file_name || buildOutputFileName(meta.date_range_text);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let destPath = path.join(outputDir, fileName);
  let alternateNameUsed = false;

  const copyTo = (targetPath) => {
    fs.copyFileSync(filePath, targetPath);
  };

  try {
    copyTo(destPath);
  } catch (err) {
    if (!isLockedFileError(err)) {
      throw err;
    }
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let saved = false;
    for (let i = 2; i <= 99; i++) {
      const altPath = path.join(outputDir, `${base} (${i})${ext}`);
      if (fs.existsSync(altPath)) continue;
      try {
        copyTo(altPath);
        destPath = altPath;
        alternateNameUsed = true;
        saved = true;
        break;
      } catch (altErr) {
        if (!isLockedFileError(altErr)) {
          throw altErr;
        }
      }
    }
    if (!saved) {
      throw err;
    }
  }

  const previewDir = getPreviewDir(previewId);
  fs.rmSync(previewDir, { recursive: true, force: true });

  return {
    success: true,
    message: 'Report saved successfully.',
    file_name: path.basename(destPath),
    file_path: destPath,
    template_id: meta.template_id || 'default',
    alternate_name_used: alternateNameUsed
  };
}

function discardPreviewReport(previewId) {
  const dir = getPreviewDir(previewId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { success: true };
}

module.exports = {
  PREVIEW_ROOT,
  createPreviewReport,
  resolvePreviewDocPath,
  confirmPreviewReport,
  discardPreviewReport,
  cleanupExpiredPreviews
};
