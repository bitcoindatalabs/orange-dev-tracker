document.addEventListener('DOMContentLoaded', async () => {
    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const dataUrl = isLocal 
            ? '../../orange-dev-data/output/lab/knots_comparison.json' 
            : 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/output/lab/knots_comparison.json';
            
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error('Failed to load JSON');
        const data = await response.json();
        
        // 1. Update Date
        const dateObj = new Date(data.metadata.generated_at);
        document.getElementById('data-date').innerText = dateObj.toLocaleDateString();

        // 2. Update Hero KPIs
        const coreHyg = data.hygiene.one_year.core; 
        const knotsHyg = data.hygiene.one_year.knots;
        
        // GitHub Explainer & Hero Ahead
        if (data.divergence) {
            const eBehind = document.getElementById('github-behind');
            if (eBehind) {
                eBehind.innerText = data.divergence.commits_core_ahead.toLocaleString();
                document.getElementById('github-ahead').innerText = data.divergence.commits_knots_ahead.toLocaleString();
                document.getElementById('explainer-behind').innerText = data.divergence.commits_core_ahead.toLocaleString();
                document.getElementById('explainer-ahead').innerText = data.divergence.commits_knots_ahead.toLocaleString();
                document.getElementById('explainer-ahead-total').innerText = data.divergence.commits_knots_ahead.toLocaleString();
            }
            const hAhead = document.getElementById('hero-github-ahead');
            if (hAhead) {
                hAhead.innerText = data.divergence.commits_knots_ahead.toLocaleString();
            }
        }
        
        // Hero Incremental Commits
        if (data.provenance) {
            const hInc = document.getElementById('hero-incremental-commits');
            if (hInc) {
                hInc.innerText = data.provenance.total_incremental_commits.toLocaleString();
            }
        }
        
        // Luke's Share
        if (data.provenance) {
            document.getElementById('kpi-hero-luke').innerText = data.provenance.luke.pct.toFixed(0) + '%';
        }
        
        // Ghost Contributors & Total Devs
        let ghostCount = 0;
        let fastTrackedCount = 0;
        let totalCount = data.overlap ? (data.overlap.knots_total || 80) : 0;
        
        if (data.overlap && data.overlap.both_devs) {
            ghostCount = data.overlap.both_devs.filter(d => d.provenance === 'ancient_ghost' || d.provenance === 'ghost').length;
            fastTrackedCount = data.overlap.both_devs.filter(d => d.provenance === 'fast_tracked').length;
        }
        document.getElementById('kpi-hero-ghosts').innerText = ghostCount;
        
        const totalKpi = document.getElementById('kpi-hero-total');
        if (totalKpi) {
            totalKpi.innerText = totalCount;
            let nativeCount = totalCount - ghostCount - fastTrackedCount;
            document.getElementById('kpi-hero-total-sub').innerText = `${ghostCount} Upstream, ${fastTrackedCount} Fast-tracked, ${nativeCount} Native`;
        }

        // 4. Render Charts
        renderHygieneChart(coreHyg, knotsHyg);
        
        if (data.overlap && data.overlap.mindshare_1yr) {
            document.getElementById('mindshare-core').innerText = data.overlap.mindshare_1yr.core_active;
            document.getElementById('mindshare-knots').innerText = data.overlap.mindshare_1yr.knots_active;
        }

        if (data.trend) {
            renderTrendChart(data.trend);
        }

        // 6. Render Provenance Ring
        if (data.provenance) {
            renderProvenanceCharts(data.provenance);
            document.getElementById('prov-total-commits').innerText = data.provenance.total_incremental_commits.toLocaleString();
            const headlinePct = (data.provenance.luke.pct + data.provenance.salvaged_from_core.pct).toFixed(0);
            document.getElementById('prov-headline-pct').innerText = headlinePct;
            document.getElementById('prov-fast-pct').innerText = (data.provenance.fast_tracked ? data.provenance.fast_tracked.pct : 0).toFixed(0);
            document.getElementById('prov-community-pct').innerText = data.provenance.knots_community.pct.toFixed(0);
        }

        // 7. Render Bus Factor Treemap
        if (data.overlap && data.overlap.knots_top_devs) {
            renderBusFactorTreemap(data.overlap);
        }

        // 8. Render Legacy Scatter
        if (data.graveyard) {
            renderGraveyardChart(data.graveyard);
            document.getElementById('legacy-total').innerText = data.graveyard.summary.total_commits.toLocaleString();
            document.getElementById('legacy-salvaged').innerText = data.graveyard.summary.salvaged_count.toLocaleString();
            document.getElementById('legacy-max-age').innerText = data.graveyard.summary.max_delta_days.toLocaleString();
        }

        // 9. Populate Provenance Table (replaces old dev lists)
        if (data.overlap && data.overlap.both_devs) {
            populateProvenanceTable(data.overlap);
        }

        // 10. Populate Upstream Gallery
        if (data.overlap && data.overlap.both_devs) {
            populateUpstreamGallery(data.overlap);
            populateTrackedCommits(data);
        }

    } catch (e) {
        console.error("Error loading Knots data:", e);
    }
});

