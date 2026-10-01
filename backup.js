(function () {
  const STORAGE_KEY = 'mes-soldes-v1';
  const REPORTS_KEY = 'mes-soldes-reports-v1';
  const LAST_BACKUP_KEY = 'mes-soldes-last-backup-v1';

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function backupFileName() {
    const d = new Date();
    const date = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return 'mes-soldes-sauvegarde-' + date + '.json';
  }

  function buildBackup() {
    return {
      app: 'Mes Soldes',
      version: 3,
      exportedAt: new Date().toISOString(),
      accounts: readJson(STORAGE_KEY, []),
      reports: readJson(REPORTS_KEY, [])
    };
  }

  function updateStatus(el) {
    const last = localStorage.getItem(LAST_BACKUP_KEY);
    if (!last) {
      el.textContent = 'Aucune sauvegarde créée depuis cette version de l’application.';
      return;
    }
    el.textContent = 'Dernière sauvegarde créée : ' + new Date(last).toLocaleString('fr-CA');
  }

  async function exportBackup(statusEl) {
    const json = JSON.stringify(buildBackup(), null, 2);
    const fileName = backupFileName();
    const file = new File([json], fileName, { type: 'application/json' });

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Sauvegarde Mes Soldes',
          text: 'Enregistre ce fichier dans Fichiers ou iCloud Drive.',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      updateStatus(statusEl);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      alert('La sauvegarde n’a pas pu être créée. Réessaie dans Safari.');
    }
  }

  async function restoreBackup(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.reports)) {
        throw new Error('invalid');
      }

      const ok = confirm(
        'Restaurer ' + data.accounts.length + ' compte(s) et ' +
        data.reports.length + ' compte(s) rendu(s) ?\n\n' +
        'Cela remplacera les données actuellement enregistrées sur cet iPhone.'
      );
      if (!ok) return;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.accounts));
      localStorage.setItem(REPORTS_KEY, JSON.stringify(data.reports));
      alert('Sauvegarde restaurée avec succès.');
      location.reload();
    } catch (_) {
      alert('Ce fichier de sauvegarde est invalide ou endommagé.');
    }
  }

  function initBackupPanel() {
    const app = document.querySelector('main.app');
    if (!app || document.getElementById('backupPanel')) return;

    const style = document.createElement('style');
    style.textContent =
      '.backup-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}' +
      '.backup-grid button{width:100%}' +
      '.backup-status{margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:14px;background:#f8fafc;color:var(--muted);font-size:12px;line-height:1.45}' +
      '.backup-warning{margin-top:10px;padding:10px 12px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;line-height:1.45}' +
      '@media(max-width:520px){.backup-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'backupPanel';
    panel.innerHTML =
      '<h2>Sauvegarde et restauration</h2>' +
      '<div class="note" style="margin-top:0">La sauvegarde contient tes comptes, cartes et tous tes comptes rendus mensuels. Enregistre le fichier dans <strong>Fichiers</strong> ou <strong>iCloud Drive</strong>.</div>' +
      '<div class="backup-grid">' +
        '<button type="button" class="btn-primary" id="backupDataBtn">Sauvegarder mes données</button>' +
        '<button type="button" class="btn-secondary" id="restoreDataBtn">Restaurer une sauvegarde</button>' +
      '</div>' +
      '<input id="restoreDataFile" type="file" accept="application/json,.json" style="display:none">' +
      '<div class="backup-status" id="backupDataStatus"></div>' +
      '<div class="backup-warning"><strong>Important :</strong> vider les données de Safari peut effacer les données locales. Garde toujours une copie récente de ta sauvegarde.</div>';

    app.appendChild(panel);

    const backupBtn = document.getElementById('backupDataBtn');
    const restoreBtn = document.getElementById('restoreDataBtn');
    const fileInput = document.getElementById('restoreDataFile');
    const status = document.getElementById('backupDataStatus');

    updateStatus(status);
    backupBtn.addEventListener('click', function () { exportBackup(status); });
    restoreBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      if (file) restoreBackup(file);
      fileInput.value = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackupPanel);
  } else {
    initBackupPanel();
  }
})();