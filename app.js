(() => {
  const ACCOUNTS_KEY = 'mes-soldes-v1';
  const REPORTS_KEY = 'mes-soldes-reports-v1';
  const REVENUES_KEY = 'mes-soldes-revenues-v1';
  const LAST_BACKUP_KEY = 'mes-soldes-last-backup-v1';
  const PERSON_KEY = 'mes-soldes-person-v1';

  let accounts = load(ACCOUNTS_KEY, []).map((a) => Object.assign({}, a, {
    owner: a.owner === 'wife' ? 'wife' : 'me'
  }));
  let reports = load(REPORTS_KEY, []);
  let revenues = load(REVENUES_KEY, []).map((r) => Object.assign({}, r, {
    owner: r.owner === 'wife' ? 'wife' : 'me'
  }));
  let currentView = 'home';
  let currentPerson = localStorage.getItem(PERSON_KEY) || 'me';
  if (!['me', 'wife', 'all'].includes(currentPerson)) currentPerson = 'me';

  const $ = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function persist() {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    localStorage.setItem(REVENUES_KEY, JSON.stringify(revenues));
    renderAll();
  }

  function money(value) {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function monthLabel(key) {
    if (!key) return '';
    const parts = key.split('-').map(Number);
    return new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' })
      .format(new Date(parts[0], parts[1] - 1, 1));
  }

  function currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function ownerOf(account) {
    return account && account.owner === 'wife' ? 'wife' : 'me';
  }

  function ownerLabel(owner) {
    return owner === 'wife' ? 'Ma femme' : 'Moi';
  }

  function filterByPerson(list, person) {
    const selected = person || currentPerson;
    if (selected === 'all') return list.slice();
    return list.filter((a) => ownerOf(a) === selected);
  }

  function totals(list) {
    const source = list || accounts;
    const bank = source
      .filter((a) => a.type === 'bank' || a.type === 'cash')
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const credit = source
      .filter((a) => a.type === 'credit')
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
    return { bank: bank, credit: credit, net: bank - credit };
  }

  function visibleTotals() {
    return totals(filterByPerson(accounts));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function uid() {
    return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function showToast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function go(view) {
    currentView = view;
    qsa('.view').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
    qsa('.nav-btn').forEach((el) => el.classList.toggle('active', el.dataset.viewTarget === view));
    const titles = { home: 'Accueil', accounts: 'Comptes', cards: 'Cartes', revenues: 'Revenus', reports: 'Rapports', backup: 'Sauvegarde' };
    $('pageTitle').textContent = titles[view] || 'Mes Soldes';
    $('quickAddBtn').style.display = ['home', 'accounts', 'cards'].includes(view) ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setPerson(person) {
    if (!['me', 'wife', 'all'].includes(person)) return;
    currentPerson = person;
    localStorage.setItem(PERSON_KEY, person);
    qsa('.person-btn').forEach((b) => b.classList.toggle('active', b.dataset.person === person));
    const labels = { me: 'Moi', wife: 'Ma femme', all: 'Ensemble' };
    if ($('profileLabel')) $('profileLabel').textContent = labels[person];
    if ($('revenueOwner') && person !== 'all') $('revenueOwner').value = person;
    renderAll();
  }

  function compactRow(account) {
    const meta = account.type === 'credit' ? 'Carte de crédit' : account.type === 'cash' ? 'Espèces' : 'Compte bancaire';
    const badge = currentPerson === 'all'
      ? '<span class="owner-badge">' + ownerLabel(ownerOf(account)) + '</span>'
      : '';
    return '<div class="compact-item">' +
      '<div class="item-left">' +
        '<div class="item-title">' + escapeHtml(account.name) + badge + '</div>' +
        '<div class="item-meta">' + meta + '</div>' +
      '</div>' +
      '<div class="item-amount ' + (account.type === 'credit' ? 'negative' : 'positive') + '">' + money(account.balance) + '</div>' +
    '</div>';
  }

  function accountRow(account) {
    const isCredit = account.type === 'credit';
    const limit = Number(account.limit || 0);
    const balance = Number(account.balance || 0);
    const available = Math.max(0, limit - balance);
    const pct = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;
    const badge = currentPerson === 'all'
      ? '<span class="owner-badge">' + ownerLabel(ownerOf(account)) + '</span>'
      : '';

    let meta = account.type === 'cash' ? 'Espèces' : 'Compte bancaire';
    let progress = '';
    if (isCredit) {
      meta = 'Dette ' + money(balance) + ' · Limite ' + money(limit) + ' · Disponible ' + money(available);
      if (limit > 0) {
        progress = '<div class="credit-progress"><span style="width:' + pct + '%"></span></div>';
      }
    }

    return '<article class="account-item">' +
      '<div class="account-main">' +
        '<div class="item-left">' +
          '<div class="item-title">' + escapeHtml(account.name) + badge + '</div>' +
          '<div class="item-meta">' + meta + '</div>' +
          progress +
        '</div>' +
        '<div class="item-amount ' + (isCredit ? 'negative' : 'positive') + '">' + money(balance) + '</div>' +
      '</div>' +
      '<div class="account-actions">' +
        '<button class="edit-btn" data-edit="' + account.id + '">Modifier</button>' +
        '<button class="delete-btn" data-delete="' + account.id + '">Supprimer</button>' +
      '</div>' +
    '</article>';
  }

  function reportAccounts(report) {
    return (report.accounts || []).map((a) => Object.assign({}, a, {
      owner: a.owner === 'wife' ? 'wife' : 'me'
    }));
  }

  function reportTotals(report, person) {
    return totals(filterByPerson(reportAccounts(report), person));
  }

  function latestReportDelta() {
    const sorted = reports.slice().sort((a, b) => a.month.localeCompare(b.month));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const lastTotals = reportTotals(last, currentPerson);
    const prevTotals = reportTotals(prev, currentPerson);
    return {
      delta: lastTotals.net - prevTotals.net,
      last: last,
      prev: prev
    };
  }

  function renderHome() {
    const t = visibleTotals();
    $('homeNet').textContent = money(t.net);
    $('homeBank').textContent = money(t.bank);
    $('homeCredit').textContent = money(t.credit);

    const d = latestReportDelta();
    if (!d) {
      $('homeDelta').textContent = 'Aucun compte rendu comparatif pour le moment';
    } else {
      const sign = d.delta > 0 ? '+' : '';
      $('homeDelta').textContent = monthLabel(d.last.month) + ' : ' + sign + money(d.delta) + ' par rapport au mois précédent';
    }

    const visible = filterByPerson(accounts);
    const bank = visible.filter((a) => a.type === 'bank' || a.type === 'cash').slice(0, 3);
    const credit = visible.filter((a) => a.type === 'credit').slice(0, 3);

    $('homeAccounts').innerHTML = bank.length ? bank.map(compactRow).join('') : '<div class="empty">Aucun compte enregistré.</div>';
    $('homeCards').innerHTML = credit.length ? credit.map(compactRow).join('') : '<div class="empty">Aucune carte enregistrée.</div>';
  }

  function renderAccounts() {
    const visible = filterByPerson(accounts);
    const bank = visible.filter((a) => a.type === 'bank' || a.type === 'cash');
    const credit = visible.filter((a) => a.type === 'credit');
    $('bankList').innerHTML = bank.length ? bank.map(accountRow).join('') : '<div class="empty">Aucun compte bancaire ou espèces.</div>';
    $('cardList').innerHTML = credit.length ? credit.map(accountRow).join('') : '<div class="empty">Aucune carte de crédit.</div>';
  }

  function snapshotFor(month) {
    const allTotals = totals(accounts);
    return {
      month: month,
      savedAt: new Date().toISOString(),
      bank: allTotals.bank,
      credit: allTotals.credit,
      net: allTotals.net,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        owner: ownerOf(a),
        balance: Number(a.balance || 0),
        limit: Number(a.limit || 0)
      }))
    };
  }

  function previousReport(month) {
    return reports
      .filter((r) => r.month < month)
      .sort((a, b) => b.month.localeCompare(a.month))[0] || null;
  }

  function lineDelta(current, previous) {
    if (!previous) return { text: 'Nouveau', cls: '' };
    const raw = Number(current.balance || 0) - Number(previous.balance || 0);
    if (raw === 0) return { text: '0,00 $', cls: '' };
    const good = current.type === 'credit' ? raw < 0 : raw > 0;
    return {
      text: (raw > 0 ? '+' : '') + money(raw),
      cls: good ? 'delta-good' : 'delta-bad'
    };
  }

  function reportCard(report) {
    const prev = previousReport(report.month);
    const currentAccounts = filterByPerson(reportAccounts(report));
    const currentTotals = totals(currentAccounts);
    const prevAccounts = prev ? filterByPerson(reportAccounts(prev)) : [];
    const prevTotals = prev ? totals(prevAccounts) : null;
    const netDelta = prevTotals ? currentTotals.net - prevTotals.net : null;

    const rows = currentAccounts.map((account) => {
      let old = null;
      if (prev) {
        old = prevAccounts.find((p) => p.id === account.id) ||
              prevAccounts.find((p) => p.name === account.name && p.type === account.type && ownerOf(p) === ownerOf(account));
      }
      const d = lineDelta(account, old);
      const label = account.type === 'credit' ? 'Carte' : account.type === 'cash' ? 'Espèces' : 'Compte';
      const badge = currentPerson === 'all'
        ? ' · ' + ownerLabel(ownerOf(account))
        : '';
      return '<div class="report-line">' +
        '<span><strong>' + escapeHtml(account.name) + '</strong> · ' + label + badge + '</span>' +
        '<span>' + money(account.balance) + '</span>' +
        '<small class="' + d.cls + '">Différence : ' + d.text + '</small>' +
      '</div>';
    }).join('');

    let deltaHtml = '<div class="delta-box">Premier compte rendu : aucune comparaison précédente.</div>';
    if (netDelta !== null) {
      const cls = netDelta > 0 ? 'delta-good' : netDelta < 0 ? 'delta-bad' : '';
      deltaHtml = '<div class="delta-box">Différence du solde net : <span class="' + cls + '">' +
        (netDelta > 0 ? '+' : '') + money(netDelta) + '</span></div>';
    }

    return '<article class="report-card">' +
      '<div class="report-top">' +
        '<div>' +
          '<div class="report-month">' + monthLabel(report.month) + '</div>' +
          '<div class="report-date">Enregistré le ' + new Date(report.savedAt || Date.now()).toLocaleDateString('fr-CA') + '</div>' +
        '</div>' +
        '<button class="report-delete" data-delete-report="' + report.month + '">Supprimer</button>' +
      '</div>' +
      '<div class="report-summary">' +
        '<div class="mini-stat"><span>Comptes</span><strong>' + money(currentTotals.bank) + '</strong></div>' +
        '<div class="mini-stat"><span>Dettes cartes</span><strong>' + money(currentTotals.credit) + '</strong></div>' +
        '<div class="mini-stat"><span>Solde net</span><strong>' + money(currentTotals.net) + '</strong></div>' +
      '</div>' +
      deltaHtml +
      '<details><summary>Voir les différences par compte</summary><div class="report-lines">' +
        (rows || '<div class="empty">Aucun compte dans ce rapport pour cette personne.</div>') +
      '</div></details>' +
    '</article>';
  }

  function renderReports() {
    const sorted = reports.slice().sort((a, b) => b.month.localeCompare(a.month));
    $('reportList').innerHTML = sorted.length
      ? sorted.map(reportCard).join('')
      : '<div class="section-card"><div class="empty">Aucun compte rendu mensuel enregistré.</div></div>';
  }


  function revenuesForMonth(month) {
    return revenues.filter((r) => String(r.date || '').slice(0, 7) === month);
  }

  function revenueTotals(month) {
    const monthItems = revenuesForMonth(month);
    const me = monthItems.filter((r) => r.owner !== 'wife').reduce((s, r) => s + Number(r.amount || 0), 0);
    const wife = monthItems.filter((r) => r.owner === 'wife').reduce((s, r) => s + Number(r.amount || 0), 0);
    return { me: me, wife: wife, all: me + wife };
  }

  function revenueRow(item) {
    const badge = currentPerson === 'all'
      ? '<span class="revenue-owner">' + ownerLabel(item.owner) + '</span>'
      : '';
    const dateText = item.date
      ? new Date(item.date + 'T12:00:00').toLocaleDateString('fr-CA')
      : '';
    return '<div class="revenue-item">' +
      '<div class="item-left">' +
        '<div class="item-title">' + escapeHtml(item.label) + badge + '</div>' +
        '<div class="item-meta">' + dateText + '</div>' +
        '<div class="revenue-actions"><button class="revenue-delete" data-delete-revenue="' + item.id + '">Supprimer</button></div>' +
      '</div>' +
      '<div class="item-amount positive">' + money(item.amount) + '</div>' +
    '</div>';
  }

  function renderRevenues() {
    if (!$('revenueMonth')) return;
    const month = $('revenueMonth').value || currentMonth();
    const totalsForMonth = revenueTotals(month);
    $('revenueMeTotal').textContent = money(totalsForMonth.me);
    $('revenueWifeTotal').textContent = money(totalsForMonth.wife);
    $('revenueAllTotal').textContent = money(totalsForMonth.all);

    let items = revenuesForMonth(month).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (currentPerson !== 'all') items = items.filter((r) => r.owner === currentPerson);

    const labels = { me: 'Moi', wife: 'Ma femme', all: 'Ensemble' };
    $('revenueListSubtitle').textContent = monthLabel(month) + ' · ' + labels[currentPerson];
    $('revenueList').innerHTML = items.length
      ? items.map(revenueRow).join('')
      : '<div class="empty">Aucun revenu enregistré pour ce mois.</div>';
  }

  function renderBackupStatus() {
    const last = localStorage.getItem(LAST_BACKUP_KEY);
    $('backupStatus').textContent = last
      ? 'Dernière sauvegarde créée : ' + new Date(last).toLocaleString('fr-CA')
      : 'Aucune sauvegarde enregistrée depuis cette version.';
  }

  function renderAll() {
    renderHome();
    renderAccounts();
    renderRevenues();
    renderReports();
    renderBackupStatus();
    qsa('.person-btn').forEach((b) => b.classList.toggle('active', b.dataset.person === currentPerson));
    const labels = { me: 'Moi', wife: 'Ma femme', all: 'Ensemble' };
    if ($('profileLabel')) $('profileLabel').textContent = labels[currentPerson];
  }

  function syncModalFields() {
    const isCredit = $('accountType').value === 'credit';
    $('limitRow').hidden = !isCredit;
    $('balanceLabel').textContent = isCredit ? 'Dette actuelle' : 'Solde actuel';
  }

  function openModal(mode, id) {
    const item = id ? accounts.find((a) => a.id === id) : null;
    $('editId').value = item ? item.id : '';
    $('accountName').value = item ? item.name : '';
    $('accountOwner').value = item ? ownerOf(item) : (currentPerson === 'wife' ? 'wife' : 'me');
    $('accountType').value = item ? item.type : (mode || 'bank');
    $('accountBalance').value = item ? item.balance : '';
    $('accountLimit').value = item ? (item.limit || '') : '';
    $('modalTitle').textContent = item ? 'Modifier' : ((mode || 'bank') === 'credit' ? 'Ajouter une carte' : 'Ajouter un compte');
    syncModalFields();
    $('accountModal').classList.add('open');
    $('accountModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('accountName').focus(), 100);
  }

  function closeModal() {
    $('accountModal').classList.remove('open');
    $('accountModal').setAttribute('aria-hidden', 'true');
    $('accountForm').reset();
    $('editId').value = '';
  }

  async function exportBackup() {
    const data = {
      app: 'Mes Soldes',
      version: 6,
      exportedAt: new Date().toISOString(),
      accounts: accounts,
      reports: reports,
      revenues: revenues
    };
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const file = new File([json], 'mes-soldes-sauvegarde-' + date + '.json', { type: 'application/json' });

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Sauvegarde Mes Soldes', files: [file] });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      renderBackupStatus();
      showToast('Sauvegarde créée');
    } catch (e) {
      if (!e || e.name !== 'AbortError') showToast('La sauvegarde a échoué');
    }
  }

  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.accounts) || !Array.isArray(data.reports)) throw new Error('invalid');
      const ok = confirm('Restaurer ' + data.accounts.length + ' compte(s) et ' + data.reports.length + ' rapport(s) ? Les données actuelles seront remplacées.');
      if (!ok) return;
      accounts = data.accounts.map((a) => Object.assign({}, a, {
        owner: a.owner === 'wife' ? 'wife' : 'me'
      }));
      reports = data.reports;
      revenues = Array.isArray(data.revenues) ? data.revenues.map((r) => Object.assign({}, r, {
        owner: r.owner === 'wife' ? 'wife' : 'me'
      })) : [];
      persist();
      showToast('Sauvegarde restaurée');
    } catch (_) {
      alert('Fichier de sauvegarde invalide.');
    }
  }

  $('accountForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const id = $('editId').value;
    const type = $('accountType').value;
    const item = {
      id: id || uid(),
      name: $('accountName').value.trim(),
      owner: $('accountOwner').value === 'wife' ? 'wife' : 'me',
      type: type,
      balance: Number($('accountBalance').value || 0),
      limit: type === 'credit' ? Number($('accountLimit').value || 0) : 0
    };
    if (!item.name) return;

    if (id) {
      const index = accounts.findIndex((a) => a.id === id);
      if (index >= 0) accounts[index] = item;
    } else {
      accounts.push(item);
    }

    persist();
    closeModal();
    showToast(id ? 'Compte modifié' : 'Compte ajouté');
  });


  $('revenueForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const owner = $('revenueOwner').value === 'wife' ? 'wife' : 'me';
    const date = $('revenueDate').value;
    const label = $('revenueLabel').value.trim();
    const amount = Number($('revenueAmount').value || 0);

    if (!date || !label || amount <= 0) {
      alert('Entre une date, une description et un montant supérieur à 0.');
      return;
    }

    revenues.push({
      id: 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      owner: owner,
      date: date,
      label: label,
      amount: amount,
      createdAt: new Date().toISOString()
    });

    $('revenueMonth').value = date.slice(0, 7);
    $('revenueLabel').value = '';
    $('revenueAmount').value = '';
    persist();
    showToast('Revenu ajouté');
  });

  document.addEventListener('click', (event) => {
    const person = event.target.closest('[data-person]');
    if (person) {
      setPerson(person.dataset.person);
      return;
    }

    const nav = event.target.closest('[data-view-target]');
    if (nav) {
      go(nav.dataset.viewTarget);
      return;
    }

    const goButton = event.target.closest('[data-go]');
    if (goButton) {
      go(goButton.dataset.go);
      return;
    }

    const edit = event.target.closest('[data-edit]');
    if (edit) {
      openModal('bank', edit.dataset.edit);
      return;
    }

    const del = event.target.closest('[data-delete]');
    if (del) {
      const item = accounts.find((a) => a.id === del.dataset.delete);
      if (item && confirm('Supprimer ' + item.name + ' ?')) {
        accounts = accounts.filter((a) => a.id !== item.id);
        persist();
      }
      return;
    }

    const delRevenue = event.target.closest('[data-delete-revenue]');
    if (delRevenue) {
      const item = revenues.find((r) => r.id === delRevenue.dataset.deleteRevenue);
      if (item && confirm('Supprimer ce revenu de ' + money(item.amount) + ' ?')) {
        revenues = revenues.filter((r) => r.id !== item.id);
        persist();
      }
      return;
    }

    const delReport = event.target.closest('[data-delete-report]');
    if (delReport) {
      const month = delReport.dataset.deleteReport;
      if (confirm('Supprimer le compte rendu de ' + monthLabel(month) + ' ?')) {
        reports = reports.filter((r) => r.month !== month);
        persist();
      }
      return;
    }

    if (event.target.closest('[data-close-modal]')) closeModal();
  });

  $('personMeBtn').addEventListener('click', () => setPerson('me'));
  $('personWifeBtn').addEventListener('click', () => setPerson('wife'));
  $('personAllBtn').addEventListener('click', () => setPerson('all'));

  $('accountType').addEventListener('change', syncModalFields);
  $('addBankBtn').addEventListener('click', () => openModal('bank'));
  $('addCardBtn').addEventListener('click', () => openModal('credit'));
  $('quickAddBtn').addEventListener('click', () => openModal(currentView === 'cards' ? 'credit' : 'bank'));

  $('saveReportBtn').addEventListener('click', () => {
    if (!accounts.length) {
      alert('Ajoute au moins un compte avant de créer un compte rendu.');
      return;
    }

    const month = $('reportMonth').value || currentMonth();
    const exists = reports.some((r) => r.month === month);
    if (exists && !confirm('Un compte rendu existe déjà pour ' + monthLabel(month) + '. Le remplacer ?')) return;

    const report = snapshotFor(month);
    reports = reports.filter((r) => r.month !== month);
    reports.push(report);
    persist();
    showToast('Compte rendu enregistré');
  });

  $('exportBtn').addEventListener('click', exportBackup);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', () => {
    const file = $('importFile').files && $('importFile').files[0];
    if (file) importBackup(file);
    $('importFile').value = '';
  });

  $('reportMonth').value = currentMonth();
  $('revenueMonth').value = currentMonth();
  $('revenueMonth').addEventListener('change', renderRevenues);
  $('revenueDate').value = new Date().toISOString().slice(0, 10);
  if (currentPerson !== 'all') $('revenueOwner').value = currentPerson;

  if ('serviceWorker' in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
        const update = () => registration.update().catch(() => {});
        await update();
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') update();
        });
      } catch (_) {}
    });
  }

  renderAll();
  go('home');
})();