function populateUpstreamGallery(overlapData) {
    const gallery = document.getElementById('upstream-gallery');
    if (!gallery || !overlapData.both_devs) return;

    const ghosts = overlapData.both_devs
        .filter(d => d.provenance === 'ancient_ghost')
        .sort((a, b) => b.commits_core_all_time - a.commits_core_all_time)
        .slice(0, 5);

    if (ghosts.length === 0) {
        gallery.innerHTML = '<p style="color: var(--text-secondary);">No upstream contributors found.</p>';
        return;
    }

    gallery.innerHTML = ghosts.map(dev => {
        const profileUrl = dev.has_profile ? `https://network.bitcoindatalabs.org/profile.html?uuid=${dev.uuid}` : '#';
        const avatarUrl = dev.github ? `https://github.com/${dev.github}.png` : `https://github.com/identicon/${dev.uuid}.png`;
        
        let commitsHtml = '';
        if (dev.sample_commits && dev.sample_commits.length > 0) {
            const earliest = dev.sample_commits.slice(0, 2).map(c => `
                <div style="margin-bottom: 6px; line-height: 1.2;">
                    <a href="https://github.com/bitcoinknots/bitcoin/commit/${c.hash}" target="_blank" style="color: var(--primary); text-decoration: none; font-family: var(--bdl-font-mono); font-size: 0.75em; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.subject}">${c.subject}</a>
                    <div style="font-size: 0.65em; color: var(--text-secondary); margin-top: 2px; text-transform: capitalize;">
                        <i class="far fa-calendar-alt" style="margin-right: 3px; opacity: 0.7;"></i>${c.author_date} <span style="margin: 0 3px; opacity: 0.3;">|</span> <i class="fas fa-tag" style="margin-right: 3px; opacity: 0.7;"></i>${(c.category || 'other').replace(/_/g, ' ')}
                    </div>
                </div>
            `).join('');
            commitsHtml = `<div style="margin-top: 10px; text-align: left; background: rgba(0,0,0,0.2); padding: 8px 8px 2px 8px; border-radius: 4px;"><div style="font-size: 0.7em; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Oldest & Newest</div>${earliest}</div>`;
        }

        return `
            <div class="upstream-card" style="display: flex; flex-direction: column; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; width: 100%; min-width: 0; box-sizing: border-box;">
                <a href="${profileUrl}" target="${dev.has_profile ? '_blank' : '_self'}" style="text-decoration: none; display: flex; justify-content: center; position: relative;">
                    <img src="${avatarUrl}" alt="${dev.name}" style="width: 64px; height: 64px; border-radius: 50%; margin-bottom: 10px; border: 2px solid #636e72;">
                    <div style="position: absolute; bottom: 5px; right: calc(50% - 32px); font-size: 20px; text-shadow: 0 0 5px rgba(0,0,0,0.8);">📦</div>
                </a>
                <div class="upstream-name" style="margin-bottom: 8px;"><a href="${profileUrl}" target="${dev.has_profile ? '_blank' : '_self'}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${dev.name}</a></div>
                <div class="upstream-stats" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
                    <strong>${dev.commits_core_all_time.toLocaleString()}</strong> Core commits<br>
                    <strong>${dev.commits_knots}</strong> in Knots
                </div>
                ${commitsHtml}
            </div>
        `;
    }).join('');
}

let trackedCommitsData = [];
let currentSortCol = 'date';
let currentSortAsc = true;

