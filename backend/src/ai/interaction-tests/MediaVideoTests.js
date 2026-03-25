/**
 * Group 14: Media & Video Tests (4 cases)
 * 14.1 Video player controls (play/pause/volume)
 * 14.2 Audio autoplay check
 * 14.3 Iframe responsiveness
 * 14.4 Embedded content accessible
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class MediaVideoTests {
    /**
     * Run all media & video tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testVideoControls(page));
        results.push(await this._testAudioAutoplay(page));
        results.push(await this._testIframeResponsive(page));
        results.push(await this._testEmbeddedContent(page));

        return results;
    }

    /**
     * 14.1: Video player controls — play/pause/volume should work
     */
    async _testVideoControls(page) {
        const test = createTestResult('media_video', '14.1', 'Video player controls');
        return runSafe(test, async (t) => {
            const videoAudit = await page.evaluate(() => {
                const videos = document.querySelectorAll('video');
                const results = [];

                videos.forEach(video => {
                    const rect = video.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;

                    results.push({
                        src: (video.src || video.querySelector('source')?.src || '').substring(0, 80),
                        hasControls: video.hasAttribute('controls'),
                        autoplay: video.hasAttribute('autoplay'),
                        muted: video.muted || video.hasAttribute('muted'),
                        preload: video.getAttribute('preload') || 'auto',
                        width: rect.width,
                        height: rect.height,
                        selector: video.id ? `#${video.id}` : 'video',
                        hasAriaLabel: !!video.getAttribute('aria-label') || !!video.getAttribute('aria-labelledby'),
                    });
                });

                // Also check for custom video players (YouTube, Vimeo embeds)
                const customPlayers = document.querySelectorAll('.video-player, .plyr, .vjs-tech, [class*="video-player"]');

                return {
                    nativeVideos: results,
                    customPlayerCount: customPlayers.length,
                };
            });

            if (videoAudit.nativeVideos.length === 0 && videoAudit.customPlayerCount === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy video elements trên trang';
                return;
            }

            const issues = [];
            const infos = [];

            for (const video of videoAudit.nativeVideos) {
                if (!video.hasControls) {
                    issues.push(`Video thiếu controls attribute`);
                }
                if (video.autoplay && !video.muted) {
                    issues.push(`Video autoplay mà không muted (browsers sẽ block)`);
                }
                if (!video.hasAriaLabel) {
                    issues.push(`Video thiếu aria-label`);
                }
                infos.push(`${Math.round(video.width)}x${Math.round(video.height)}px, controls=${video.hasControls}, muted=${video.muted}`);
            }

            if (videoAudit.customPlayerCount > 0) {
                infos.push(`+ ${videoAudit.customPlayerCount} custom video players`);
            }

            if (issues.length > 0) {
                t.status = issues.some(i => i.includes('controls')) ? 'failed' : 'warning';
                t.details = `${videoAudit.nativeVideos.length} videos. Issues: ${issues.join('; ')}. Info: ${infos.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${videoAudit.nativeVideos.length} videos + ${videoAudit.customPlayerCount} custom players. ${infos.join('; ')} ✓`;
            }
        });
    }

    /**
     * 14.2: Audio autoplay check — should not autoplay without user interaction
     */
    async _testAudioAutoplay(page) {
        const test = createTestResult('media_video', '14.2', 'Audio autoplay check');
        return runSafe(test, async (t) => {
            const audioCheck = await page.evaluate(() => {
                const results = {
                    audioElements: 0,
                    autoplaying: [],
                    videoAutoplay: [],
                };

                // Check <audio> elements
                document.querySelectorAll('audio').forEach(audio => {
                    results.audioElements++;
                    if (audio.hasAttribute('autoplay') && !audio.muted) {
                        results.autoplaying.push({
                            type: 'audio',
                            src: (audio.src || audio.querySelector('source')?.src || '').substring(0, 60),
                            muted: audio.muted,
                        });
                    }
                });

                // Check <video> with audio that autoplays
                document.querySelectorAll('video[autoplay]:not([muted])').forEach(video => {
                    results.videoAutoplay.push({
                        type: 'video',
                        src: (video.src || '').substring(0, 60),
                        muted: video.muted,
                    });
                });

                // Check for background music / auto-playing embeds
                const audioContexts = window.AudioContext || window.webkitAudioContext;
                results.hasAudioAPI = !!audioContexts;

                return results;
            });

            if (audioCheck.audioElements === 0 && audioCheck.videoAutoplay.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy audio/video autoplay elements';
                return;
            }

            if (audioCheck.autoplaying.length > 0 || audioCheck.videoAutoplay.length > 0) {
                const all = [...audioCheck.autoplaying, ...audioCheck.videoAutoplay];
                t.status = 'failed';
                t.details = `${all.length} media elements autoplay không muted! ${all.map(a => `${a.type}: ${a.src}`).join('; ')}. Browsers sẽ block và gây bad UX.`;
            } else {
                t.status = 'passed';
                t.details = `${audioCheck.audioElements} audio elements, không có unmuted autoplay ✓`;
            }
        });
    }

    /**
     * 14.3: Iframe responsiveness — iframes should scale properly
     */
    async _testIframeResponsive(page) {
        const test = createTestResult('media_video', '14.3', 'Iframe responsiveness');
        return runSafe(test, async (t) => {
            const iframeCheck = await page.evaluate(() => {
                const iframes = document.querySelectorAll('iframe');
                const results = [];

                iframes.forEach(iframe => {
                    const rect = iframe.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;

                    const style = getComputedStyle(iframe);
                    const parent = iframe.parentElement;
                    const parentStyle = parent ? getComputedStyle(parent) : null;

                    // Check if iframe is responsive
                    const hasFixedWidth = iframe.hasAttribute('width') && !iframe.style.width?.includes('%');
                    const isResponsive = style.maxWidth === '100%' || style.width?.includes('%') ||
                        (parentStyle && (parentStyle.position === 'relative' && style.position === 'absolute'));
                    const overflowsParent = parent ? rect.width > parent.getBoundingClientRect().width + 5 : false;
                    const overflowsViewport = rect.right > window.innerWidth;

                    // Check for responsive wrapper
                    const hasWrapper = parent && (
                        parent.classList.contains('embed-responsive') ||
                        parent.classList.contains('ratio') ||
                        parent.classList.contains('responsive-embed') ||
                        parent.classList.contains('video-container') ||
                        parentStyle?.paddingBottom?.includes('%')
                    );

                    results.push({
                        src: (iframe.src || '').substring(0, 60),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        hasFixedWidth,
                        isResponsive: isResponsive || hasWrapper,
                        overflowsParent,
                        overflowsViewport,
                        hasWrapper,
                        title: iframe.getAttribute('title') || '',
                    });
                });

                return results;
            });

            if (iframeCheck.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy iframes trên trang';
                return;
            }

            const issues = [];
            const infos = [];

            for (const iframe of iframeCheck) {
                infos.push(`${iframe.width}x${iframe.height}px`);

                if (iframe.overflowsViewport) {
                    issues.push(`Iframe tràn viewport (width: ${iframe.width}px)`);
                }
                if (iframe.overflowsParent) {
                    issues.push(`Iframe tràn parent container`);
                }
                if (iframe.hasFixedWidth && !iframe.isResponsive) {
                    issues.push(`Iframe có fixed width — không responsive`);
                }
                if (!iframe.title) {
                    issues.push(`Iframe thiếu title attribute (accessibility)`);
                }
            }

            if (issues.length > 0) {
                const hasOverflow = issues.some(i => i.includes('tràn'));
                t.status = hasOverflow ? 'failed' : 'warning';
                t.details = `${iframeCheck.length} iframes (${infos.join(', ')}). Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${iframeCheck.length} iframes responsive (${infos.join(', ')}) ✓`;
            }
        });
    }

    /**
     * 14.4: Embedded content accessible — embeds should have title/label
     */
    async _testEmbeddedContent(page) {
        const test = createTestResult('media_video', '14.4', 'Embedded content accessibility');
        return runSafe(test, async (t) => {
            const embedAudit = await page.evaluate(() => {
                const results = {
                    total: 0,
                    accessible: 0,
                    issues: [],
                };

                // Check iframes
                document.querySelectorAll('iframe').forEach(iframe => {
                    const rect = iframe.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.total++;

                    const title = iframe.getAttribute('title');
                    const ariaLabel = iframe.getAttribute('aria-label');
                    const ariaHidden = iframe.getAttribute('aria-hidden');

                    if (ariaHidden === 'true') {
                        results.accessible++; // Decorative, OK
                    } else if (title || ariaLabel) {
                        results.accessible++;
                    } else {
                        results.issues.push({
                            type: 'iframe',
                            src: (iframe.src || '').substring(0, 50),
                            issue: 'thiếu title attribute',
                        });
                    }
                });

                // Check <embed> and <object>
                document.querySelectorAll('embed, object').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.total++;

                    const hasLabel = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt');
                    if (hasLabel) {
                        results.accessible++;
                    } else {
                        results.issues.push({
                            type: el.tagName.toLowerCase(),
                            src: (el.getAttribute('src') || el.getAttribute('data') || '').substring(0, 50),
                            issue: 'thiếu accessible label',
                        });
                    }
                });

                // Check <canvas>
                document.querySelectorAll('canvas').forEach(canvas => {
                    const rect = canvas.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.total++;

                    const hasLabel = canvas.getAttribute('aria-label') || canvas.getAttribute('role');
                    const hasFallback = canvas.textContent.trim().length > 0;

                    if (hasLabel || hasFallback) {
                        results.accessible++;
                    } else {
                        results.issues.push({
                            type: 'canvas',
                            issue: 'thiếu aria-label và fallback content',
                        });
                    }
                });

                // Check <svg> without accessible name
                document.querySelectorAll('svg').forEach(svg => {
                    const rect = svg.getBoundingClientRect();
                    if (rect.width < 50 || rect.height < 50) return; // skip small icons
                    results.total++;

                    const hasTitle = svg.querySelector('title');
                    const hasAriaLabel = svg.getAttribute('aria-label');
                    const hasRole = svg.getAttribute('role');
                    const isDecorative = hasRole === 'presentation' || hasRole === 'none' || svg.getAttribute('aria-hidden') === 'true';

                    if (hasTitle || hasAriaLabel || isDecorative) {
                        results.accessible++;
                    } else {
                        results.issues.push({
                            type: 'svg (large)',
                            issue: 'thiếu <title>, aria-label, hoặc role="presentation"',
                        });
                    }
                });

                return results;
            });

            if (embedAudit.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy embedded content (iframe/embed/object/canvas/svg lớn)';
                return;
            }

            if (embedAudit.issues.length > 0) {
                t.status = embedAudit.issues.length > 3 ? 'failed' : 'warning';
                t.details = `${embedAudit.accessible}/${embedAudit.total} embeds accessible. Issues: ${embedAudit.issues.slice(0, 3).map(i => `${i.type}: ${i.issue}`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${embedAudit.total} embedded contents đều accessible ✓`;
            }
        });
    }
}

module.exports = MediaVideoTests;
