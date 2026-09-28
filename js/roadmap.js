/**
 * Active Initiatives — Page Logic & Slide-Over Drawer
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const TRACKING_URL = isLocal
    ? '../orange-dev-data/output/tracker/tracking_issues.json'
    : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/tracker/tracking_issues.json';

let currentProject = null;
let activeFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    let trackingIssuesData = null;

    try {
        const trackingResp = await fetch(TRACKING_URL).catch(() => null);
        if (trackingResp && trackingResp.ok) trackingIssuesData = await trackingResp.json();
    } catch (e) {
        console.warn('Failed to load active initiatives data:', e);
    }

    renderActiveProjects(trackingIssuesData);
    initDrawerEventListeners();
});

// ── Render Cards ─────────────────────────────────────────────────────────────
function renderActiveProjects(trackingIssuesData) {
    const container = document.getElementById('active-projects-container');
    const grid = document.getElementById('active-projects-grid');
    
    if (!trackingIssuesData || trackingIssuesData.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    if (container) container.style.display = 'block';
    if (grid) grid.innerHTML = '';

    trackingIssuesData.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.issueId = project.issue_id;
        
        const lastUpdated = new Date(project.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        
        const categoryBadge = project.category ? `<span class="category-badge">${escHtml(project.category)}</span>` : '';
        const bipBadge = project.bip ? `<span class="bip-badge">${escHtml(project.bip)}</span>` : '';
        const descriptionHtml = project.description ? `<p class="project-description">${escHtml(project.description)}</p>` : '';
        const championHtml = project.champion ? `<div class="project-champion"><i class="fas fa-user-shield"></i> Lead: ${escHtml(project.champion)}</div>` : '';
        
        const hasTasks = project.tasks && project.tasks.length > 0;
        const drawerBtnHtml = hasTasks ? `
            <button class="project-drawer-btn" type="button">
                <span class="btn-text"><i class="fas fa-list-check"></i> ${project.completed_tasks} / ${project.total_tasks} Sub-tasks & PRs</span>
                <i class="fas fa-arrow-right icon"></i>
            </button>
        ` : '';

        card.innerHTML = `
            <div class="project-badges">
                ${categoryBadge}
                ${bipBadge}
            </div>
            <div class="project-card-header">
                <div>
                    <h3 class="project-name">
                        <a href="${project.url}" target="_blank" style="color: inherit; text-decoration: none;" onclick="event.stopPropagation()">${escHtml(project.project_name)}</a>
                    </h3>
                    <div class="project-meta">Updated ${lastUpdated}</div>
                </div>
                <div class="project-stats" title="${project.completed_tasks} of ${project.total_tasks} tasks completed">
                    <i class="fas fa-tasks"></i> ${project.completed_tasks} / ${project.total_tasks}
                </div>
            </div>
            ${descriptionHtml}
            ${championHtml}
            <div class="progress-container">
                <div class="progress-bar" style="width: ${project.completion_percentage}%"></div>
            </div>
            ${drawerBtnHtml}
        `;

        if (hasTasks) {
            card.addEventListener('click', () => {
                if (currentProject && currentProject.issue_id === project.issue_id) {
                    closeDrawer();
                } else {
                    openDrawer(project);
                }
            });
        }

        grid.appendChild(card);
    });
}

// ── Drawer Functionality ──────────────────────────────────────────────────────
function openDrawer(project) {
    currentProject = project;
    activeFilter = 'all';
    searchQuery = '';

    const drawer = document.getElementById('initiative-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (!drawer || !backdrop) return;

    // Highlight selected card on grid
    highlightActiveCard(project.issue_id);

    // Badges & Meta
    const categoryBadge = project.category ? `<span class="category-badge">${escHtml(project.category)}</span>` : '';
    const bipBadge = project.bip ? `<span class="bip-badge">${escHtml(project.bip)}</span>` : '';
    document.getElementById('drawer-badges').innerHTML = `${categoryBadge} ${bipBadge}`;
    
    document.getElementById('drawer-title').innerHTML = `<a href="${project.url}" target="_blank" style="color: inherit; text-decoration: none;">${escHtml(project.project_name)} <i class="fas fa-external-link-alt" style="font-size: 0.8rem; margin-left: 4px; opacity: 0.6;"></i></a>`;
    
    const lastUpdated = new Date(project.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    document.getElementById('drawer-meta').textContent = `Updated ${lastUpdated} · GitHub Issue #${project.issue_id}`;
    
    document.getElementById('drawer-champion').innerHTML = project.champion ? `<i class="fas fa-user-shield"></i> Lead / Champion: <strong>${escHtml(project.champion)}</strong>` : '';
    document.getElementById('drawer-description').textContent = project.description || '';

    // Stats & Progress
    document.getElementById('drawer-stat-completion').textContent = `${project.completion_percentage}%`;
    document.getElementById('drawer-stat-tasks').textContent = `${project.completed_tasks} / ${project.total_tasks}`;
    document.getElementById('drawer-progress-bar').style.width = `${project.completion_percentage}%`;

    // Reset controls
    const searchInput = document.getElementById('drawer-task-search');
    if (searchInput) searchInput.value = '';

    updateTabCounts(project.tasks || []);
    setActiveTab('all');

    renderDrawerTasks();

    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    currentProject = null;
    highlightActiveCard(null);

    const drawer = document.getElementById('initiative-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('open');
}

function highlightActiveCard(issueId) {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
        const btnText = card.querySelector('.btn-text');
        const icon = card.querySelector('.icon');
        
        if (issueId && card.dataset.issueId === String(issueId)) {
            card.classList.add('selected-card');
            if (btnText) btnText.innerHTML = `<i class="fas fa-eye"></i> Viewing Sub-tasks & PRs`;
            if (icon) icon.className = 'fas fa-chevron-right icon';
        } else {
            card.classList.remove('selected-card');
            if (btnText && card.dataset.totalTasks) {
                btnText.innerHTML = `<i class="fas fa-list-check"></i> View Sub-tasks`;
            }
            if (icon) icon.className = 'fas fa-arrow-right icon';
        }
    });
}

function updateTabCounts(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.is_completed).length;
    const open = total - completed;

    document.getElementById('count-all').textContent = total;
    document.getElementById('count-open').textContent = open;
    document.getElementById('count-completed').textContent = completed;
}

function setActiveTab(filter) {
    activeFilter = filter;
    const tabs = document.querySelectorAll('#drawer-filter-tabs .drawer-tab');
    tabs.forEach(tab => {
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function renderDrawerTasks() {
    const container = document.getElementById('drawer-tasks-list');
    if (!container || !currentProject) return;

    let tasks = currentProject.tasks || [];

    // Filter by status
    if (activeFilter === 'open') {
        tasks = tasks.filter(t => !t.is_completed);
    } else if (activeFilter === 'completed') {
        tasks = tasks.filter(t => t.is_completed);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        tasks = tasks.filter(t => {
            const matchesText = t.text.toLowerCase().includes(q);
            const matchesPr = t.linked_prs && t.linked_prs.some(pr => pr.toString().includes(q));
            return matchesText || matchesPr;
        });
    }

    if (tasks.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-secondary); font-size: 0.85rem;"><i class="fas fa-inbox" style="font-size: 1.5rem; display: block; margin-bottom: 8px; opacity: 0.4;"></i> No tasks match the current filter.</div>`;
        return;
    }

    container.innerHTML = tasks.map(task => {
        const iconClass = task.is_completed ? 'fas fa-check-circle completed' : 'far fa-circle pending';
        let prBadges = '';
        if (task.linked_prs && task.linked_prs.length > 0) {
            prBadges = task.linked_prs.map(pr => `<a href="https://github.com/bitcoin/bitcoin/pull/${pr}" target="_blank" class="task-pr-badge" onclick="event.stopPropagation()">#${pr}</a>`).join('');
        }
        return `
            <div class="task-item" style="padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
                <i class="${iconClass} task-icon" style="font-size: 0.9rem;"></i>
                <div style="flex: 1;">
                    ${escHtml(task.text)}
                    ${prBadges}
                </div>
            </div>
        `;
    }).join('');
}

function initDrawerEventListeners() {
    const closeBtn = document.getElementById('drawer-close-btn');
    const backdrop = document.getElementById('drawer-backdrop');
    const searchInput = document.getElementById('drawer-task-search');
    const filterTabs = document.getElementById('drawer-filter-tabs');

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderDrawerTasks();
        });
    }

    if (filterTabs) {
        filterTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.drawer-tab');
            if (!btn) return;
            setActiveTab(btn.dataset.filter);
            renderDrawerTasks();
        });
    }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
