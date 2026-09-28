/**
 * Protocol Pulse — Page Logic (Option A Terminal Dashboard)
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const PULSE_URL = isLocal
    ? '../orange-dev-data/output/shared/discussions_pulse.json'
    : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/shared/discussions_pulse.json';

const ECOSYSTEM_URL = isLocal
    ? '../orange-dev-data/output/shared/ecosystem_summary.json'
    : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/shared/ecosystem_summary.json';

let pulseData = null;
let activeWindow = '90d';
let activeThreadSource = 'all';
let activeThemeCategory = null;

async function initPulse() {
    try {
        const pulseResp = await fetch(PULSE_URL);

        if (!pulseResp.ok) throw new Error(`Pulse fetch failed: ${pulseResp.status}`);
        pulseData = await pulseResp.json();
        
        setupToggle();
        setupThreadTabs();
        renderWindow(activeWindow);
        
    } catch (err) {
        console.error('Failed to load pulse data:', err);
        const hero = document.querySelector('.hero-narrative');
        if (hero) hero.textContent = 'Discussion data is currently unavailable. Please try again later.';
    }
}

function setupToggle() {
    document.querySelectorAll('.window-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeWindow = btn.dataset.window;
            activeThemeCategory = null; // reset theme filter on window change
            renderWindow(activeWindow);
        });
    });
}

function setupThreadTabs() {
    document.querySelectorAll('.thread-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.thread-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeThreadSource = tab.dataset.source;
            const data = pulseData?.windows?.[activeWindow];
            if (data) renderHotThreads(data.hot_threads || [], activeThreadSource);
        });
    });
}

function renderWindow(windowKey) {
    const data = pulseData?.windows?.[windowKey];
    if (!data) return;

    renderStats(data);
    renderThemes(data.themes || []);
    renderHotThreads(data.hot_threads || [], activeThreadSource);
    renderBipSpotlight(data.top_bips || []);
    renderTopVoices(data.top_voices || []);
    
    // Always render 30d editorial regardless of which window is active
    const w30 = pulseData?.windows?.['30d'];
    renderEditorial(w30?.pulse_editorial);
}

// ── Pulse Editorial ─────────────────────────────────────────────────────────
function renderEditorial(editorial) {
    const container = document.getElementById('pulse-editorial-container');
    if (!container) return;

    if (!editorial || !editorial.summary) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    const summaryEl = document.getElementById('pulse-editorial-summary');
    if (summaryEl) summaryEl.textContent = editorial.summary;

    const insightsEl = document.getElementById('pulse-editorial-insights');
    if (insightsEl) {
        const insights = editorial.insights || [];
        insightsEl.innerHTML = insights.map(i => `<li>${escHtml(i)}</li>`).join('');
    }
}

// ── Stats row (Compact Hero Badge) ───────────────────────────────────────────
function renderStats(data) {
    const metaEl = document.getElementById('pulse-hero-meta');
    if (metaEl) {
        metaEl.innerHTML = `<i class="fas fa-chart-line" style="color: var(--primary);"></i> <strong>${(data.total_threads || 0).toLocaleString()}</strong> threads · <strong>${(data.unique_voices || 0).toLocaleString()}</strong> voices`;
    }
}

// ── Compact Theme Filter Pills ───────────────────────────────────────────────
function renderThemes(themes) {
    const el = document.getElementById('themes-pills');
    if (!el) return;

    if (themes.length === 0) {
        el.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No theme data available.</p>';
        return;
    }

    el.innerHTML = themes.map(t => {
        const isSelected = activeThemeCategory === t.category;
        const trendSymbol = { rising: '↑', fading: '↓', steady: '', new: '★' }[t.trend] || '';

        return `
            <button type="button" class="theme-pill ${isSelected ? 'selected-pill' : ''}" data-category="${escHtml(t.category)}">
                <span>${escHtml(t.label)}</span>
                <span class="theme-pill-share">${t.share}% ${trendSymbol}</span>
            </button>
        `;
    }).join('');

    // Attach click handlers to theme pills
    el.querySelectorAll('.theme-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const category = pill.dataset.category;
            if (activeThemeCategory === category) {
                activeThemeCategory = null;
            } else {
                activeThemeCategory = category;
            }
            
            const currentData = pulseData?.windows?.[activeWindow];
            if (currentData) {
                renderThemes(currentData.themes || []);
                renderHotThreads(currentData.hot_threads || [], activeThreadSource);
            }
        });
    });
}

function clearThemeFilter() {
    activeThemeCategory = null;
    const currentData = pulseData?.windows?.[activeWindow];
    if (currentData) {
        renderThemes(currentData.themes || []);
        renderHotThreads(currentData.hot_threads || [], activeThreadSource);
    }
}

// ── Hot Threads ─────────────────────────────────────────────────────────────
function renderHotThreads(threads, sourceFilter) {
    const el = document.getElementById('hot-threads-list');
    const filterBar = document.getElementById('active-theme-filter-bar');
    if (!el) return;

    let filtered = threads;

    // Source Filter
    if (sourceFilter && sourceFilter !== 'all') {
        filtered = filtered.filter(t => t.source === sourceFilter);
    }

    // Theme Filter
    if (activeThemeCategory) {
        filtered = filtered.filter(t => t.category === activeThemeCategory);
    }

    // Update Filter Bar
    if (filterBar) {
        if (activeThemeCategory) {
            const currentThemes = pulseData?.windows?.[activeWindow]?.themes || [];
            const activeThemeObj = currentThemes.find(t => t.category === activeThemeCategory);
            const themeLabel = activeThemeObj ? activeThemeObj.label : activeThemeCategory;
            
            filterBar.style.display = 'inline-flex';
            filterBar.innerHTML = `
                <span><i class="fas fa-filter" style="color: var(--primary); margin-right: 6px;"></i> Filtered by: <strong>${escHtml(themeLabel)}</strong></span>
                <button type="button" onclick="clearThemeFilter()" title="Clear theme filter">Clear ×</button>
            `;
        } else {
            filterBar.style.display = 'none';
            filterBar.innerHTML = '';
        }
    }

    const toRender = filtered.slice(0, 12);

    if (toRender.length === 0) {
        const label = sourceFilter === 'delving' ? 'Delving Bitcoin' : sourceFilter === 'mailing_list' ? 'the mailing list' : 'this window';
        el.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-filter" style="font-size: 1.5rem; display: block; margin-bottom: 10px; opacity: 0.4;"></i> No threads match the active filters in ${label}. <button onclick="clearThemeFilter()" style="background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; margin-left: 6px;">Reset Filter</button></div>`;
        return;
    }

    el.innerHTML = toRender.map(t => {
        const hasLink = t.link && t.link.trim();
        const sourceClass = `source-${(t.source || '').replace(' ', '_')}`;
        const sourceLabel = t.source === 'delving' ? 'Delving' : 'Mailing List';
        const lastPost = t.last_post ? formatDate(t.last_post) : '';
        
        const externalIcon = `<i class="fas fa-external-link-alt" style="font-size: 0.75rem; margin-left: 6px; opacity: 0.6;"></i>`;
        const subjectHtml = hasLink ? `<a href="${escHtml(t.link)}" target="_blank" style="color: inherit; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escHtml(t.subject)}${externalIcon}</a>` : escHtml(t.subject);

        let authorName = t.author || '';
        authorName = authorName.replace(/'? via Bitcoin Development Mailing List'?/gi, '').replace(/'/g, '').trim();

        let authorHtml = '';
        if (authorName && authorName !== 'nan' && authorName !== 'None') {
            if (t.author_uuid && t.author_uuid !== 'nan' && t.author_uuid !== 'None') {
                authorHtml = `<a href="https://network.bitcoindatalabs.org/profile.html?uuid=${escHtml(t.author_uuid)}" target="_blank" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='inherit'">@${escHtml(authorName)}</a>`;
            } else {
                authorHtml = `@${escHtml(authorName)}`;
            }
        }
        
        const prefix = t.is_original_author === false ? 'Discussion led by' : 'By';
        
        const authorLine = authorHtml 
            ? `<div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-top: -2px; margin-bottom: 12px;">${prefix} ${authorHtml}</div>` 
            : '';

        return `
            <div class="thread-card">
                <div class="thread-card-top" style="margin-bottom: 4px;">
                    <span class="thread-subject">${subjectHtml}</span>
                    <div class="thread-badges">
                        <span class="category-badge">${escHtml(t.label)}</span>
                        <span class="source-badge ${sourceClass}">${sourceLabel}</span>
                    </div>
                </div>
                ${authorLine}
                <div class="thread-description" style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
                    ${t.summary ? escHtml(t.summary) : (t.insight ? `<em>${escHtml(t.insight)}</em>` : (t.snippet ? escHtml(t.snippet) : ''))}
                </div>
                ${t.technical_summary ? `
                <details class="thread-tech-details">
                    <summary>Technical Summary</summary>
                    <div class="tech-details-content">${escHtml(t.technical_summary)}</div>
                </details>
                ` : ''}
                <div class="thread-footer">
                    <span class="thread-footer-stat"><i class="fas fa-reply"></i> ${t.reply_count} repl${t.reply_count === 1 ? 'y' : 'ies'}</span>
                    <span class="thread-footer-stat"><i class="fas fa-users"></i> ${t.unique_authors} voice${t.unique_authors === 1 ? '' : 's'}</span>
                    ${lastPost ? `<span class="thread-footer-stat"><i class="far fa-clock"></i> ${lastPost}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ── BIP Spotlight ────────────────────────────────────────────────────────────
function renderBipSpotlight(bips) {
    const el = document.getElementById('bip-spotlight');
    if (!el) return;

    if (bips.length === 0) {
        el.innerHTML = '<p style="padding: 16px; color: var(--text-secondary); font-size: 13px;">No BIP references in this window.</p>';
        return;
    }

    el.innerHTML = bips.map(b => `
        <div class="bip-row">
            <span class="bip-id"><a href="https://bips.dev/${b.bip_id}/" target="_blank" style="color: inherit; text-decoration: none;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='inherit'">BIP ${escHtml(String(b.bip_id))}</a></span>
            <span class="bip-title">${b.title ? escHtml(b.title) : '—'}</span>
            <span class="bip-mentions">${b.mentions} mention${b.mentions === 1 ? '' : 's'}</span>
        </div>
    `).join('');
}

// ── Key R&D Authors (Elevated with Avatars & Initials) ────────────────────────
function renderTopVoices(voices) {
    const el = document.getElementById('top-voices');
    if (!el) return;

    if (voices.length === 0) {
        el.innerHTML = '<p style="padding: 16px; color: var(--text-secondary); font-size: 13px;">No voice data available.</p>';
        return;
    }

    el.innerHTML = voices.map((v, i) => {
        const initials = getInitials(v.name);
        return `
            <a href="https://network.bitcoindatalabs.org/profile.html?uuid=${encodeURIComponent(v.uuid)}" target="_blank" class="voice-row" style="text-decoration: none;">
                <span class="voice-rank">${i + 1}</span>
                <div class="author-avatar-circle">${escHtml(initials)}</div>
                <div style="flex: 1; min-width: 0;">
                    <div class="voice-name" style="color: var(--text-primary); text-decoration: none; font-weight: 700;">${escHtml(v.name)}</div>
                    <div style="font-size: 11px; color: var(--text-secondary); opacity: 0.8;">${v.posts} post${v.posts === 1 ? '' : 's'} in window</div>
                </div>
                <i class="fas fa-chevron-right" style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.4;"></i>
            </a>
        `;
    }).join('');
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ── Utilities ────────────────────────────────────────────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

document.addEventListener('DOMContentLoaded', initPulse);
