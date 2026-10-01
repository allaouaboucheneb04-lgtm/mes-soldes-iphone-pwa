(() => {
  const ACCOUNTS_KEY = 'mes-soldes-v1';
  const REPORTS_KEY = 'mes-soldes-reports-v1';
  const LAST_BACKUP_KEY = 'mes-soldes-last-backup-v1';

  let accounts = load(ACCOUNTS_KEY, []);
  let reports = load(REPORTS_KEY, []);
  let currentView = 'home';

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
    const titles = { home: 'Accueil', accounts: 'Comptes', cards: 'Cartes', reports: 'Rapports', backup: 'Sauvegarde' };
    $('pageTitle').textContent = titles[view] || 'Mes Soldes';
    $('quickAddBtn').style.display = ['home', 'accounts', 'cards'].includes(view) ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function compactRow(account) {
    const meta = account.type === 'credit' ? 'Carte de crédit' : account.type === 'cash' ? 'Espèces' : 'Compte bancaire';
    return '<div class="compact-item">' +
      '<div class="item-left">' +
        '<div class="item-title">' + escapeHtml(account.name) + '</div>' +
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
          '<div class="item-title">' + escapeHtml(account.name) + '</div>' +
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

  function latestReportDelta() {
    const sorted = reports.slice().sort((a, b) => a.month.localeCompare(b.month));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    return {
      delta: Number(last.net || 0) - Number(prev.net || 0),
      last: last,
      prev: prev
    };
  }

  function renderHome() {
    const t = totals();
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

    const bank = accounts.filter((a) => a.type === 'bank' || a.type === 'cash').slice(0, 3);
    const credit = accounts.filter((a) => a.type === 'credit').slice(0, 3);

    $('homeAccounts').innerHTML = bank.length ? bank.map(compactRow).join('') : '<div class="empty">Aucun compte enregistré.</div>';
    $('homeCards').innerHTML = credit.length ? credit.map(compactRow).join('') : '<div class="empty">Aucune carte enregistrée.</div>';
  }

  function renderAccounts() {
    const bank = accounts.filter((a) => a.type === 'bank' || a.type === 'cash');
    const credit = accounts.filter((a) => a.type === 'credit');
    $('bankList').innerHTML = bank.length ? bank.map(accountRow).join('') : '<div class="empty">Aucun compte bancaire ou espèces.</div>';
    $('cardList').innerHTML = credit.length ? credit.map(accountRow).join('') : '<div class="empty">Aucune carte de crédit.</div>';
  }

  function snapshotFor(month) {
    const t = totals();
    return {
      month: month,
      savedAt: new Date().toISOString(),
      bank: t.bank,
      credit: t.credit,
      net: t.net,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
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
    const netDelta = prev ? Number(report.net || 0) - Number(prev.net || 0) : null;

    const rows = (report.accounts || []).map((account) => {
      let old = null;
      if (prev && Array.isArray(prev.accounts)) {
        old = prev.accounts.find((p) => p.id === account.id) ||
              prev.accounts.find((p) => p.name === account.name && p.type === account.type);
      }
      const d = lineDelta(account, old);
      const label = account.type === 'credit' ? 'Carte' : account.type === 'cash' ? 'Espèces' : 'Compte';
      return '<div class="report-line">' +
        '<span><strong>' + escapeHtml(account.name) + '</strong> · ' + label + '</span>' +
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
        '<div class="mini-stat"><span>Comptes</span><strong>' + money(report.bank) + '</strong></div>' +
        '<div class="mini-stat"><span>Dettes cartes</span><strong>' + money(report.credit) + '</strong></div>' +
        '<div class="mini-stat"><span>Solde net</span><strong>' + money(report.net) + '</strong></div>' +
      '</div>' +
      deltaHtml +
      '<details><summary>Voir les différences par compte</summary><div class="report-lines">' +
        (rows || '<div class="empty">Aucun compte dans ce rapport.</div>') +
      '</div></details>' +
    '</article>';
  }

  function renderReports() {
    const sorted = reports.slice().sort((a, b) => b.month.localeCompare(a.month));
    $('reportList').innerHTML = sorted.length
      ? sorted.map(reportCard).join('')
      : '<div class="section-card"><div class="empty">Aucun compte rendu mensuel enregistré.</div></div>';
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
    renderReports();
    renderBackupStatus();
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
      version: 4,
      exportedAt: new Date().toISOString(),
      accounts: accounts,
      reports: reports
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
      accounts = data.accounts;
      reports = data.reports;
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

  document.addEventListener('click', (event) => {
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