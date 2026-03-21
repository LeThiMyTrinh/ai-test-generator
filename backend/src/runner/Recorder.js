const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');

const MAX_SESSIONS = 3;
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Active recording sessions: sessionId -> { browser, page, steps, timer, status }
const sessions = new Map();

/**
 * JavaScript source to inject into every page.
 * It listens for user interactions and calls the exposed __recordAction function.
 * Also injects a floating control bar with stop button and step counter.
 */
const RECORDER_SCRIPT = `
(function() {
  if (window.__recorderInjected) return;
  window.__recorderInjected = true;

  /* ---- Floating Control Bar ---- */
  var bar = document.createElement('div');
  bar.id = '__recorder-bar';
  bar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:8px 16px;background:rgba(30,30,30,0.95);color:#fff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.4);backdrop-filter:blur(8px);cursor:move;user-select:none;';

  // Recording indicator (pulsing red dot)
  var dot = document.createElement('span');
  dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;animation:__rec-pulse 1.5s ease-in-out infinite;flex-shrink:0;';
  bar.appendChild(dot);

  // Label
  var lbl = document.createElement('span');
  lbl.style.cssText = 'font-weight:600;color:#fca5a5;';
  lbl.textContent = 'REC';
  bar.appendChild(lbl);

  // Divider
  var divider = document.createElement('span');
  divider.style.cssText = 'width:1px;height:18px;background:rgba(255,255,255,0.2);';
  bar.appendChild(divider);

  // Step counter
  var counter = document.createElement('span');
  counter.id = '__recorder-counter';
  counter.style.cssText = 'font-weight:500;min-width:70px;';
  counter.textContent = '0 buoc';
  bar.appendChild(counter);

  // Divider 2
  var divider2 = divider.cloneNode();
  bar.appendChild(divider2);

  // Stop button
  var stopBtn = document.createElement('button');
  stopBtn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;transition:background 0.2s;';
  stopBtn.innerHTML = '<span style="width:10px;height:10px;background:#fff;border-radius:2px;display:inline-block;"></span> Dung ghi';
  stopBtn.onmouseover = function() { this.style.background = '#dc2626'; };
  stopBtn.onmouseout = function() { this.style.background = '#ef4444'; };
  stopBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.__stopRecording === 'function') {
      stopBtn.disabled = true;
      stopBtn.innerHTML = '<span style="width:10px;height:10px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;display:inline-block;animation:__rec-spin 0.6s linear infinite;"></span> Dang dung...';
      window.__stopRecording();
    }
  };
  bar.appendChild(stopBtn);

  // Drag support
  var dragX = 0, dragY = 0, isDragging = false;
  bar.onmousedown = function(e) {
    if (e.target === stopBtn || e.target.parentElement === stopBtn) return;
    isDragging = true;
    dragX = e.clientX - bar.offsetLeft;
    dragY = e.clientY - bar.offsetTop;
    document.onmousemove = function(e2) {
      if (!isDragging) return;
      bar.style.left = (e2.clientX - dragX) + 'px';
      bar.style.top = (e2.clientY - dragY) + 'px';
      bar.style.right = 'auto';
    };
    document.onmouseup = function() { isDragging = false; document.onmousemove = null; };
  };

  // Inject CSS animation
  var style = document.createElement('style');
  style.textContent = '@keyframes __rec-pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes __rec-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  document.body.appendChild(bar);

  /* ---- Smart selector generator ---- */
  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';

    // 1. id (skip recorder elements)
    if (el.id && !el.id.startsWith('__recorder')) return '#' + CSS.escape(el.id);

    // 2. name attribute
    if (el.name) {
      var byName = document.querySelectorAll('[name="' + CSS.escape(el.name) + '"]');
      if (byName.length === 1) return '[name="' + el.name + '"]';
    }

    // 3. data-testid
    if (el.dataset && el.dataset.testid) {
      return '[data-testid="' + el.dataset.testid + '"]';
    }

    // 4. placeholder
    if (el.placeholder) {
      var byPh = document.querySelectorAll('[placeholder="' + CSS.escape(el.placeholder) + '"]');
      if (byPh.length === 1) return '[placeholder="' + el.placeholder + '"]';
    }

    // 5. aria-label
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      var byAria = document.querySelectorAll('[aria-label="' + CSS.escape(ariaLabel) + '"]');
      if (byAria.length === 1) return '[aria-label="' + ariaLabel + '"]';
    }

    // 6. unique class combination
    if (el.classList && el.classList.length > 0) {
      var classSelector = el.tagName.toLowerCase() + '.' + Array.from(el.classList).map(function(c) { return CSS.escape(c); }).join('.');
      try {
        if (document.querySelectorAll(classSelector).length === 1) return classSelector;
      } catch(e) {}
    }

    // 7. nth-child path
    function nthChildPath(node) {
      if (!node || node === document.body) return 'body';
      if (node.id) return '#' + CSS.escape(node.id);
      var parent = node.parentElement;
      if (!parent) return node.tagName.toLowerCase();
      var children = Array.from(parent.children);
      var sameTag = children.filter(function(c) { return c.tagName === node.tagName; });
      var idx = sameTag.indexOf(node) + 1;
      var segment = node.tagName.toLowerCase();
      if (sameTag.length > 1) segment += ':nth-of-type(' + idx + ')';
      return nthChildPath(parent) + ' > ' + segment;
    }

    return nthChildPath(el);
  }

  function describeElement(el) {
    var tag = el.tagName.toLowerCase();
    var text = (el.innerText || '').trim().substring(0, 60);
    var type = el.getAttribute('type') || '';
    var label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    var parts = [tag];
    if (type) parts.push('type=' + type);
    if (label) parts.push('"' + label + '"');
    else if (text) parts.push('"' + text + '"');
    return parts.join(' ');
  }

  var stepCounter = 0;

  function record(action, el, value) {
    stepCounter++;
    var selector = getSelector(el);
    var desc = describeElement(el);
    var step = {
      step_id: stepCounter,
      action: action,
      selector: selector,
      value: value || '',
      description: action + ' on ' + desc
    };
    if (typeof window.__recordAction === 'function') {
      window.__recordAction(JSON.stringify(step));
    }
    // Update counter on control bar
    var c = document.getElementById('__recorder-counter');
    if (c) c.textContent = stepCounter + ' buoc';
  }

  /* ---- Ignore clicks on the recorder bar itself ---- */
  function isRecorderElement(el) {
    var node = el;
    while (node) {
      if (node.id === '__recorder-bar') return true;
      node = node.parentElement;
    }
    return false;
  }

  /* ---- Event listeners ---- */

  // Click
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (isRecorderElement(el)) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    record('click', el);
  }, true);

  // Input (typing)
  var debounceTimers = new WeakMap();
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (isRecorderElement(el)) return;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var existing = debounceTimers.get(el);
    if (existing) clearTimeout(existing);
    debounceTimers.set(el, setTimeout(function() {
      record('fill', el, el.value);
      debounceTimers.delete(el);
    }, 500));
  }, true);

  // Select change
  document.addEventListener('change', function(e) {
    var el = e.target;
    if (isRecorderElement(el)) return;
    if (el.tagName === 'SELECT') {
      record('select', el, el.value);
    }
  }, true);

  // Form submit
  document.addEventListener('submit', function(e) {
    var el = e.target;
    if (isRecorderElement(el)) return;
    record('submit', el);
  }, true);
})();
`;

