/**
 * VisualRegression.js
 *
 * Handles visual regression testing by comparing screenshots between test runs.
 * Uses pixelmatch for pixel-level diffing and sharp for image resizing.
 * Baselines are stored under  data/baselines/{suite_id}/{tc_id}/step-{N}.png
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PNG } = require('pngjs');

// Handle pixelmatch ESM / CJS compatibility
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const BASELINES_DIR = path.join(DATA_DIR, 'baselines');

/**
 * Build the filesystem path for a baseline image.
 */
function baselinePath(suiteId, tcId, stepId) {
  return path.join(BASELINES_DIR, String(suiteId), String(tcId), `step-${stepId}.png`);
}

/**
 * Ensure the directory for `filePath` exists.
 */
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read a PNG file from disk and return a pngjs PNG instance (with width,
 * height, and raw RGBA data buffer).
 */
async function readPng(filePath) {
  const buffer = await sharp(filePath).png().toBuffer();
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, parsed) => {
      if (err) return reject(err);
      resolve(parsed);
    });
  });
}

/**
 * Resize an image to the target width/height using sharp (lanczos3) and
 * return a pngjs PNG instance.
 */
async function resizeToPng(filePath, width, height) {
  const buffer = await sharp(filePath)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, parsed) => {
      if (err) return reject(err);
      resolve(parsed);
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save (or overwrite) a baseline screenshot for a specific step.
 *
 * @param {string} suiteId   – Test-suite identifier.
 * @param {string} tcId      – Test-case identifier.
 * @param {number|string} stepId – Step number / identifier.
 * @param {string} screenshotAbsPath – Absolute path to the screenshot file.
 * @returns {Promise<string>} The absolute path where the baseline was stored.
 */
async function saveBaseline(suiteId, tcId, stepId, screenshotAbsPath) {
  const dest = baselinePath(suiteId, tcId, stepId);
  ensureDir(dest);

  // Normalise to PNG via sharp to guarantee a clean baseline.
  await sharp(screenshotAbsPath).png().toFile(dest);

  return dest;
}

/**
 * Compare a current screenshot against the stored baseline for a given step.
 *
 * @param {string} suiteId
 * @param {string} tcId
 * @param {number|string} stepId
 * @param {string} currentScreenshotAbsPath
 * @param {string} evidenceDir – Directory where the diff image will be saved.
 * @returns {Promise<object>} Comparison result.
 */
async function compareScreenshot(suiteId, tcId, stepId, currentScreenshotAbsPath, evidenceDir) {
  const blPath = baselinePath(suiteId, tcId, stepId);

  // If no baseline exists yet, this is a new step.
  if (!fs.existsSync(blPath)) {
    return {
      step_id: stepId,
      matchPercent: 0,
      diffPixels: 0,
      totalPixels: 0,
      diffImagePath: null,
      baselinePath: null,
      currentPath: currentScreenshotAbsPath,
      status: 'new',
    };
  }

  // Read baseline to determine the canonical dimensions.
  const baselinePng = await readPng(blPath);
  const { width, height } = baselinePng;

  // Resize the current screenshot to the same dimensions (if they differ).
  const currentPng = await resizeToPng(currentScreenshotAbsPath, width, height);

  // Prepare diff output buffer.
  const diffPng = new PNG({ width, height });
  const totalPixels = width * height;

  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 },
  );

  const matchPercent = totalPixels > 0
    ? parseFloat((((totalPixels - diffPixels) / totalPixels) * 100).toFixed(2))
    : 100;

  // Write diff image to the evidence directory.
  ensureDir(path.join(evidenceDir, '_'));
  const diffImagePath = path.join(evidenceDir, `diff-step-${stepId}.png`);

  await new Promise((resolve, reject) => {
    const chunks = [];
    diffPng.pack();
    diffPng.on('data', (chunk) => chunks.push(chunk));
    diffPng.on('end', () => {
      fs.writeFileSync(diffImagePath, Buffer.concat(chunks));
      resolve();
    });
    diffPng.on('error', reject);
  });

  const status = diffPixels === 0 ? 'match' : 'changed';

  return {
    step_id: stepId,
    matchPercent,
    diffPixels,
    totalPixels,
    diffImagePath,
    baselinePath: blPath,
    currentPath: currentScreenshotAbsPath,
    status,
  };
}

/**
 * Compare all screenshots produced by a test run against their baselines.
 *
 * @param {string} suiteId
 * @param {Array<object>} results – Array of step results. Each object must
 *   contain at least `{ tc_id, step_id, screenshotPath }`.
 * @param {string} evidenceBasePath – Root evidence directory; sub-folders per
 *   test case will be created automatically.
 * @returns {Promise<Array<object>>} Array of comparison result objects.
 */
async function compareRun(suiteId, results, evidenceBasePath) {
  const comparisons = [];

  for (const result of results) {
    const { tc_id, step_id, screenshotPath } = result;

    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      comparisons.push({
        step_id,
        matchPercent: 0,
        diffPixels: 0,
        totalPixels: 0,
        diffImagePath: null,
        baselinePath: null,
        currentPath: screenshotPath || null,
        status: 'new',
      });
      continue;
    }

    const evidenceDir = path.join(evidenceBasePath, String(tc_id));
    ensureDir(path.join(evidenceDir, '_'));

    const comparison = await compareScreenshot(
      suiteId,
      tc_id,
      step_id,
      screenshotPath,
      evidenceDir,
    );
    comparisons.push(comparison);
  }

  return comparisons;
}

/**
 * Accept a visual change by updating the baseline with the current screenshot.
 *
 * @param {string} suiteId
 * @param {string} tcId
 * @param {number|string} stepId
 * @param {string} currentScreenshotAbsPath
 * @returns {Promise<string>} The updated baseline path.
 */
async function acceptChange(suiteId, tcId, stepId, currentScreenshotAbsPath) {
  return saveBaseline(suiteId, tcId, stepId, currentScreenshotAbsPath);
}

/**
 * List every baseline stored for a given test case.
 *
 * @param {string} suiteId
 * @param {string} tcId
 * @returns {{ steps: Array<{ stepId: string, path: string }>, count: number }}
 */
function getBaselineInfo(suiteId, tcId) {
  const dir = path.join(BASELINES_DIR, String(suiteId), String(tcId));

  if (!fs.existsSync(dir)) {
    return { steps: [], count: 0 };
  }

  const files = fs.readdirSync(dir).filter((f) => f.startsWith('step-') && f.endsWith('.png'));

  const steps = files.map((f) => {
    const stepId = f.replace('step-', '').replace('.png', '');
    return { stepId, path: path.join(dir, f) };
  });

  // Sort numerically when possible.
  steps.sort((a, b) => {
    const na = parseInt(a.stepId, 10);
    const nb = parseInt(b.stepId, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.stepId.localeCompare(b.stepId);
  });

  return { steps, count: steps.length };
}

/**
 * Check whether at least one baseline exists for a test case.
 *
 * @param {string} suiteId
 * @param {string} tcId
 * @returns {boolean}
 */
function hasBaseline(suiteId, tcId) {
  const dir = path.join(BASELINES_DIR, String(suiteId), String(tcId));
  if (!fs.existsSync(dir)) return false;

  return fs.readdirSync(dir).some((f) => f.startsWith('step-') && f.endsWith('.png'));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  saveBaseline,
  compareScreenshot,
  compareRun,
  acceptChange,
  getBaselineInfo,
  hasBaseline,
};
