/* LXP Hub — ops dashboard (walking skeleton).
   Vanilla JS on purpose: the Frontend lane replaces this with the React
   scaffold (work-for-nilesh.md, M1). It talks only to /hub/v1. */

const API = '/hub/v1';
const state = { view: 'dashboard', eventId: null, talentId: null, scope: 'all', query: '' };

const $ = (sel) => document.querySelector(sel);
const main = () => $('#main');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (isErr) el.style.background = 'var(--red)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- shared bits ---------- */

const CHIP = {
  Applied: 'grey', Reviewed: 'grey', Selected: 'blue', BookingSent: 'blue',
  BookedPendingConfirmation: 'teal', TalentConfirmed: 'green', ConfirmationEmailSent: 'green',
  FinalCheckinPending: 'green', CheckedIn: 'teal', ReportingPending: 'amber', Completed: 'green',
  Declined: 'red', Cancelled: 'grey', ReplacementRequired: 'red', NoShow: 'red',
  Open: 'grey', Booked: 'blue', Confirmed: 'green',
  Posted: 'green', Failed: 'red', NotPosted: 'outline', Pending: 'amber',
};
const label = (s) => String(s ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
const chip = (s) => `<span class="chip ${CHIP[s] ?? 'grey'}">${esc(label(s))}</span>`;
const srcBadge = (s) => `<span class="src">${esc(s)}</span>`;

const pctBar = (pct) => {
  const cls = pct === 100 ? '' : pct >= 50 ? 'warn' : pct === 0 ? 'zero' : 'warn';
  return `<div class="bar"><div class="${cls}" style="width:${pct}%"></div></div>`;
};

const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const todayStr = () => new Date().toISOString().slice(0, 10);
const scopeOf = (e) => (e.eventDate === todayStr() ? 'today' : e.eventDate > todayStr() ? 'upcoming' : 'past');

const platformChips = (p) =>
  [['ISD', p.ISDemos], ['PB', p.PopBookings], ['TH', p.TrustedHerd]]
    .map(([abbr, st]) =>
      st === 'Failed'
        ? `<span class="chip red" title="Failed">${abbr} ✗</span> <button class="btn small" data-action="retry" data-platform="${abbr === 'ISD' ? 'IS-Demos' : abbr === 'PB' ? 'PopBookings' : 'TrustedHerd'}" title="Retry this platform only">↻</button>`
        : st === 'Posted'
          ? `<span class="chip green" title="Posted">${abbr} ✓</span>`
          : `<span class="chip outline" title="Not posted">${abbr} –</span>`)
    .join(' ');

/* ---------- views ---------- */

async function renderDashboard() {
  const [sum, alerts] = await Promise.all([api('/dashboard/summary'), api('/notifications?status=unresolved')]);
  const pipeline = Object.entries(sum.pipeline).sort((a, b) => b[1] - a[1]);
  main().innerHTML = `
    <div class="page-head"><div><h2>Dashboard</h2><p>${esc(fmtDate(sum.date))} — the operational loop at a glance</p></div></div>
    <div class="cards">
      <div class="card"><div class="label">Events today</div><div class="kpi">${sum.today.length}</div></div>
      <div class="card"><div class="label">Upcoming events</div><div class="kpi">${sum.upcoming}</div></div>
      <div class="card"><div class="label">Open alerts</div><div class="kpi" style="color:${alerts.length ? 'var(--red)' : 'var(--green)'}">${sum.openAlerts}</div></div>
    </div>
    <div class="grid">
      <div class="panel"><h3>Today's events</h3>
        ${sum.today.length ? `<table><tr><th>Program</th><th>Start</th><th>Staffing</th><th>Posting</th></tr>
          ${sum.today.map((e) => `<tr class="clickable" data-action="open-event" data-id="${e.eventId}">
            <td><b>${esc(e.program)}</b><br><span class="muted">${esc(e.city)}</span></td>
            <td>${esc(e.startTime)}</td>
            <td style="min-width:110px">${pctBar(e.staffing.pct)}<span class="muted">${e.staffing.filled}/${e.staffing.total} · ${e.staffing.pct}%</span></td>
            <td>${platformChips(e.posting)}</td></tr>`).join('')}</table>`
        : '<p class="muted">Nothing scheduled today.</p>'}
      </div>
      <div class="panel"><h3>Priority queue — unresolved</h3>
        ${alerts.length ? alerts.slice(0, 6).map(alertRow).join('') : '<p class="muted">Queue is clear 🎉</p>'}
      </div>
    </div>
    <div class="panel"><h3>Pipeline snapshot (all applications)</h3>
      <div class="btn-row">${pipeline.map(([s, n]) => `${chip(s)} <span class="muted">${n}</span>`).join(' ')}</div>
    </div>`;
}

const alertRow = (n) => `
  <div class="alert ${n.resolved ? 'resolved' : ''}">
    <span class="sev chip ${n.severity === 'high' ? 'red' : n.severity === 'medium' ? 'amber' : 'grey'}">${esc(n.severity)}</span>
    <div style="flex:1">
      <div><b>${esc(label(n.type))}</b>${n.eventProgram ? ` — <a href="#" data-action="open-event" data-id="${n.eventId}">${esc(n.eventProgram)}</a>` : ''}</div>
      <div class="muted">${esc(n.requiredAction)}</div>
      <div class="when">${esc(n.assignedTeamMember)} · ${esc(new Date(n.timestamp).toLocaleString())}</div>
    </div>
    ${n.resolved ? '<span class="chip green">Resolved</span>' : `<button class="btn small" data-action="resolve" data-id="${n.notificationId}">Resolve</button>`}
  </div>`;

async function renderEvents() {
  const events = await api(`/events?scope=${state.scope}`);
  main().innerHTML = `
    <div class="page-head"><div><h2>Events</h2><p>Create once — post to all three platforms</p></div>
      <div class="btn-row">
        ${['all', 'today', 'upcoming', 'past'].map((s) => `<button class="btn ${state.scope === s ? 'primary' : ''}" data-action="scope" data-scope="${s}">${label(s)}</button>`).join('')}
        <button class="btn" data-action="toggle-new">＋ New event</button>
      </div>
    </div>
    <div id="new-event" class="panel hidden">
      <h3>New event</h3>
      <div class="form-grid">
        <div><label>Program *</label><input id="ne-program" placeholder="Fall Sampling — Store 42" /></div>
        <div><label>Client *</label><select id="ne-client"><option value="1">Sunrise Markets</option><option value="2">Vertex Retail Group</option></select></div>
        <div><label>Date *</label><input id="ne-date" type="date" /></div>
        <div><label>Positions *</label><input id="ne-positions" type="number" min="1" max="20" value="2" /></div>
        <div><label>Start</label><input id="ne-start" value="10:00" /></div>
        <div><label>End</label><input id="ne-end" value="16:00" /></div>
        <div><label>Pay rate</label><input id="ne-pay" type="number" step="0.5" value="25" /></div>
        <div><label>City</label><input id="ne-city" placeholder="Chicago" /></div>
      </div>
      <button class="btn primary" data-action="create-event">Create event</button>
    </div>
    <div class="event-grid">
      ${events.map((e) => `
        <div class="event-card ${e.jobCancelled ? 'cancelled' : ''}" data-action="open-event" data-id="${e.eventId}">
          <div class="title">${esc(e.program)} ${e.jobCancelled ? chip('Cancelled') : ''}</div>
          <div class="muted">${esc(fmtDate(e.eventDate))} · ${esc(e.startTime)}–${esc(e.endTime)} · ${esc(e.clientName)} · ${esc(e.city ?? '')}</div>
          ${pctBar(e.staffing.pct)}
          <div class="muted">${e.staffing.filled}/${e.staffing.total} slots staffed · ${e.openApplicants} new applicant${e.openApplicants === 1 ? '' : 's'}</div>
          <div class="btn-row" style="margin-top:8px">${platformChips(e.posting)}</div>
        </div>`).join('') || '<p class="muted pad">No events in this view.</p>'}
    </div>`;
}

const simButtons = (a) => {
  // Ops actions are solid; dashed buttons simulate the IS-Demos poller (§4.3).
  switch (a.status) {
    case 'Applied': return `<button class="btn small" data-action="advance" data-id="${a.applicationId}" data-status="Reviewed">Review</button>`;
    case 'Reviewed': return `<button class="btn small" data-action="advance" data-id="${a.applicationId}" data-status="Selected">Select</button>`;
    case 'Selected': return `<button class="btn small primary" data-action="book" data-id="${a.applicationId}">BOOK</button>`;
    case 'BookingSent': return `<span class="muted">awaiting talent…</span>
      <button class="btn small sim" data-action="sim" data-endpoint="talent-responds" data-id="${a.bookingId}" data-body='{"accept":true}'>Accept</button>
      <button class="btn small sim" data-action="sim" data-endpoint="talent-responds" data-id="${a.bookingId}" data-body='{"accept":false}'>Decline</button>`;
    case 'BookedPendingConfirmation': return `<span class="muted">payment agreement…</span>
      <button class="btn small sim" data-action="sim" data-endpoint="payment-agreement" data-id="${a.bookingId}">Agreement ✓</button>`;
    case 'TalentConfirmed': case 'ConfirmationEmailSent': return '<span class="muted">auto-flow…</span>';
    case 'FinalCheckinPending': return `
      <button class="btn small sim" data-action="sim" data-endpoint="check-in" data-id="${a.bookingId}">Check-in</button>
      <button class="btn small sim" data-action="sim" data-endpoint="no-show" data-id="${a.bookingId}">No-show</button>`;
    case 'CheckedIn': return `<button class="btn small sim" data-action="sim" data-endpoint="report" data-id="${a.bookingId}">Report ✓</button>`;
    default: return '';
  }
};

async function renderEventDetail() {
  const e = await api(`/events/${state.eventId}`);
  const inbox = [...e.applications].sort((a, b) => a.statusChangedAt.localeCompare(b.statusChangedAt));
  const live = inbox.filter((a) => !['Declined', 'Cancelled', 'Completed', 'NoShow'].includes(a.status));
  const allPosted = e.posting.ISDemos === 'Posted' && e.posting.PopBookings === 'Posted' && e.posting.TrustedHerd === 'Posted';
  main().innerHTML = `
    <p><a href="#" data-action="nav" data-view="events">← All events</a></p>
    <div class="page-head">
      <div><h2>${esc(e.program)} ${e.jobCancelled ? chip('Cancelled') : ''}</h2>
        <p>${esc(fmtDate(e.eventDate))} · ${esc(e.startTime)}–${esc(e.endTime)} · ${esc(e.clientName)} · $${e.payRate}/h · ${esc(e.address ?? '')}, ${esc(e.city ?? '')}</p></div>
      <div class="btn-row">
        ${!e.jobCancelled ? (allPosted
          ? '<span class="chip green">All platforms posted</span>'
          : `<button class="btn primary" data-action="post-job">POST JOB</button>`) : ''}
        ${!e.jobCancelled ? `<button class="btn danger" data-action="cancel-event">Cancel event</button>` : ''}
      </div>
    </div>
    <div class="panel">
      <div class="btn-row" style="justify-content:space-between">
        <div>${pctBar(e.staffing.pct)} <b>${e.staffing.filled}/${e.staffing.total}</b> slots staffed (${e.staffing.pct}%)</div>
        <div class="btn-row">${platformChips(e.posting)}</div>
      </div>
    </div>
    <div class="grid">
      <div class="panel"><h3>Slots</h3>
        <table><tr><th>#</th><th>Status</th><th>Talent</th><th>Platform state (sim)</th></tr>
        ${e.positions.map((p) => {
          const app = live.find((a) => a.positionId === p.positionId);
          return `<tr>
            <td>${p.slotNumber}</td>
            <td>${chip(p.status)}</td>
            <td>${p.talent ? `<a href="#" data-action="open-talent" data-id="${p.talent.talentId}">${esc(p.talent.firstName)} ${esc(p.talent.lastName)}</a>` : '<span class="muted">—</span>'}</td>
            <td class="btn-row">${app ? simButtons(app) : '<span class="muted">—</span>'}
              ${app && ['Booked', 'Confirmed', 'CheckedIn'].includes(p.status) && app.bookingId ? `<button class="btn small danger" data-action="unbook" data-id="${app.bookingId}">Unbook</button>` : ''}</td>
          </tr>`;
        }).join('')}</table>
      </div>
      <div class="panel"><h3>Applicant inbox <span class="muted">(${live.length} active)</span></h3>
        ${inbox.length ? `<table><tr><th>Talent</th><th>Source</th><th>Status</th><th>Action</th></tr>
          ${inbox.map((a) => `<tr>
            <td><a href="#" data-action="open-talent" data-id="${a.talent.talentId}">${esc(a.talent.firstName)} ${esc(a.talent.lastName)}</a><br>
                <span class="muted">${esc(a.talent.homeMarket ?? '')} · ${a.talent.completedJobsCount}✓ ${a.talent.noShowCount ? `· ${a.talent.noShowCount}✗` : ''}</span></td>
            <td>${srcBadge(a.platformSource)}</td>
            <td>${chip(a.status)}</td>
            <td class="btn-row">${simButtons(a)}</td></tr>`).join('')}</table>`
        : '<p class="muted">No applications yet.</p>'}
        <div class="dev-note">Dev/poller simulator:</div>
        <div class="btn-row">
          <button class="btn sim" data-action="sim-event" data-endpoint="apply">Simulate applicants</button>
          <button class="btn sim" data-action="sim-event" data-endpoint="day-passed">Day passed (poller cycle)</button>
        </div>
      </div>
    </div>`;
}

async function renderTalent() {
  const q = encodeURIComponent(state.query);
  const rows = await api(`/talent?query=${q}`);
  main().innerHTML = `
    <div class="page-head"><div><h2>Talent</h2><p>One shared record — no duplicates per platform</p></div>
      <input id="talent-search" placeholder="Search name, email, market, source…" value="${esc(state.query)}" style="min-width:280px" /></div>
    <div class="event-grid">
      ${rows.map((t) => `
        <div class="event-card" data-action="open-talent" data-id="${t.talentId}">
          <div class="title">${esc(t.firstName)} ${esc(t.lastName)}</div>
          <div class="muted">${esc(t.homeMarket ?? '—')} · ${esc(t.source)}</div>
          <div class="btn-row" style="margin-top:8px">
            ${chip(t.completedJobsCount ? 'Completed' : 'Applied')}
            <span class="muted">${t.completedJobsCount} jobs ✓</span>
            ${t.noShowCount ? `<span class="chip red">${t.noShowCount} no-show${t.noShowCount > 1 ? 's' : ''}</span>` : ''}
            ${t.paymentAgreementRequired ? '<span class="chip amber">Payment agreement</span>' : ''}
          </div>
        </div>`).join('') || '<p class="muted pad">No talent matches.</p>'}
    </div>`;
  $('#talent-search').addEventListener('input', (ev) => { state.query = ev.target.value; renderTalent(); });
}

async function renderTalentProfile() {
  const t = await api(`/talent/${state.talentId}`);
  main().innerHTML = `
    <p><a href="#" data-action="nav" data-view="talent">← Talent</a></p>
    <div class="page-head"><div><h2>${esc(t.firstName)} ${esc(t.lastName)}</h2>
      <p>${esc(t.email ?? '')} · ${esc(t.phone ?? '')} · ${esc(t.homeMarket ?? '')} · source: ${esc(t.source)}</p></div>
      <div class="btn-row"><span class="chip green">${t.completedJobsCount} completed</span>
      ${t.noShowCount ? `<span class="chip red">${t.noShowCount} no-shows</span>` : ''}
      ${t.paymentAgreementRequired ? '<span class="chip amber">payment agreement required</span>' : ''}</div></div>
    <div class="grid">
      <div class="panel"><h3>Applications & bookings</h3>
        ${t.applications.length ? `<table><tr><th>Event</th><th>Source</th><th>Status</th><th>Booking</th></tr>
          ${t.applications.map((a) => `<tr class="clickable" data-action="open-event" data-id="${a.eventId}">
            <td>#${a.eventId} slot ${a.slotNumber ?? '—'}</td><td>${srcBadge(a.platformSource)}</td><td>${chip(a.status)}</td>
            <td>${a.bookingId ? esc(a.bookingId) : '—'}</td></tr>`).join('')}</table>` : '<p class="muted">None yet.</p>'}
      </div>
      <div class="panel"><h3>Communications log</h3>
        ${t.communications.length ? `<table><tr><th>When</th><th>Ch</th><th>Content</th></tr>
          ${t.communications.map((c) => `<tr><td class="muted">${esc(new Date(c.timestamp).toLocaleString())}</td><td>${esc(c.channel)}</td><td>${esc(c.content)}</td></tr>`).join('')}</table>`
        : '<p class="muted">No communications recorded.</p>'}
      </div>
    </div>`;
}

async function renderAlerts() {
  const rows = await api('/notifications');
  const unresolved = rows.filter((n) => !n.resolved);
  const resolved = rows.filter((n) => n.resolved);
  main().innerHTML = `
    <div class="page-head"><div><h2>Alerts</h2><p>${unresolved.length} unresolved · ${resolved.length} resolved</p></div></div>
    <h3>Priority queue</h3>
    ${unresolved.map(alertRow).join('') || '<p class="muted pad">Queue is clear 🎉</p>'}
    <h3 style="margin-top:20px">Resolved</h3>
    ${resolved.slice(0, 10).map(alertRow).join('') || '<p class="muted">Nothing yet.</p>'}`;
}

/* ---------- routing & actions ---------- */

const VIEWS = { dashboard: renderDashboard, events: renderEvents, talent: renderTalent, alerts: renderAlerts };

async function render() {
  try {
    if (state.view === 'event') await renderEventDetail();
    else if (state.view === 'talent-profile') await renderTalentProfile();
    else await VIEWS[state.view]();
  } catch (err) {
    main().innerHTML = `<p class="pad muted">⚠ ${esc(err.message)}</p>`;
  }
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  const badge = $('#alert-badge');
  try {
    const n = (await api('/notifications?status=unresolved')).length;
    badge.textContent = n;
    badge.classList.toggle('hidden', !n);
  } catch { /* server restart */ }
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  ev.preventDefault();
  const { action } = el.dataset;
  const id = el.dataset.id;
  try {
    switch (action) {
      case 'nav': state.view = el.dataset.view; break;
      case 'scope': state.scope = el.dataset.scope; break;
      case 'open-event': state.view = 'event'; state.eventId = id; break;
      case 'open-talent': state.view = 'talent-profile'; state.talentId = id; break;
      case 'toggle-new': $('#new-event').classList.toggle('hidden'); return;
      case 'create-event': {
        const body = {
          companyId: $('#ne-client').value, program: $('#ne-program').value,
          eventDate: $('#ne-date').value, positionsRequired: Number($('#ne-positions').value),
          startTime: $('#ne-start').value, endTime: $('#ne-end').value,
          payRate: Number($('#ne-pay').value), city: $('#ne-city').value,
        };
        if (!body.program || !body.eventDate) throw new Error('Program and date are required');
        const e = await api('/events', { method: 'POST', body });
        toast(`Event created — now hit POST JOB (#${e.eventId})`);
        state.view = 'event'; state.eventId = e.eventId;
        break;
      }
      case 'post-job': {
        const results = await api(`/events/${state.eventId}/post`, { method: 'POST', body: {} });
        const failed = results.filter((r) => r.status === 'Failed').map((r) => r.platform);
        toast(failed.length ? `Posted with failures: ${failed.join(', ')} — retry those only` : 'Posted on all platforms ✓');
        break;
      }
      case 'retry': {
        const results = await api(`/events/${state.eventId}/post/retry`, { method: 'POST', body: { platform: el.dataset.platform } });
        toast(`${el.dataset.platform}: ${results[0].status}`);
        break;
      }
      case 'cancel-event':
        await api(`/events/${state.eventId}/cancel`, { method: 'POST', body: {} });
        toast('Event cancelled — cascade applied');
        break;
      case 'advance':
        await api(`/applications/${id}`, { method: 'PATCH', body: { status: el.dataset.status } });
        break;
      case 'book': {
        const b = await api('/bookings', { method: 'POST', body: { applicationId: Number(id) } });
        toast(`Booking ${b.externalBookingId} sent via IS-Demos`);
        break;
      }
      case 'unbook':
        await api(`/bookings/${id}`, { method: 'DELETE' });
        toast('Booking unassigned — slot reopened, replacement required');
        break;
      case 'resolve':
        await api(`/notifications/${id}/resolve`, { method: 'PATCH' });
        if (state.view === 'alerts') toast('Resolved');
        break;
      case 'sim': {
        const r = await api(`/dev/${el.dataset.endpoint}`, { method: 'POST', body: { bookingId: Number(id), ...JSON.parse(el.dataset.body || '{}') } });
        toast(`Poller observed → ${r.status}`);
        break;
      }
      case 'sim-event': {
        const r = await api(`/dev/${el.dataset.endpoint}`, { method: 'POST', body: { eventId: Number(state.eventId) } });
        toast(Array.isArray(r) ? `${r.length} new applicant(s) arrived` : `Poller cycle: ${r.fired?.join(', ') || 'no material change'}`);
        break;
      }
      default: return;
    }
    render();
  } catch (err) {
    toast(err.message, true);
  }
});

render();
