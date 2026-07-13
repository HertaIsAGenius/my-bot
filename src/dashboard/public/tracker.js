(function () {
  let currentSlot = 1;
  let pollInterval = null;
  const POLL_MS = 8000;

  const ELEMENT_COLORS = {
    fire: '#e8637a', ice: '#6db3e8', wind: '#47a863', lightning: '#c77dff',
    physical: '#b5a67a', quantum: '#7b68ee', imaginary: '#f0d060'
  };
  const RARITY_COLORS = { 3: '#8b7fe8', 4: '#c77dff', 5: '#e7b94c' };
  const PIECE_LABELS = { head: 'Head', hands: 'Hands', body: 'Body', feet: 'Feet', planar_sphere: 'Planar Sphere', link_rope: 'Link Rope' };

  async function fetchData() {
    try {
      const res = await fetch(`/api/hsr/tracker?slot=${currentSlot}`);
      return await res.json();
    } catch { return { success: false }; }
  }

  function renderSlotBtns(slots) {
    const el = document.getElementById('slotBtns');
    el.innerHTML = slots.map(s =>
      `<button class="ts-btn ${s.slot_number === currentSlot ? 'active' : ''}" data-slot="${s.slot_number}">${s.slot_number}. ${s.traveler_name}</button>`
    ).join('');
    el.querySelectorAll('.ts-btn').forEach(btn => {
      btn.onclick = () => { currentSlot = parseInt(btn.dataset.slot); load(); };
    });
  }

  function renderPlayerBar(data) {
    const p = data.player;
    const s = data.saveSlot;
    if (!p) { document.getElementById('playerBar').innerHTML = ''; return; }
    const xpPct = p.trailblaze_level > 0 ? Math.min((p.trailblaze_xp % 1000) / 10, 100) : 0;
    const powerPct = Math.min((p.trailblaze_power / 240) * 100, 100);
    document.getElementById('playerBar').innerHTML = `
      <div class="tpb-left">
        <div class="tpb-name">${s ? s.traveler_name : 'Trailblazer'}</div>
        <div class="tpb-sub">TB Lv.${p.trailblaze_level} · ${s ? s.starting_path : '—'} path</div>
      </div>
      <div class="tpb-stats">
        <div class="tpb-stat"><span class="tpb-stat-label">Credits</span><span class="tpb-stat-val gold">${(p.credits || 0).toLocaleString()}</span></div>
        <div class="tpb-stat"><span class="tpb-stat-label">Stellar Jade</span><span class="tpb-stat-val jade">${(p.stellar_jade || 0).toLocaleString()}</span></div>
        <div class="tpb-stat"><span class="tpb-stat-label">Power</span><span class="tpb-stat-val">${p.trailblaze_power}/240</span>
          <div class="tpb-bar"><div class="tpb-bar-fill power" style="width:${powerPct}%"></div></div>
        </div>
      </div>
      <div class="tpb-right">
        <div class="tpb-location">${(p.current_location || '').replace(/_/g, ' ')}</div>
      </div>
    `;
  }

  function renderRoster(data) {
    const el = document.getElementById('tab-roster');
    if (!data.roster.length) { el.innerHTML = '<div class="t-empty">No characters unlocked yet.</div>'; return; }

    const inParty = data.roster.filter(c => c.party_slot);
    const others = data.roster.filter(c => !c.party_slot);

    let html = '';
    if (inParty.length) {
      html += `<div class="t-section-label">Active Party</div><div class="t-roster-grid party-grid">`;
      for (const c of inParty.sort((a, b) => a.party_slot - b.party_slot)) {
        html += renderCharCard(c, true);
      }
      html += '</div>';
    }
    if (others.length) {
      html += `<div class="t-section-label">Roster (${others.length})</div><div class="t-roster-grid">`;
      for (const c of others) {
        html += renderCharCard(c, false);
      }
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderCharCard(c, isParty) {
    const elemColor = ELEMENT_COLORS[c.element] || '#888';
    const xpPct = c.total_xp > 0 ? Math.min((c.xp / c.total_xp) * 100, 100) : 0;
    const hp = Math.round((c.base_hp || 100) * (1 + (c.level - 1) * 0.08));

    let lcHtml = '';
    if (c.light_cone) {
      const lcColor = RARITY_COLORS[c.light_cone.rarity === 5 ? 5 : c.light_cone.rarity === 4 ? 4 : 3] || '#888';
      lcHtml = `<div class="cc-lc"><span class="cc-lc-name" style="color:${lcColor}">${c.light_cone.name}</span> <span class="cc-lc-lv">Lv.${c.light_cone.level} S${c.light_cone.superimpose}</span></div>`;
    }

    let relicHtml = '';
    if (c.relics && c.relics.length) {
      relicHtml = `<div class="cc-relics">${c.relics.map(r => {
        const rc = RARITY_COLORS[r.rarity] || '#888';
        return `<span class="cc-relic-badge" style="border-color:${rc}" title="${r.set_name} — ${PIECE_LABELS[r.piece_type] || r.piece_type} +${r.level}">${r.piece_type.charAt(0).toUpperCase()}</span>`;
      }).join('')}</div>`;
    }

    return `
      <div class="cc ${isParty ? 'cc-party' : ''}" style="--elem-color:${elemColor}">
        <div class="cc-header">
          <div class="cc-avatar" style="background:${elemColor}">${c.name.charAt(0)}</div>
          <div class="cc-info">
            <div class="cc-name">${c.name}</div>
            <div class="cc-meta">${c.path} · ${c.element} · ${'★'.repeat(c.rarity)}</div>
          </div>
          ${c.party_slot ? `<div class="cc-party-badge">P${c.party_slot}</div>` : ''}
        </div>
        <div class="cc-stats">
          <div class="cc-stat"><span>Lv.${c.level}</span><span class="cc-asc">${c.ascension > 0 ? 'A' + c.ascension : ''}</span></div>
          <div class="cc-bar"><div class="cc-bar-fill" style="width:${xpPct}%"></div></div>
          <div class="cc-stat"><span class="cc-hp-label">HP</span><span>${hp.toLocaleString()}</span></div>
        </div>
        ${lcHtml}
        ${relicHtml}
      </div>
    `;
  }

  function renderInventory(data) {
    const el = document.getElementById('tab-inventory');
    if (!data.inventory.length) { el.innerHTML = '<div class="t-empty">Inventory is empty.</div>'; return; }

    const groups = {};
    for (const item of data.inventory) {
      const type = item.type || 'material';
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    }

    let html = '<div class="inv-summary">';
    html += `<span class="inv-total">${data.inventory.length} item types</span>`;
    const totalQty = data.inventory.reduce((s, i) => s + i.quantity, 0);
    html += `<span class="inv-total">${totalQty.toLocaleString()} total items</span>`;
    html += '</div>';

    for (const [type, items] of Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))) {
      html += `<div class="t-section-label">${type.charAt(0).toUpperCase() + type.slice(1)}s</div>`;
      html += '<div class="inv-grid">';
      for (const item of items) {
        const rc = RARITY_COLORS[item.rarity] || '#888';
        html += `
          <div class="inv-card" style="--rarity-color:${rc}">
            <div class="inv-icon" style="background:${rc}22;color:${rc}">${item.name ? item.name.charAt(0) : '?'}</div>
            <div class="inv-details">
              <div class="inv-name">${item.name || item.item_id}</div>
              <div class="inv-meta"><span class="inv-rarity" style="color:${rc}">${'★'.repeat(item.rarity || 1)}</span></div>
            </div>
            <div class="inv-qty">×${item.quantity.toLocaleString()}</div>
          </div>
        `;
      }
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderExpress(data) {
    const el = document.getElementById('tab-express');
    if (!data.express.length) { el.innerHTML = '<div class="t-empty">No Express rooms upgraded yet.</div>'; return; }

    let html = '<div class="express-grid">';
    for (const room of data.express) {
      const pct = room.max_level > 0 ? (room.level / room.max_level) * 100 : 0;
      html += `
        <div class="express-card">
          <div class="ec-header">
            <div class="ec-name">${room.name}</div>
            <div class="ec-lv">Lv.${room.level}/${room.max_level}</div>
          </div>
          <div class="ec-bar-track"><div class="ec-bar-fill" style="width:${pct}%"></div></div>
          <div class="ec-desc">${room.description || ''}</div>
        </div>
      `;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function renderStory(data) {
    const el = document.getElementById('tab-story');
    let html = '';

    if (data.dailies.length) {
      const done = data.dailies.filter(d => d.completed).length;
      html += `<div class="t-section-label">Daily Commissions — ${done}/${data.dailies.length}</div>`;
      html += '<div class="dailies-list">';
      for (const d of data.dailies) {
        html += `<div class="daily-item ${d.completed ? 'done' : ''}">
          <span class="di-check">${d.completed ? '✓' : '○'}</span>
          <span class="di-type">${d.commission_type || '—'}</span>
          <span class="di-desc">${d.description || d.commission_id}</span>
        </div>`;
      }
      html += '</div>';
    }

    const active = data.quests.filter(q => q.status === 'active');
    const available = data.quests.filter(q => q.status === 'available');
    const completed = data.quests.filter(q => q.status === 'completed');

    html += `<div class="t-section-label">Story Progression</div>`;
    html += `<div class="quest-summary">
      <span class="qs-item done">${completed.length} completed</span>
      <span class="qs-item active">${active.length} active</span>
      <span class="qs-item available">${available.length} available</span>
    </div>`;

    if (active.length) {
      html += '<div class="quest-list">';
      for (const q of active) {
        html += `<div class="quest-item active">
          <div class="qi-header"><span class="qi-type">${q.quest_type || 'main'}</span><span class="qi-status active">Active</span></div>
          <div class="qi-title">${q.title || q.quest_id}</div>
          <div class="qi-desc">${q.description || ''}</div>
        </div>`;
      }
      html += '</div>';
    }

    if (completed.length) {
      html += `<div class="t-section-label" style="opacity:0.5">Completed</div>`;
      html += '<div class="quest-list">';
      for (const q of completed.slice(-10)) {
        html += `<div class="quest-item completed">
          <div class="qi-header"><span class="qi-type">${q.quest_type || 'main'}</span><span class="qi-status done">Done</span></div>
          <div class="qi-title">${q.title || q.quest_id}</div>
        </div>`;
      }
      html += '</div>';
    }

    if (data.achievements) {
      html += `<div class="t-section-label">Achievements — ${data.achievements.unlocked}/${data.achievements.total}</div>`;
      const aPct = data.achievements.total > 0 ? (data.achievements.unlocked / data.achievements.total) * 100 : 0;
      html += `<div class="achievement-bar"><div class="ab-track"><div class="ab-fill" style="width:${aPct}%"></div></div><span class="ab-label">${Math.round(aPct)}%</span></div>`;
    }

    el.innerHTML = html;
  }

  // Tabs
  document.querySelectorAll('.t-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.t-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.t-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).style.display = '';
    });
  });

  async function load() {
    const data = await fetchData();
    document.getElementById('trackerLoading').style.display = 'none';

    if (!data.success || !data.player) {
      document.getElementById('trackerEmpty').style.display = '';
      document.getElementById('trackerContent').style.display = 'none';
      return;
    }

    document.getElementById('trackerEmpty').style.display = 'none';
    document.getElementById('trackerContent').style.display = '';

    if (data.slots) renderSlotBtns(data.slots);
    renderPlayerBar(data);
    renderRoster(data);
    renderInventory(data);
    renderExpress(data);
    renderStory(data);
  }

  load();
  pollInterval = setInterval(load, POLL_MS);
})();
