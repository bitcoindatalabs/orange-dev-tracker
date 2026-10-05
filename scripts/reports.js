/**
 * reports.js — renders the 6-slide State of Bitcoin Core MBR from the monthly snapshot
 * (schema "mbr-v2", produced by python/automation/jobs/orange_dev/monthly_state.py).
 */
(function () {
    'use strict';

    const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
        'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
    const SITE = 'orange-dev.bitcoindatalabs.org';

    // ---------- helpers ----------
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtPct = (v, d = 0) => (v === null || v === undefined) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
    const arrow = (v) => (v === null || v === undefined) ? '' : (v >= 0 ? '▲' : '▼');

    function head(snap, n, kicker) {
        return `<div class="slide-head"><span><span class="brand">Bitcoin Data Labs</span> · ${esc(kicker)}</span>
            <span class="month">${esc(snap.target_month_formatted)}</span></div>`;
    }

    function foot(n, note) {
        return `<div class="slide-foot"><span>State of Bitcoin Core · <b>${SITE}</b>${note ? ' · ' + esc(note) : ''}</span>
            <span>${n} / 6</span></div>`;
    }

    /** Polarity class for a delta: favourable = pos, unfavourable = neg. */
    function polarity(value, goodDirection) {
        if (value === null || value === undefined || value === 0 || !goodDirection) return 'muted';
        const up = value > 0;
        return (up === (goodDirection === 'up')) ? 'pos' : 'neg';
    }

    /**
     * Sparkline with the trailing-12-month p10–p90 band and median line.
     * history = all but last point; the last point is the target month (dot).
     */
    function sparkline(values, opts = {}) {
        const w = opts.w || 180, h = opts.h || 38, pad = 4;
        const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v !== null && p.v !== undefined);
        if (pts.length < 2) return '';
        const vals = pts.map((p) => p.v);
        const hist = values.slice(0, -1).filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
        const q = (p) => {
            if (!hist.length) return null;
            const idx = (hist.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
            return hist[lo] + (hist[hi] - hist[lo]) * (idx - lo);
        };
        const p10 = q(0.1), p90 = q(0.9), med = q(0.5);
        let min = Math.min(...vals), max = Math.max(...vals);
        if (min === max) { min -= 1; max += 1; }
        const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        const line = pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
        const last = pts[pts.length - 1];
        const band = (p10 !== null && opts.band !== false)
            ? `<rect class="spark-band" x="${pad}" y="${y(p90).toFixed(1)}" width="${w - pad * 2}" height="${Math.max(1, y(p10) - y(p90)).toFixed(1)}" rx="2"></rect>
               <line class="spark-median" x1="${pad}" x2="${w - pad}" y1="${y(med).toFixed(1)}" y2="${y(med).toFixed(1)}"></line>` : '';
        const title = opts.labels ? `<title>${esc(opts.labels.map((l, i) => `${l}: ${values[i] ?? '—'}`).join('\n'))}</title>` : '';
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="13-month trend">${title}${band}
            <polyline class="spark-line" points="${line}"></polyline>
            <circle class="spark-dot" cx="${x(last.i).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4"></circle></svg>`;
    }

    // ---------- Slide 1: bottom line ----------
    function renderSlide1(s) {
        const goodDir = { merged: 'up', ttm_p50: 'down', reviewers: 'up', open: 'down', new_contributors: 'up' };
        const kpis = s.kpis.map((k) => {
            const cls = polarity(k.yoy_pct, goodDir[k.key]);
            // Percent change on tiny counts (e.g. 1 -> 15 = +1400%) misleads; show the absolute change instead
            const smallBase = k.unit !== 'd' && k.yoy_prev !== null && k.yoy_prev !== undefined && k.yoy_prev < 10;
            const med = k.median_12 === null ? '—' : (k.unit === 'd' ? k.median_12.toFixed(1) + 'd' : Math.round(k.median_12));
            return `<div class="card kpi">
                <div class="kpi-label">${esc(k.label)}</div>
                <div class="kpi-value">${esc(k.display)}${k.unit ? `<span class="unit">${esc(k.unit)}</span>` : ''}</div>
                <div class="kpi-delta ${cls}">${smallBase
                    ? `${arrow(k.value - k.yoy_prev)} ${k.value - k.yoy_prev >= 0 ? '+' : ''}${k.value - k.yoy_prev} <span class="dim">vs a year ago</span>`
                    : `${arrow(k.yoy_pct)} ${fmtPct(k.yoy_pct)} <span class="dim">YoY</span>`}</div>
                <div class="kpi-sub">${esc(k.sub)}</div>
                ${sparkline(k.trend, { w: 186, h: 150, labels: s.month_labels })}
                <div class="kpi-bench">12-mo median ${med} · band = p10–p90</div>
            </div>`;
        }).join('');

        const takeaways = s.headline.takeaways.map((t) => `<div class="card takeaway">
            <div class="card-label">${esc(t.label)}</div><p>${esc(t.text)}</p></div>`).join('');

        return `${head(s, 1, 'State of Bitcoin Core')}
            <h1 class="slide-title">${esc(s.headline.title)}</h1>
            <div class="slide-body">
                <div class="grid cols-3">${takeaways}</div>
                <div class="grid cols-5 fill">${kpis}</div>
            </div>
            ${foot(1, `bitcoin/bitcoin · data through ${s.data_through}`)}`;
    }

    // ---------- Slide 2: scorecard ----------
    function statusFor(r) {
        if (r.status === 'Normal') return '<span class="status neutral">Normal</span>';
        const up = r.status === 'High';
        if (!r.good_direction) return `<span class="status watch">${r.status}</span>`;
        const good = up === (r.good_direction === 'up');
        return `<span class="status ${good ? 'good' : 'bad'}">${r.status}</span>`;
    }

    function deltaCell(txt, goodDirection) {
        if (!txt) return '<td class="num">—</td>';
        const v = parseFloat(txt);
        return `<td class="num ${polarity(v, goodDirection)}">${esc(txt)}</td>`;
    }

    function renderSlide2(s) {
        let lastGroup = null;
        const rows = s.scorecard.map((r) => {
            const first = r.group !== lastGroup;
            lastGroup = r.group;
            return `<tr class="${first ? 'group-start' : ''}">
                <td class="l group">${first ? esc(r.group) : ''}</td>
                <td class="l metric">${esc(r.metric)}</td>
                <td class="val">${esc(r.display)}</td>
                ${deltaCell(r.mom, r.good_direction)}
                ${deltaCell(r.yoy, r.good_direction)}
                <td class="num">${esc(r.median_12)}</td>
                <td class="spark">${sparkline(r.trend, { w: 150, h: 30, labels: s.month_labels })}</td>
                <td>${statusFor(r)}</td>
            </tr>`;
        }).join('');
        const month = s.target_month_formatted.split(' ')[0].slice(0, 3);
        return `${head(s, 2, 'Operational Benchmark')}
            <h1 class="slide-title small">13-month development scorecard: every metric against its own trailing-12-month band</h1>
            <div class="slide-sub">Scope: <b>bitcoin/bitcoin</b> for every row except the two labelled gui / secp256k1 merge rows.</div>
            <div class="slide-body">
                <div class="card fill" style="padding:14px 8px 6px">
                    <table class="scorecard">
                        <thead><tr><th class="l">Group</th><th class="l">Metric</th><th>${esc(month)}</th><th>MoM</th><th>YoY</th>
                            <th>12-mo median</th><th class="l">13-mo trend</th><th class="l">Status</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
            ${foot(2, 'High/Low = outside trailing-12-mo p10–p90 · green/red = favourable/unfavourable')}`;
    }

    // ---------- Slide 3: shipped ----------
    function stackedBars(trend) {
        const names = Object.keys(trend.series);
        const months = trend.months;
        const w = 500, h = 450, left = 34, right = 6, top = 8, bottom = 24;
        const bw = (w - left - right) / months.length;
        const gap = 6;
        let bars = '';
        months.forEach((m, mi) => {
            let acc = 0;
            names.forEach((n, ni) => {
                const v = trend.series[n][mi];
                if (!v) return;
                const y0 = top + (1 - (acc + v) / 100) * (h - top - bottom);
                const hh = (v / 100) * (h - top - bottom);
                const color = n === 'Other' ? 'var(--series-other)' : SERIES[ni % SERIES.length];
                bars += `<rect x="${(left + mi * bw + gap / 2).toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw - gap).toFixed(1)}"
                    height="${Math.max(0, hh - 2).toFixed(1)}" fill="${color}" rx="2"><title>${esc(m)} · ${esc(n)}: ${v.toFixed(1)}%</title></rect>`;
                acc += v;
            });
            if (mi % 2 === 0 || mi === months.length - 1) {
                bars += `<text class="axis-label" x="${(left + mi * bw + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(m)}</text>`;
            }
        });
        const ticks = [0, 50, 100].map((t) => {
            const y = top + (1 - t / 100) * (h - top - bottom);
            return `<text class="axis-label" x="${left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${t}%</text>`;
        }).join('');
        const lastIdx = months.length - 1;
        const legend = names.map((n, ni) => `<span><i style="background:${n === 'Other' ? 'var(--series-other)' : SERIES[ni % SERIES.length]}"></i>${esc(n)}<b>${trend.series[n][lastIdx].toFixed(0)}%</b></span>`).join('');
        return `<svg width="100%" viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly share of merged PRs by subsystem">${ticks}${bars}</svg>
            <div class="legend">${legend}</div>`;
    }

    function renderSlide3(s) {
        const sh = s.shipped;
        const domains = sh.domains.map((d) => `<div class="domain"><div class="domain-name">${esc(d.name)}</div>
            ${d.items.map((it) => `<div class="merge">
                <div class="merge-title"><span class="pr">#${it.pr}</span>${esc(it.title)}</div>
                ${it.summary ? `<div class="merge-sum">${esc(it.summary)}</div>` : ''}
                <div class="merge-meta"><b>${it.reviews}</b> review comments · <b>${it.acks}</b> ACKs · by ${esc(it.author_name)}</div>
            </div>`).join('')}</div>`).join('');
        const top = sh.subsystem_trend.current.filter((c) => c.name !== 'Other').slice(0, 2);
        const focus = top.map((c) => `${c.name} (${c.pct.toFixed(0)}%)`).join(' and ');
        return `${head(s, 3, 'What Got Shipped')}
            <h1 class="slide-title small">${sh.merged_count} PRs merged; ${esc(focus)} took the largest share of merges</h1>
            <div class="slide-body">
                <div class="grid split-55-45 fill">
                    <div class="card"><div class="card-label">Most-reviewed merges <span class="meta">by human review comments</span></div>${domains}</div>
                    <div class="card"><div class="card-label">Subsystem share of merges <span class="meta">13 months · % of merged PRs</span></div>${stackedBars(sh.subsystem_trend)}</div>
                </div>
            </div>
            ${foot(3, 'bitcoin/bitcoin only · subsystem from PR title prefix')}`;
    }

    // ---------- Slide 4: roadmap ----------
    function renderSlide4(s) {
        const rm = s.roadmap;
        const inits = rm.initiatives.map((i) => `<div class="init">
            <div class="init-row"><span class="init-name">${esc(i.name)}<span class="dim">#${i.issue}</span></span>
                <span class="init-pct">${i.pct}%</span></div>
            <div class="bar ${i.pct >= 100 ? 'done' : ''}"><span style="width:${Math.min(100, i.pct)}%"></span></div>
            <div class="init-meta">${i.done}/${i.total} tasks${i.champion ? ' · ' + esc(i.champion) : ''} · updated ${esc(i.updated)}</div>
        </div>`).join('');

        const r = rm.release;
        let rel = '<div class="muted">No upcoming major release found.</div>';
        let title = 'Major initiatives and the release train';
        if (r) {
            const total = r.closed + r.open;
            const pct = total ? Math.round(r.closed / total * 100) : 0;
            title = `Bitcoin Core ${r.version} is in ${r.rc ? 'release-candidate testing (' + r.rc + ')' : 'development'} with ${r.open} milestone PR${r.open === 1 ? '' : 's'} open`;
            rel = `<div class="release-version">${esc(r.version)}</div>
                <div class="release-status">${esc(r.status)}</div>
                <div class="bar" style="margin:14px 0 6px"><span style="width:${pct}%"></span></div>
                <div class="kv"><span>Milestone PRs closed</span><span>${r.closed}</span></div>
                <div class="kv"><span>Milestone PRs open</span><span>${r.open}</span></div>
                <div class="kv"><span>PRs in release</span><span>${r.total_prs}</span></div>
                ${r.highlights && r.highlights.length ? `<div class="sublabel">Release highlights</div><ul class="list">${r.highlights.slice(0, 2).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
                ${r.blockers.length ? `<div class="sublabel">Open on the ${esc(r.version)} milestone — review & test</div>
                <ul class="list">${r.blockers.map((b) => `<li><span class="pr">#${b.pr}</span>${esc(b.title)} <span class="dim">· ${esc(b.author)}</span></li>`).join('')}</ul>` : ''}`;
        }
        return `${head(s, 4, 'Protocol Roadmap')}
            <h1 class="slide-title small">${esc(title)}</h1>
            <div class="slide-body">
                <div class="grid split-55-45 fill">
                    <div class="card"><div class="card-label">Tracking issues <span class="meta">task completion</span></div>${inits}</div>
                    <div class="card"><div class="card-label">Release radar</div>${rel}</div>
                </div>
            </div>
            ${foot(4, 'tracking-issue checklists on github.com/bitcoin/bitcoin')}`;
    }

    // ---------- Slide 5: people ----------
    function hbars(rows, valueKey) {
        const max = Math.max(...rows.map((r) => r[valueKey]), 1);
        return rows.map((r) => `<div class="hbar-row">
            <span class="who">${esc(r.name)}${r.name !== r.handle ? `<small>${esc(r.handle)}</small>` : ''}</span>
            <div class="hbar"><span style="width:${(r[valueKey] / max * 100).toFixed(1)}%"></span></div>
            <span class="n">${r.count} <small>${r.share.toFixed(0)}%</small></span></div>`).join('');
    }

    function renderSlide5(s) {
        const p = s.people, f = p.funnel;
        const top = p.mergers.slice(0, 3);
        const topShare = top.reduce((a, m) => a + m.share, 0);
        const names = f.new_handles.slice(0, 24).map((n) => `<span>${esc(n)}</span>`).join('');
        return `${head(s, 5, 'Contributors & Governance')}
            <h1 class="slide-title small">${top.length} maintainers merged ${topShare.toFixed(0)}% of PRs; the top 3 reviewers wrote ${p.top3_review_share.toFixed(0)}% of review comments</h1>
            <div class="slide-body">
                <div class="grid cols-2">
                    <div class="card"><div class="card-label">Merge authority <span class="meta">${p.merges_attributed} merges · GitHub merge events</span></div>
                        ${hbars(p.mergers.slice(0, 6), 'count')}</div>
                    <div class="card"><div class="card-label">Top human reviewers <span class="meta">${p.review_events.toLocaleString()} review comments</span></div>
                        ${hbars(p.reviewers.slice(0, 6), 'count')}
                        <div class="note">Top-3 share <b>${p.top3_review_share.toFixed(1)}%</b> · ${esc(p.concentration.toLowerCase())} review load. Bots excluded.</div></div>
                </div>
                <div class="card fill"><div class="card-label">Onboarding & retention</div>
                    <div class="funnel">
                        <div class="stat"><div class="v">${f.active}</div><div class="k">active developers (authored or reviewed)</div></div>
                        <div class="stat"><div class="v">${f.returned}</div><div class="k">returned from last month's ${f.prev_active}</div></div>
                        <div class="stat"><div class="v">${f.retention.toFixed(0)}%</div><div class="k">month-over-month retention</div></div>
                        <div class="stat"><div class="v">${f.openers_count}</div><div class="k">opened their first PR</div></div>
                        <div class="stat"><div class="v">${f.new_count}</div><div class="k">had their first PR merged</div></div>
                    </div>
                    <div class="sublabel">Welcome — first PR merged this month</div>
                    <div class="names">${names}</div>
                </div>
            </div>
            ${foot(5, 'bitcoin/bitcoin · reviews = reviewed + commented events')}`;
    }

    // ---------- Slide 6: frontier ----------
    function heatmap(hm) {
        const max = Math.max(1, ...hm.topics.flatMap((t) => t.values));
        const headRow = `<tr><th></th>${hm.months.map((m) => `<th>${esc(m.split(" '")[0])}</th>`).join('')}<th></th></tr>`;
        const rows = hm.topics.map((t) => `<tr><td class="topic">${esc(t.name)}</td>
            ${t.values.map((v, i) => {
                const a = v ? 0.12 + 0.88 * (v / max) : 0;
                const bg = v ? `color-mix(in srgb, var(--accent-color) ${(a * 100).toFixed(0)}%, var(--card-bg))` : 'var(--grid-color)';
                return `<td class="cell ${a > 0.55 ? 'dark' : ''}" style="background:${bg}" title="${esc(t.name)} · ${esc(hm.months[i])}: ${v} threads">${v || ''}</td>`;
            }).join('')}
            <td class="total">${t.values.reduce((a, b) => a + b, 0)}</td></tr>`).join('');
        return `<table class="heat">${headRow}${rows}</table>`;
    }

    function renderSlide6(s) {
        const fr = s.frontier;
        const threads = fr.threads.map((t) => `<div class="thread">
            <span class="chip ${t.source === 'Delving' ? 'delving' : 'ml'}">${esc(t.source)}</span>
            <div class="thread-title">${esc(t.title)}</div>
            <div class="thread-meta">${t.messages} messages · ${esc(t.authors.join(', '))}</div></div>`).join('');
        const meet = fr.meetings.slice(0, 3).map((m) => `<li>${esc(m)}</li>`).join('');
        const blockers = (s.roadmap.release && s.roadmap.release.blockers) || [];
        const asks = blockers.map((b) => `<li><span class="pr">#${b.pr}</span>${esc(b.title)}</li>`).join('');
        const topTopic = fr.heatmap.topics[0];
        const src = Object.entries(fr.volume.by_source).map(([k, v]) => `${v} ${k}`).join(' · ');
        return `${head(s, 6, 'Protocol Frontier')}
            <h1 class="slide-title small">${topTopic ? esc(topTopic.name) + ' led 12-month protocol discussion' : 'Protocol discussion'}; ${fr.volume.threads} threads active in ${esc(s.target_month_formatted.split(' ')[0])}</h1>
            <div class="slide-body">
                <div class="card"><div class="card-label">Topic heatmap <span class="meta">active threads per month · Delving Bitcoin + bitcoindev mailing list</span></div>${heatmap(fr.heatmap)}</div>
                <div class="grid cols-2 fill">
                    <div class="card"><div class="card-label">Most active discussions <span class="meta">${esc(src)}</span></div>${threads}</div>
                    <div class="card"><div class="card-label">Dev meeting highlights & next steps <span class="meta">${fr.volume.meetings} meetings</span></div>
                        <ul class="list">${meet}</ul>
                        ${asks ? `<div class="sublabel">Review asks · ${esc(s.roadmap.release.version)} milestone</div><ul class="list">${asks}</ul>` : ''}
                    </div>
                </div>
            </div>
            ${foot(6, 'topics classified per thread')}`;
    }

    // ---------- bootstrap ----------
    const SNAPSHOT_DIR = 'data/monthly_snapshots';
    const MONTH_RE = /^\d{4}-\d{2}$/;
    const snapshotCache = {};

    /** Loads monthly_YYYYMM.js via <script> (works over file:// for headless capture and over https). */
    function loadMonthScript(month) {
        return new Promise((resolve, reject) => {
            const prev = window.__SNAPSHOT__;
            const el = document.createElement('script');
            el.src = `${SNAPSHOT_DIR}/monthly_${month.replace('-', '')}.js`;
            el.onload = () => {
                const snap = window.__SNAPSHOT__;
                window.__SNAPSHOT__ = prev;
                el.remove();
                snap && snap !== prev ? resolve(snap) : reject(new Error(`No snapshot for ${month}`));
            };
            el.onerror = () => { el.remove(); reject(new Error(`No snapshot for ${month}`)); };
            document.head.appendChild(el);
        });
    }

    /** Snapshot for a month ('YYYY-MM'), or the latest one when month is empty. */
    async function loadSnapshot(month) {
        const latest = window.__SNAPSHOT__;
        if (!month || (latest && latest.target_month === month)) {
            if (latest) return latest;
            const res = await fetch(`${SNAPSHOT_DIR}/latest.json`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`latest.json: HTTP ${res.status}`);
            return res.json();
        }
        if (!MONTH_RE.test(month)) throw new Error(`Invalid month: ${month}`);
        if (!snapshotCache[month]) {
            snapshotCache[month] = loadMonthScript(month).catch((err) => {
                delete snapshotCache[month];
                throw err;
            });
        }
        return snapshotCache[month];
    }
    window.loadReportSnapshot = loadSnapshot;

    /** Renders all six slides; returns the number that failed (0 = clean render). */
    function renderReportSlides(snap) {
        if (!snap || snap.schema !== 'mbr-v2') {
            showError(`Unsupported snapshot schema: ${snap ? snap.schema : 'legacy'}`);
            return 6;
        }
        const renderers = [renderSlide1, renderSlide2, renderSlide3, renderSlide4, renderSlide5, renderSlide6];
        let failed = 0;
        renderers.forEach((fn, i) => {
            const el = document.querySelector(`.slide-${i + 1}`);
            if (!el) return;
            try {
                el.innerHTML = fn(snap);
            } catch (err) {
                failed += 1;
                console.error(`[reports] slide ${i + 1} failed`, err);
                el.innerHTML = `<div class="slide-title">Slide ${i + 1} failed to render: ${esc(err.message)}</div>`;
            }
        });
        return failed;
    }
    window.renderReportSlides = renderReportSlides;

    function showError(message) {
        document.querySelectorAll('.report-slide').forEach((el, i) => {
            el.innerHTML = i === 0 ? `<div class="slide-title">Report unavailable: ${esc(message)}</div>` : '';
        });
    }

    async function init() {
        let snap = null;
        let ok = false;
        try {
            snap = await loadSnapshot(new URLSearchParams(window.location.search).get('month'));
            ok = renderReportSlides(snap) === 0;
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
        } catch (err) {
            console.error('[reports] failed to load snapshot', err);
            showError(err.message);
        } finally {
            // Headless capture waits for data-loaded="true"; "error" makes it time out instead of
            // screenshotting a broken slide.
            document.body.setAttribute('data-loaded', ok ? 'true' : 'error');
            window.dispatchEvent(new CustomEvent('reports-loaded', { detail: { snapshot: snap, ok } }));
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