function populateTrackedCommits(data) {
    const tbody = document.getElementById('tbody-tracked-commits');
    if (!tbody || !data.graveyard || !data.graveyard.commits) return;

    trackedCommitsData = [];
    data.graveyard.commits.forEach(c => {
        if (c.delta_days > 60) {
            trackedCommitsData.push({
                devName: c.author_name,
                subject: c.subject,
                hash: c.hash,
                date: c.author_date,
                category: c.category || 'other'
            });
        }
    });

    if (trackedCommitsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">No tracked commits found.</td></tr>';
        return;
    }

    renderTrackedCommitsTable();
    setupTrackedCommitsSorting();
}

function renderTrackedCommitsTable() {
    const tbody = document.getElementById('tbody-tracked-commits');
    if (!tbody) return;

    trackedCommitsData.sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];
        if (currentSortCol === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        } else {
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }
        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = trackedCommitsData.map(r => {
        const queryStr = `is:pr "${r.subject.replace(/"/g, '')}"`;
        const coreUrl = `https://github.com/bitcoin/bitcoin/pulls?q=${encodeURIComponent(queryStr)}`;
        const knotsUrl = `https://github.com/bitcoinknots/bitcoin/commit/${r.hash}`;
        return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 10px 15px; color: var(--text-primary); font-weight: 500; white-space: nowrap;">${r.devName}</td>
            <td style="padding: 10px; color: var(--text-secondary); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.subject}">
                ${r.subject}
            </td>
            <td style="padding: 10px; text-align: center; color: var(--text-secondary); white-space: nowrap; text-transform: capitalize; font-size: 0.8em; opacity: 0.8;">${r.category.replace(/_/g, ' ')}</td>
            <td style="padding: 10px; text-align: center; color: var(--text-secondary); white-space: nowrap;">${r.date}</td>
            <td style="padding: 10px 15px; text-align: center; white-space: nowrap;">
                <a href="${coreUrl}" target="_blank" style="color: #DCA750; margin-right: 15px; text-decoration: none; font-weight: 600;" title="Search Core PRs">Core 🔍</a>
                <a href="${knotsUrl}" target="_blank" style="color: #2ed8a3; text-decoration: none; font-weight: 600;" title="View Knots Commit">Knots <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i></a>
            </td>
        </tr>
    `}).join('');
}

function setupTrackedCommitsSorting() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(th => {
        // remove existing listener to avoid duplicates if called multiple times
        th.replaceWith(th.cloneNode(true));
    });
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortCol = th.getAttribute('data-sort');
            if (currentSortCol === sortCol) {
                currentSortAsc = !currentSortAsc;
            } else {
                currentSortCol = sortCol;
                currentSortAsc = true;
            }
            
            // update sort icons
            document.querySelectorAll('th[data-sort] i').forEach(icon => {
                icon.className = 'fas fa-sort';
            });
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = currentSortAsc ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
            
            renderTrackedCommitsTable();
        });
    });
}

function renderHygieneChart(core, knots) {
    const chartDom = document.getElementById('chart-hygiene');
    const myChart = echarts.init(chartDom, 'dark');

    const knotsTotal = knots.merges + knots.clean_commits;
    const coreTotal = core.merges + core.clean_commits;
    const knotsMergePct = knotsTotal > 0 ? (knots.merges / knotsTotal * 100) : 0;
    const knotsCleanPct = knotsTotal > 0 ? (knots.clean_commits / knotsTotal * 100) : 0;
    const coreMergePct = coreTotal > 0 ? (core.merges / coreTotal * 100) : 0;
    const coreCleanPct = coreTotal > 0 ? (core.clean_commits / coreTotal * 100) : 0;

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: function(params) {
                let s = params[0].name + '<br/>';
                params.forEach(p => {
                    s += p.marker + p.seriesName + ': ' + p.value.toFixed(1) + '%<br/>';
                });
                return s;
            }
        },
        legend: {
            data: ['Merge Commits', 'Clean Commits'],
            textStyle: { color: '#888' },
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            top: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            max: 100,
            axisLabel: { formatter: '{value}%' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        yAxis: {
            type: 'category',
            data: ['Bitcoin Knots', 'Bitcoin Core'],
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } }
        },
        series: [
            {
                name: 'Merge Commits',
                type: 'bar',
                stack: 'total',
                itemStyle: { color: '#ff4d4d' }, // Red for messy
                data: [knotsMergePct, coreMergePct]
            },
            {
                name: 'Clean Commits',
                type: 'bar',
                stack: 'total',
                itemStyle: { color: '#4cd137' }, // Green for clean
                data: [knotsCleanPct, coreCleanPct]
            }
        ]
    };

    myChart.setOption(option);

    // Make bubbles clickable
    myChart.on('click', function (params) {
        if (params.data && params.data.hash) {
            window.open(`https://github.com/bitcoinknots/bitcoin/commit/${params.data.hash}`, '_blank');
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

    // Old overlapping chart removed

function renderTrendChart(trendData) {
    const chartDom = document.getElementById('chart-trend');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom, 'dark');

    const monthsSet = new Set([...Object.keys(trendData.core || {}), ...Object.keys(trendData.knots || {})]);
    const months = Array.from(monthsSet).sort();

    const coreData = months.map(m => trendData.core[m] || 0);
    const knotsData = months.map(m => trendData.knots[m] || 0);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['Bitcoin Core', 'Knots (Incremental)'],
            textStyle: { color: '#888' },
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            top: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: months,
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [
            {
                name: 'Bitcoin Core',
                type: 'line',
                smooth: true,
                itemStyle: { color: '#DCA750' },
                areaStyle: { color: 'rgba(243, 156, 18, 0.1)' },
                data: coreData
            },
            {
                name: 'Knots (Incremental)',
                type: 'line',
                smooth: true,
                itemStyle: { color: '#3498db' },
                areaStyle: { color: 'rgba(52, 152, 219, 0.1)' },
                data: knotsData
            }
        ]
    };

    myChart.setOption(option);

    // Make bubbles clickable
    myChart.on('click', function (params) {
        if (params.data && params.data.hash) {
            window.open(`https://github.com/bitcoinknots/bitcoin/commit/${params.data.hash}`, '_blank');
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

function formatName(dev) {
    const displayName = dev.name || dev.uuid;
    if (!dev.has_profile) {
        return `<span style="color: var(--text-primary)">${displayName}</span>`;
    }
    return `<a href="https://bitcoindatalabs.org/network/profile.html?uuid=${dev.uuid}" target="_blank" style="color: var(--primary); text-decoration: underline; text-underline-offset: 2px;">${displayName}</a>`;
}

function populateList(id, list, formatter) {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    if (!list || list.length === 0) {
        ul.innerHTML = '<li style="color: var(--text-secondary); font-size: 0.9rem;">No developers found.</li>';
        return;
    }
    list.forEach(dev => {
        const li = document.createElement('li');
        li.style.cssText = "color: var(--text-primary); font-size: 0.9rem; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center;";
        li.innerHTML = `<i class="fas fa-user-astronaut" style="margin-right: 10px; color: var(--text-secondary); font-size: 0.8em;"></i> ` + formatter(dev);
        ul.appendChild(li);
    });
}

function renderProvenanceCharts(provenance) {
    const chartWhoDom = document.getElementById('chart-provenance-who');
    const chartWhereDom = document.getElementById('chart-provenance-where');
    if (!chartWhoDom || !chartWhereDom) return;
    
    const chartWho = echarts.init(chartWhoDom, 'dark');
    const chartWhere = echarts.init(chartWhereDom, 'dark');

    // Chart 1: Who Wrote It? (Luke vs Others)
    const lukePct = provenance.luke.pct;
    
    const optionWho = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} commits ({d}%)'
        },
        series: [
            {
                name: 'Authorship',
                type: 'pie',
                radius: ['45%', '70%'],
                label: {
                    show: true,
                    position: 'center',
                    formatter: function() {
                        return `{big|${lukePct.toFixed(0)}%}\n{small|Luke Dashjr}`;
                    },
                    rich: {
                        big: { fontSize: 32, fontWeight: 'bold', color: '#DCA750', lineHeight: 40 },
                        small: { fontSize: 12, color: '#aaa', fontWeight: '600', lineHeight: 18 }
                    }
                },
                itemStyle: { borderRadius: 6, borderColor: '#111', borderWidth: 2 },
                data: [
                    { value: provenance.luke.commits, name: 'Luke Dashjr', itemStyle: { color: '#DCA750' } },
                    { 
                        value: provenance.total_incremental_commits - provenance.luke.commits, 
                        name: 'Other Developers', 
                        itemStyle: { color: '#444' },
                        label: { show: false } // Only show Luke in center
                    }
                ]
            }
        ]
    };
    chartWho.setOption(optionWho);

    // Chart 2: Where Did It Come From?
    const optionWhere = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} commits ({d}%)'
        },
        series: [
            {
                name: 'Provenance',
                type: 'pie',
                radius: ['45%', '70%'],
                label: {
                    show: true,
                    formatter: function(params) {
                        return params.name + '\n' + Math.round(params.percent) + '%';
                    },
                    color: '#ccc',
                    fontSize: 12
                },
                labelLine: { show: true, lineStyle: { color: '#555' } },
                itemStyle: { borderRadius: 6, borderColor: '#111', borderWidth: 2 },
                data: [
                    { value: provenance.luke.breakdown ? provenance.luke.breakdown.native : 0, name: 'Luke (Native)', itemStyle: { color: '#DCA750' } },
                    { value: provenance.luke.breakdown ? provenance.luke.breakdown.fast_tracked : 0, name: 'Luke (Fast-Tracked)', itemStyle: { color: '#DCA750', opacity: 0.7 } },
                    { value: provenance.luke.breakdown ? provenance.luke.breakdown.salvaged : 0, name: 'Luke (Legacy)', itemStyle: { color: '#DCA750', opacity: 0.4 } },
                    { value: provenance.salvaged_from_core.commits, name: 'Others (Ported)', itemStyle: { color: '#636e72' } },
                    { value: (provenance.fast_tracked ? provenance.fast_tracked.commits : 0), name: 'Others (Fast-Tracked)', itemStyle: { color: '#E8916B' } },
                    { value: provenance.knots_community.commits, name: 'Knots Native', itemStyle: { color: '#2ed8a3' } }
                ].filter(d => d.value > 0)
            }
        ]
    };
    
    chartWhere.setOption(optionWhere);
    
    window.addEventListener('resize', () => {
        chartWho.resize();
        chartWhere.resize();
    });
}