/**
 * Launch a headed Chromium browser, navigate to url, and begin recording actions.
 * @param {string} url - Target URL to navigate to
 * @param {object} [options] - Optional settings
 * @returns {Promise<string>} sessionId
 */
async function start(url, options = {}) {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error('Maximum concurrent recording sessions (' + MAX_SESSIONS + ') reached. Stop an existing session first.');
  }

  const sessionId = uuidv4();
  const steps = [];

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null, // use full window size
    ...options.contextOptions,
  });

  const page = await context.newPage();

  // Expose a function so the injected script can send actions back to Node
  await page.exposeFunction('__recordAction', (stepJson) => {
    try {
      const step = JSON.parse(stepJson);
      const session = sessions.get(sessionId);
      if (session && session.status === 'recording') {
        session.steps.push(step);
      }
    } catch (err) {
      console.error('[Recorder] Failed to parse recorded action:', err.message);
    }
  });

  // Expose stop function so the in-browser button can stop the session
  await page.exposeFunction('__stopRecording', async () => {
    try {
      await stop(sessionId);
      console.log('[Recorder] Session ' + sessionId + ' stopped from browser control bar.');
    } catch (e) {
      // already stopped
    }
  });

  // Inject recorder script on every frame navigation
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      try {
        // Record the navigation itself
        const navUrl = frame.url();
        if (navUrl && navUrl !== 'about:blank') {
          const session = sessions.get(sessionId);
          if (session && session.status === 'recording' && session.steps.length > 0) {
            const stepId = session.steps.length + 1;
            session.steps.push({
              step_id: stepId,
              action: 'navigate',
              selector: '',
              value: navUrl,
              description: 'Navigate to ' + navUrl,
            });
          }
        }
        await frame.evaluate(RECORDER_SCRIPT);
      } catch (e) {
        // Frame may have been destroyed, ignore
      }
    }
  });

  // Navigate to target URL
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Record the initial navigation
  steps.push({
    step_id: 1,
    action: 'navigate',
    selector: '',
    value: url,
    description: 'Navigate to ' + url,
  });

  // Inject recorder script into the loaded page
  await page.evaluate(RECORDER_SCRIPT);

  // Auto-timeout after 10 minutes
  const timer = setTimeout(async () => {
    try {
      await stop(sessionId);
      console.log('[Recorder] Session ' + sessionId + ' auto-stopped after timeout.');
    } catch (e) {
      // already stopped
    }
  }, SESSION_TIMEOUT_MS);

  sessions.set(sessionId, {
    browser,
    context,
    page,
    steps,
    timer,
    status: 'recording',
    startedAt: new Date().toISOString(),
    url,
  });

  return sessionId;
}

/**
 * Stop a recording session, close the browser, and return captured steps.
 * @param {string} sessionId
 * @returns {Promise<Array>} captured steps
 */
async function stop(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Recording session not found: ' + sessionId);
  }

  session.status = 'stopped';
  clearTimeout(session.timer);

  const steps = [...session.steps];

  try {
    await session.browser.close();
  } catch (e) {
    // browser may already be closed
  }

  sessions.delete(sessionId);

  // Re-number steps sequentially
  steps.forEach((s, i) => { s.step_id = i + 1; });

  return steps;
}

/**
 * Get currently captured steps for an active session without stopping it.
 * @param {string} sessionId
 * @returns {Array} current steps
 */
function getSteps(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Recording session not found: ' + sessionId);
  }
  return [...session.steps];
}

/**
 * List all active recording sessions.
 * @returns {Array} session summaries
 */
function getSessions() {
  const result = [];
  for (const [id, session] of sessions.entries()) {
    result.push({
      id,
      status: session.status,
      url: session.url,
      startedAt: session.startedAt,
      steps: session.steps,
    });
  }
  return result;
}

module.exports = { start, stop, getSteps, getSessions };
