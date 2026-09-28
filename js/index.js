/**
 * Ecosystem Portal - Landing Page Logic
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SHARED_BASE = isLocal
    ? '../orange-dev-data/output/shared/'
    : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/shared/';

const STATS_URL = SHARED_BASE + 'ecosystem_summary.json';
const SNAPSHOT_URL = SHARED_BASE + 'ecosystem_home_snapshot.json';
const TRACKING_URL = isLocal
    ? '../orange-dev-data/output/tracker/tracking_issues.json'
    : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/tracker/tracking_issues.json';

async function initLanding() {
    let stats = null;
    let snapshot = null;

    let trackingIssues = null;

    try {
        const [statsResp, snapshotResp, trackingResp] = await Promise.all([
            fetch(STATS_URL),
            fetch(SNAPSHOT_URL),
            fetch(TRACKING_URL).catch(() => null)
        ]);

        if (statsResp.ok) stats = await statsResp.json();
        if (snapshotResp.ok) snapshot = await snapshotResp.json();
        if (trackingResp && trackingResp.ok) trackingIssues = await trackingResp.json();
    } catch (error) {
        console.error('Failed to load landing data:', error);
    }

    if (stats) {
        renderDomainSummary(stats);
    } else {
        const listEl = document.getElementById('domain-count-list');
        if (listEl) {
            listEl.innerHTML = '<li>Unable to load contributor counts at this time.</li>';
        }
    }

    renderFreshnessLine(stats, snapshot);
    
    setupWindowToggle(stats, snapshot);
    renderLiveWidgets(stats, snapshot, '30d');
    renderMiniActiveProjects(trackingIssues);

}

function renderMiniActiveProjects(trackingIssues) {
    const rowEl = document.getElementById('active-projects-row');
    const container = document.getElementById('widget-active-projects');
    
    if (!rowEl || !container || !trackingIssues || trackingIssues.length === 0) {
        if (rowEl) rowEl.style.display = 'none';
        return;
    }
    
    rowEl.style.display = 'block';
    
    // Sort by updated_at descending, take top 3
    const topProjects = [...trackingIssues].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3);
    
    container.innerHTML = topProjects.map(project => {
        const pct = project.completion_percentage || 0;
        const tasksDone = project.completed_tasks || 0;
        const totalTasks = project.total_tasks || 0;
        const categoryHtml = project.category ? `<div style="font-size: 0.65rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-bottom: 6px; opacity: 0.9;">${escHtml(project.category)}</div>` : '';
        return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'" onclick="window.location.href='roadmap.html'">
                ${categoryHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <strong style="color: var(--text-primary); font-size: 0.9rem; line-height: 1.3;">${escHtml(project.project_name)}</strong>
                    <span style="font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap; margin-left: 8px;">${tasksDone}/${totalTasks} Tasks</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: auto;">
                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; position: relative;">
                        <div style="position: absolute; top: 0; left: 0; bottom: 0; width: ${pct}%; background: var(--primary); border-radius: 3px;"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--primary); font-weight: 700;">${pct}%</span>
                </div>
            </div>
        `;
    }).join('');
}


function setupWindowToggle(stats, snapshot) {
    const toggle = document.getElementById('pulse-window-toggle');
    if (!toggle) return;
    
    toggle.querySelectorAll('.window-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toggle.querySelectorAll('.window-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLiveWidgets(stats, snapshot, btn.dataset.window);
        });
    });
}

function renderDomainSummary(stats) {
    const listEl = document.getElementById('domain-count-list');
    const insightEl = document.getElementById('summary-insight');
    if (!listEl) return;

    const groups = stats.groups || {};
    const vennSummary = stats.venn_summary || {};
    const values = [
        { label: 'Code contributors', value: groups.committers, note: 'Git committers and core PR participants' },
        { label: 'Review contributors', value: groups.reviewers, note: 'Peer review and code feedback contributors' },
        { label: 'Research contributors', value: groups.research, note: 'Mailing list and Delving discussion participants' },
        { label: 'BIP authors', value: groups.standards, note: 'Standards authors and protocol specification contributors' },
        { label: 'All four domains', value: vennSummary.all_four, note: 'People active in Code, Review, Research, and Standards' }
    ];

    const allFourValue = vennSummary.all_four != null ? vennSummary.all_four.toLocaleString() : '—';
    const totalDevs = groups.total_registry || groups.total_active;
    const totalStr  = totalDevs ? totalDevs.toLocaleString() : null;
    if (insightEl) {
        insightEl.innerText = totalStr
            ? `Out of ${totalStr} developers tracked, ${allFourValue} have contributed across all four domains.`
            : `Currently ${allFourValue} contributors span all four domains.`;
    }

    listEl.innerHTML = values.map(item => {
        const value = item.value != null ? item.value.toLocaleString() : '–';
        return `<li><strong>${item.label}:</strong> ${value}<span>${item.note}</span></li>`;
    }).join('');

}

function renderFreshnessLine(stats, snapshot) {
    const el = document.getElementById('freshness-line');
    if (!el) return;

    const generated = (stats && stats.generated_at) || (snapshot && snapshot.generated_at);
    const count = snapshot ? snapshot.contributors_tracked : null;

    const stamp = generated ? formatMonthYear(generated) : 'Unknown date';
    el.textContent = `Data as of: ${stamp}`;
}

function renderLiveWidgets(stats, snapshot, windowKey = '30d') {
    renderActiveContributorsWidget(snapshot, windowKey);
    renderResearchActivityWidget(snapshot, windowKey);
    renderTopicMomentumWidget(snapshot, windowKey);
    renderRecentBipsWidget(snapshot, windowKey);
    renderNewcomersWidget(stats, windowKey);
    renderMergedPrsWidget(stats, snapshot, windowKey);
    renderSpotlightWidget(stats, windowKey);
}

function renderActiveContributorsWidget(snapshot, windowKey = '30d') {
    const valueEl = document.getElementById('widget-active-count');
    if (!valueEl) return;

    const widget = snapshot && snapshot.widgets ? snapshot.widgets[`active_contributors_${windowKey}`] : null;
    if (!widget) {
        valueEl.textContent = '-';
        return;
    }

    const current = Number(widget.value || 0);
    const previous = Number(widget[`previous_${windowKey}`] || 0);
    const delta = Number(widget[`delta_${windowKey}`] || (current - previous));

    valueEl.innerHTML = `${current.toLocaleString()} <span class="delta-pill" style="font-size: 14px; margin-left: 8px; vertical-align: middle;" title="Change vs previous window">${formatDelta(delta)}</span>`;
}

function renderMergedPrsWidget(stats, snapshot, windowKey = '30d') {
    const valueEl = document.getElementById('widget-prs-count');
    const noteEl = document.getElementById('widget-prs-note');
    const commitsEl = document.getElementById('widget-commits-count');
    if (!valueEl || !noteEl) return;

    if (!stats || !stats.prs) {
        valueEl.textContent = '-';
        noteEl.textContent = 'PR metrics unavailable.';
        return;
    }

    const merged30d = Number(stats.prs[`merged_${windowKey}`] || 0);
    const prevMerged30d = Number(stats.prs[`merged_prev_${windowKey}`] || 0);
    const deltaMerged = merged30d - prevMerged30d;
    const total = Number(stats.prs.total_merged || 0);

    const deltaHtml = stats.prs[`merged_prev_${windowKey}`] !== undefined 
        ? `<span class="delta-pill" style="font-size: 14px; vertical-align: middle;" title="Change vs previous window">${formatDelta(deltaMerged)}</span>`
        : '';

    valueEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <div style="display: flex; align-items: baseline; gap: 8px;">
                <span>${merged30d.toLocaleString()}</span>
                ${deltaHtml}
            </div>
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; line-height: 1;">PRs Merged in Bitcoin Core</span>
        </div>
    `;

    noteEl.classList.remove('skeleton-load');
    noteEl.style.display = 'none';

    const releaseWidget = snapshot && snapshot.widgets ? snapshot.widgets[`highlighted_release_${windowKey}`] : null;
    const releaseItemEl = document.getElementById('widget-release-item');
    const releaseInfoEl = document.getElementById('widget-release-info');
    
    if (releaseWidget && releaseItemEl && releaseInfoEl) {
        const v = releaseWidget.version;
        const prs = releaseWidget.prs;
        let releaseText = '';
        if (releaseWidget.status === 'shipped') {
            const dateStr = releaseWidget.date ? ` on ${releaseWidget.date}` : '';
            releaseText = `<strong style="color: var(--primary); font-size: 1.1em; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-rocket" style="margin-right: 4px;"></i> Latest Release:</strong> Bitcoin Core ${v}${dateStr} (${prs} PRs).`;
        } else {
            releaseText = `<strong>Next Up:</strong> Bitcoin Core ${v} is upcoming (${prs} PRs).`;
        }
        
        releaseInfoEl.innerHTML = `${releaseText} <a href="releases.html#${v}" class="bip-link" style="color: var(--primary); text-decoration: none;">View log &rarr;</a>`;
        releaseItemEl.style.display = 'list-item';
    } else if (releaseItemEl) {
        releaseItemEl.style.display = 'none';
    }
    
    if (commitsEl && stats.commits) {
        const c30 = Number(stats.commits[`commits_${windowKey}`] || 0);
        const cPrev = Number(stats.commits[`commits_prev_${windowKey}`] || 0);
        const deltaC = c30 - cPrev;
        const deltaCHtml = stats.commits[`commits_prev_${windowKey}`] !== undefined 
            ? ` <span class="delta-pill" title="Change vs previous window">${formatDelta(deltaC)}</span>`
            : '';
        commitsEl.innerHTML = `<strong>${c30.toLocaleString()}</strong> commits pushed${deltaCHtml}`;
    }
}

function renderTopicMomentumWidget(snapshot, windowKey = '30d') {
    const el = document.getElementById('widget-topics');
    if (!el) return;

    const widget = snapshot && snapshot.widgets ? snapshot.widgets[`topic_momentum_${windowKey}`] : null;
    const items = widget ? (widget.items || []).slice(0, 3) : [];
    if (!items.length) {
        el.innerHTML = '<li>Topic momentum unavailable.</li>';
        return;
    }

    el.innerHTML = items.map(item => {
        const rawLabel = item.label || item.topic || 'Unknown';
        const label = `<a href="pulse.html" style="color: var(--text-primary); text-decoration: none;" class="topic-link">${escHtml(rawLabel)}</a>`;
        const count = Math.round(item[`mentions_${windowKey}`] || 0).toLocaleString();
        const delta = Number(item[`delta_${windowKey}`] || 0);
        return `<li>${label} <strong>${count}</strong> <span class="delta-pill" title="Change vs previous window">${formatDelta(delta)}</span></li>`;
    }).join('');
}

function renderRecentBipsWidget(snapshot, windowKey = '30d') {
    const el = document.getElementById('widget-bips');
    if (!el) return;

    const widget = snapshot?.widgets?.[`recent_bips_${windowKey}`]
        || (windowKey === '30d' ? snapshot?.widgets?.['recent_bips'] : null);
    const items = widget
        ? (widget.items || []).slice(0, 3)
        : [];
    if (!items.length) {
        el.innerHTML = '<li>No recent BIP discussions in this window.</li>';
        return;
    }

    el.innerHTML = items.map(item => {
        const bipId = String(item.bip_id || '');
        const title = escHtml(item.title || `BIP ${bipId}`);
        const author = escHtml(item.primary_author || 'Unknown');
        const authorLink = item.primary_author_uuid
            ? `https://network.bitcoindatalabs.org/profile.html?uuid=${encodeURIComponent(item.primary_author_uuid)}`
            : null;
        const authorHtml = authorLink
            ? `<a class="bip-link" href="${authorLink}" target="_blank" rel="noopener noreferrer">${author}</a>`
            : author;

        const wk = windowKey;
        const mentions = Number(item[`mentions_${wk}`] || 0).toLocaleString();
        const delta = Number(item[`delta_${wk}`] || 0);
        return `<li class="bip-row-item">
            <div class="bip-row-item-header"><strong>BIP ${escHtml(bipId)}</strong> <span class="bip-title">${title}</span></div>
            <div class="bip-row-item-meta">${authorHtml} · ${mentions} mentions ${formatDelta(delta)}</div>
        </li>`;
    }).join('');
}

function renderResearchActivityWidget(snapshot, windowKey = '30d') {
    const countEl = document.getElementById('widget-research-count');
    const noteEl = document.getElementById('widget-research-note');
    if (!countEl || !noteEl) return;

    const widget = snapshot && snapshot.widgets ? snapshot.widgets[`research_activity_${windowKey}`] : null;
    if (!widget) {
        countEl.textContent = '-';
        noteEl.textContent = 'Signal unavailable';
        return;
    }

    const concepts = widget[`new_concepts_${windowKey}`];
    
    noteEl.classList.remove('skeleton-load');

    if (concepts !== undefined) {
        const prevConcepts = Number(widget[`new_concepts_prev_${windowKey}`] || 0);
        const delta = Number(concepts) - prevConcepts;
        countEl.innerHTML = `${Number(concepts).toLocaleString()} <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">New Concepts Proposed</span>`;
        noteEl.innerHTML = `Research & BIP drafts across Delving & Mailing Lists (${formatDelta(delta)})`;
    } else {
        // Fallback mockup while backend pipeline is updated
        const mockCount = windowKey === '7d' ? 2 : 8;
        countEl.innerHTML = `${mockCount} <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">New Concepts Proposed</span>`;
        noteEl.innerHTML = `Research & BIP drafts across Delving & Mailing Lists <span style="opacity: 0.5; font-size: 0.85em;">(Awaiting Data)</span>`;
    }
}

function renderNewcomersWidget(stats, windowKey = '30d') {
    const newcomersEl = document.getElementById('widget-newcomers');
    
    if (!newcomersEl) return;

    const onboarding = stats && stats.onboarding ? stats.onboarding : null;
    if (!onboarding) {
        newcomersEl.innerHTML = `<strong>-</strong> newcomers across code & research`;
        return;
    }

    const coders = onboarding[`new_coders_${windowKey}`] !== undefined 
        ? Number(onboarding[`new_coders_${windowKey}`]) 
        : Math.round(Number(onboarding.new_coders_90d || 0) / 3);
        
    const discussants = onboarding[`new_discussants_${windowKey}`] !== undefined 
        ? Number(onboarding[`new_discussants_${windowKey}`]) 
        : Math.round(Number(onboarding.new_discussants_90d || 0) / 3);

    const totalNew = coders + discussants;
    newcomersEl.innerHTML = `<strong>${totalNew.toLocaleString()}</strong> newcomers across code & research`;
}

function renderSpotlightWidget(stats, windowKey = '30d') {
    const container = document.getElementById('widget-spotlight-container');
    const content = document.getElementById('widget-spotlight-content');
    if (!container || !content) return;

    if (stats && stats.spotlight) {
        content.classList.remove('skeleton-load');
        const name = escHtml(stats.spotlight.name || 'Unknown');
        const desc = escHtml(stats.spotlight.description || '');
        const uuid = stats.spotlight.uuid;
        const gh = stats.spotlight.github_login || '';
        
        const avatarUrl = gh 
            ? `https://github.com/${encodeURIComponent(gh)}.png?size=80` 
            : 'https://bitcoindatalabs.org/images/default_avatar.png';

        let nameHtml = `<div style="color: var(--text-primary); font-weight: 700;">${name}</div>`;
        if (uuid && uuid !== 'nan' && uuid !== 'None') {
            const profileLink = `https://network.bitcoindatalabs.org/profile.html?uuid=${encodeURIComponent(uuid)}`;
            nameHtml = `<a class="reviewer-link" href="${profileLink}" target="_blank" rel="noopener noreferrer" style="color: var(--text-primary); font-weight: 700; text-decoration: none;">${name}</a>`;
        }
        
        content.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                <img src="${avatarUrl}" alt="${name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border);" onerror="this.src='https://github.com/identicons/${name}.png'">
                <div>
                    ${nameHtml}
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${desc}</div>
                </div>
            </div>
        `;
    } else {
        // Fallback placeholder while orange-dev-data is updated
        content.classList.remove('skeleton-load');
        content.innerHTML = `<strong style="color: var(--text-primary);">Awaiting Data</strong> — Pipeline will feature first-time core contributors here.`;
    }
}

function formatMonthYear(input) {
    if (!input) return 'Unknown';
    const parts = input.split('T')[0].split('-');
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return 'Unknown';
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDelta(n) {
    const val = Number(n || 0);
    if (val > 0) return `<span class="delta-up">▲ +${val.toLocaleString()}</span>`;
    if (val < 0) return `<span class="delta-down">▼ ${val.toLocaleString()}</span>`;
    return `<span class="delta-flat">— 0</span>`;
}

document.addEventListener('DOMContentLoaded', initLanding);