function renderBusFactorTreemap(overlap) {
    const chartDom = document.getElementById('chart-busfactor');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom, 'dark');

    // Combine all knots developers: both_devs (by knots commits) + knots_only_devs
    const allDevs = [];
    
    if (overlap.both_devs) {
        overlap.both_devs.forEach(dev => {
            allDevs.push({ name: dev.name, value: dev.commits_knots, provenance: dev.provenance || 'unknown' });
        });
    }
    if (overlap.knots_only_devs) {
        overlap.knots_only_devs.forEach(dev => {
            allDevs.push({ name: dev.name, value: dev.commits, provenance: 'knots_native' });
        });
    }
    
    // Sort descending for treemap
    allDevs.sort((a, b) => b.value - a.value);

    // Color mapping by provenance
    const colorMap = {
        'lead': '#DCA750',
        'active_dual': '#6c5ce7',
        'ancient_ghost': '#636e72',
        'ghost': '#636e72',
        'fast_tracked': '#E8916B',
        'knots_native': '#2ed8a3',
        'unknown': '#555'
    };
    
    // Assign colors
    allDevs.forEach(d => {
        d.itemStyle = { color: colorMap[d.provenance] || '#555' };
    });

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            formatter: function(params) {
                const labels = {
                    'lead': '🔧 Lead Maintainer',
                    'active_dual': '🟢 Active in Both',
                    'ancient_ghost': '📦 Legacy Upstream',
                    'ghost': '📦 Upstream',
                    'fast_tracked': '⏩ Fast-Tracked',
                    'knots_native': '🔵 Knots Exclusive',
                    'unknown': '❓ Unknown'
                };
                return `<strong>${params.name}</strong><br/>${params.value} commits<br/>${labels[params.data.provenance] || ''}`;
            }
        },
        series: [{
            type: 'treemap',
            data: allDevs,
            roam: false,
            nodeClick: false,
            width: '100%',
            height: '100%',
            breadcrumb: { show: false },
            label: {
                show: true,
                formatter: '{b}',
                fontSize: 11,
                color: '#fff'
            },
            itemStyle: {
                borderColor: '#111',
                borderWidth: 2,
                gapWidth: 2
            },
            levels: [{
                itemStyle: {
                    borderColor: '#111',
                    borderWidth: 2,
                    gapWidth: 2
                }
            }]
        }]
    };

    myChart.setOption(option);

    // Make bubbles clickable
    myChart.on('click', function (params) {
        if (params.data && params.data.hash) {
            window.open(`https://github.com/bitcoinknots/bitcoin/commit/${params.data.hash}`, '_blank');
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

function renderGraveyardChart(graveyard) {
    const chartDom = document.getElementById('chart-legacy');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom, 'dark');

    // Transform commits into scatter data: [author_date_timestamp, committer_date_timestamp, subject, author_name, delta_days]
    const scatterData = graveyard.commits.map(c => {
        const ax = new Date(c.author_date).getTime();
        const cy = new Date(c.committer_date).getTime();
        return {
            value: [ax, cy],
            subject: c.subject,
            author: c.author_name,
            delta: c.delta_days,
            hash: c.hash
        };
    });

    // Split into salvaged (delta > 365 days) and recent for color differentiation
    const salvaged = scatterData.filter(d => d.delta > 365);
    const moderate = scatterData.filter(d => d.delta > 60 && d.delta <= 365);
    const recent = scatterData.filter(d => d.delta <= 60);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const d = params.data;
                const aDate = new Date(d.value[0]).toLocaleDateString();
                const cDate = new Date(d.value[1]).toLocaleDateString();
                return `<strong>${d.author}</strong><br/>` +
                       `"${d.subject}"<br/>` +
                       `Written: ${aDate}<br/>` +
                       `Rebased: ${cDate}<br/>` +
                       `<strong>Age: ${d.delta.toLocaleString()} days</strong><br/><br/>` +
                       `<span style="color:#3498db; font-size: 0.85em;">👉 Click to view commit</span>`;
            }
        },
        legend: {
            data: ['Legacy (>1yr old)', 'Moderate (60d-1yr)', 'Recent (<60d)'],
            textStyle: { color: '#888' },
            bottom: 0
        },
        grid: {
            left: '8%',
            right: '5%',
            bottom: '15%',
            top: '8%',
            containLabel: true
        },
        xAxis: {
            type: 'time',
            name: 'Author Date (When Originally Written)',
            nameLocation: 'center',
            nameGap: 30,
            nameTextStyle: { color: '#888', fontSize: 11 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        yAxis: {
            type: 'time',
            name: 'Committer Date (When Last Rebased)',
            nameLocation: 'center',
            nameGap: 55,
            nameTextStyle: { color: '#888', fontSize: 11 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        series: [
            {
                name: 'Legacy (>1yr old)',
                type: 'scatter',
                data: salvaged,
                symbolSize: 6,
                itemStyle: { color: '#ff6b6b', opacity: 0.7 }
            },
            {
                name: 'Moderate (60d-1yr)',
                type: 'scatter',
                data: moderate,
                symbolSize: 5,
                itemStyle: { color: '#E8916B', opacity: 0.6 }
            },
            {
                name: 'Recent (<60d)',
                type: 'scatter',
                data: recent,
                symbolSize: 4,
                itemStyle: { color: '#2ed8a3', opacity: 0.5 },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: 'rgba(255, 255, 255, 0.5)', type: 'dashed', width: 2 },
                    data: [
                        [
                            { coord: ['2011-01-01', '2011-01-01'] },
                            { coord: ['2026-12-31', '2026-12-31'] }
                        ]
                    ],
                    label: {
                        show: true,
                        position: 'insideMiddleBottom',
                        formatter: 'Same-day Authorship',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: 12
                    }
                },
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgba(255, 107, 107, 0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 107, 107, 0.2)',
                        borderType: 'dashed'
                    },
                    data: [
                        [
                            {
                                xAxis: '2011-01-01',
                                yAxis: '2023-01-01'
                            },
                            {
                                xAxis: '2019-12-31',
                                yAxis: '2026-12-31'
                            }
                        ]
                    ],
                    label: {
                        show: true,
                        position: 'insideTopLeft',
                        formatter: 'Legacy Zone\n(Older code, maintained)',
                        color: 'rgba(255, 107, 107, 0.8)',
                        fontSize: 14,
                        fontWeight: 'bold',
                        padding: [15, 15, 15, 15]
                    }
                }
            }
        ]
    };

    myChart.setOption(option);

    // Make bubbles clickable
    myChart.on('click', function (params) {
        if (params.data && params.data.hash) {
            window.open(`https://github.com/bitcoinknots/bitcoin/commit/${params.data.hash}`, '_blank');
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

let provenanceTableData = [];
let provSortCol = 'knots_commits';
let provSortAsc = false;

function populateProvenanceTable(overlap) {
    provenanceTableData = [];

    if (overlap.both_devs) {
        overlap.both_devs.forEach(dev => {
            provenanceTableData.push({
                name: dev.name,
                uuid: dev.uuid,
                has_profile: dev.has_profile,
                knots_commits: dev.commits_knots,
                core_all: dev.commits_core_all_time,
                provenance: dev.provenance || 'ghost'
            });
        });
    }

    if (overlap.knots_only_devs) {
        overlap.knots_only_devs.forEach(dev => {
            provenanceTableData.push({
                name: dev.name,
                uuid: dev.uuid,
                has_profile: dev.has_profile,
                knots_commits: dev.commits,
                core_all: 0,
                provenance: 'knots_native'
            });
        });
    }

    renderProvenanceTable();
    setupProvenanceSorting();
}

function renderProvenanceTable() {
    const tbody = document.getElementById('tbody-provenance');
    if (!tbody) return;
    tbody.innerHTML = '';

    const badgeMap = {
        'lead': { emoji: '🔧', label: 'Lead', color: '#DCA750' },
        'active_dual': { emoji: '🟢', label: 'Active Dual', color: '#6c5ce7' },
        'ancient_ghost': { emoji: '📦', label: 'Legacy Upstream', color: '#636e72' },
        'ghost': { emoji: '📦', label: 'Upstream', color: '#636e72' },
        'fast_tracked': { emoji: '⏩', label: 'Fast-Tracked', color: '#E8916B' },
        'knots_native': { emoji: '🔵', label: 'Knots Native', color: '#2ed8a3' }
    };

    const order = { 'lead': 0, 'active_dual': 1, 'knots_native': 2, 'fast_tracked': 3, 'ancient_ghost': 4, 'ghost': 4 };

    provenanceTableData.sort((a, b) => {
        let valA, valB;
        if (provSortCol === 'status') {
            valA = order[a.provenance] || 99;
            valB = order[b.provenance] || 99;
        } else if (provSortCol === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else {
            valA = a[provSortCol];
            valB = b[provSortCol];
        }

        if (valA < valB) return provSortAsc ? -1 : 1;
        if (valA > valB) return provSortAsc ? 1 : -1;
        // Tiebreaker
        return b.knots_commits - a.knots_commits;
    });

    provenanceTableData.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        if (row.provenance === 'ghost' || row.provenance === 'ancient_ghost' || row.provenance === 'fast_tracked') {
            tr.style.opacity = '0.55';
        }

        const badge = badgeMap[row.provenance] || badgeMap['ghost'];
        const nameHtml = row.has_profile 
            ? `<a href="https://network.bitcoindatalabs.org/profile.html?uuid=${row.uuid}" target="_blank" style="color: var(--primary); text-decoration: underline; text-underline-offset: 2px;">${row.name}</a>`
            : `<span style="color: var(--text-primary)">${row.name}</span>`;

        tr.innerHTML = `
            <td style="padding: 10px 15px; color: var(--text-primary);">${nameHtml}</td>
            <td style="padding: 10px; text-align: center; color: var(--text-primary); font-weight: 600;">${row.knots_commits}</td>
            <td style="padding: 10px; text-align: center; color: var(--text-secondary);">${row.core_all.toLocaleString()}</td>
            <td style="padding: 10px; text-align: center;">
                <span style="color: ${badge.color}; font-size: 0.85rem;" title="${badge.label}">${badge.emoji} ${badge.label}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupProvenanceSorting() {
    const headers = document.querySelectorAll('th[data-prov-sort]');
    headers.forEach(th => {
        th.replaceWith(th.cloneNode(true));
    });
    
    document.querySelectorAll('th[data-prov-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortCol = th.getAttribute('data-prov-sort');
            if (provSortCol === sortCol) {
                provSortAsc = !provSortAsc;
            } else {
                provSortCol = sortCol;
                provSortAsc = sortCol === 'name' ? true : false;
            }
            
            document.querySelectorAll('th[data-prov-sort] i').forEach(icon => {
                icon.className = 'fas fa-sort';
            });
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = provSortAsc ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
            
            renderProvenanceTable();
        });
    });
}
