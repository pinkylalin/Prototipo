(() => {
  const KEY = 'enlace-demo-v1';
  const SESSION = 'enlace-session-v1';
  const LABELS = { pending: 'Por confirmar', return: 'Regresa', stay: 'Permanece en B', returned: 'Ya regresó' };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function addDays(date, days) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  const people = r => [{ name: r.patientName, status: r.patientStatus, date: r.patientReturnDate }, ...(r.companionName ? [{ name: r.companionName, status: r.companionStatus, date: r.companionReturnDate }] : [])];
  function state(r, p, date) {
    if (r.departureDate > date) return 'future';
    if (p.status === 'stay' || p.status === 'returned') return p.status;
    return (p.date || r.appointmentDate) <= date ? p.status : 'future';
  }
  function calculate(records, date) {
    const result = { outbound: 0, confirmed: 0, pending: 0, staying: 0, overdue: 0 };
    for (const r of records) {
      if (r.departureDate === date) result.outbound += people(r).length;
      for (const p of people(r)) {
        const s = state(r, p, date);
        if (s === 'return') result.confirmed++;
        if (s === 'pending') result.pending++;
        if (s === 'stay') result.staying++;
        if (['return', 'pending'].includes(s) && (p.date || r.appointmentDate) < date) result.overdue++;
      }
    }
    result.outboundUnits = Math.ceil(result.outbound / 16);
    result.units = Math.max(result.outboundUnits, Math.ceil((result.confirmed + result.pending) / 16));
    result.extraUnits = result.units - result.outboundUnits;
    return result;
  }
  function seed(date = today()) {
    const names = ['Ana Martínez', 'José Ramírez', 'Elena Torres', 'Pedro Sánchez', 'Rosa Hernández', 'Luis García', 'Carmen López', 'Miguel Ortiz', 'Sofía Castro', 'Jorge Medina', 'Lucía Reyes', 'Raúl Navarro', 'Marta Flores', 'Daniel Ruiz', 'Isabel Cruz', 'Andrés Vega', 'Teresa Romero', 'Héctor Silva', 'Julia Moreno', 'Mario Ríos', 'Laura Campos', 'Roberto Soto'];
    const companions = ['Carlos Martínez', 'María Ramírez', 'Pablo Torres', 'Lidia Sánchez', 'Eva Hernández', 'Juan García', 'Alberto López', 'Sara Ortiz', 'Ramón Castro', 'Patricia Medina', 'Jaime Reyes', 'Clara Navarro', 'Óscar Flores', 'Olga Ruiz', 'Manuel Cruz', 'Beatriz Vega', 'Susana Romero', 'Tomás Silva', 'Antonio Moreno', 'Adriana Ríos', 'Raquel Campos', 'David Soto'];
    return names.map((name, i) => {
      const outbound = i < 8;
      const appointmentDate = outbound ? addDays(date, 1) : i < 16 ? date : addDays(date, -2);
      let patientStatus = outbound ? 'pending' : 'return', companionStatus = patientStatus;
      if (i === 18) companionStatus = 'stay';
      if (i === 19) { patientStatus = 'stay'; companionStatus = 'pending'; }
      if (i === 20) { patientStatus = 'pending'; companionStatus = 'pending'; }
      if (i === 21) { patientStatus = 'stay'; companionStatus = 'stay'; }
      return { id: 'demo-' + i, patientName: name, companionName: companions[i], travelParty: 'accompanied', travelPartyConfirmed: true, departureDate: addDays(appointmentDate, -1), appointmentDate, patientStatus, companionStatus, patientReturnDate: patientStatus === 'stay' ? null : outbound ? appointmentDate : date, companionReturnDate: companionStatus === 'stay' ? null : outbound ? appointmentDate : date, version: 1 };
    });
  }
  // El administrador registra la respuesta del paciente antes de la salida.
  function confirmTravelParty(record, choice, companionName = '') {
    if (!['solo', 'accompanied'].includes(choice)) throw new Error('Confirma si el paciente viajará solo o con acompañante.');
    const name = choice === 'accompanied' ? companionName.trim() : '';
    if (choice === 'accompanied' && !name) throw new Error('Escribe el nombre del acompañante confirmado por el paciente.');
    if (name.length > 100) throw new Error('El nombre del acompañante no puede superar 100 caracteres.');
    return {
      ...record, travelParty: choice, travelPartyConfirmed: true, companionName: name,
      companionStatus: name ? record.companionStatus || 'pending' : null,
      companionReturnDate: name ? record.companionName ? record.companionReturnDate : record.appointmentDate : null,
    };
  }
  function normalizeRecords(items) {
    return items.map(r => ({ ...r, travelParty: r.companionName ? 'accompanied' : 'solo', travelPartyConfirmed: r.travelPartyConfirmed ?? String(r.id).startsWith('demo-') }));
  }
  globalThis.TransportDemo = { calculate, seed, today, addDays, state, people, confirmTravelParty, normalizeRecords };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = date => date ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z')) : 'Sin fecha';
  let records, session = null, filter = 'all', page = 1, toastTimer, storageSnapshot = null, previousPlan = null;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    records = normalizeRecords(Array.isArray(saved) ? saved : seed());
    storageSnapshot = localStorage.getItem(KEY);
    const savedSession = JSON.parse(sessionStorage.getItem(SESSION));
    // Conserva el nombre de las sesiones anteriores al unificar los accesos.
    if (savedSession?.name) session = { role: 'admin', name: savedSession.name };
  } catch { records = normalizeRecords(seed()); storageAvailable = false; }
  $('plan-date').value = today();

  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3800); }
  function readStoredRecords() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === storageSnapshot) return false;
      const parsed = saved === null ? [] : JSON.parse(saved);
      if (!Array.isArray(parsed)) return false;
      records = normalizeRecords(parsed);
      storageSnapshot = saved;
      storageAvailable = true;
      return true;
    } catch { return false; }
  }
  function persist(next) {
    // Usa la última lista del navegador antes de agregar o actualizar registros.
    readStoredRecords();
    records = typeof next === 'function' ? next(records) : next;
    try {
      const saved = JSON.stringify(records);
      localStorage.setItem(KEY, saved);
      storageSnapshot = saved;
      storageAvailable = true;
    } catch { storageAvailable = false; toast('El navegador no permite guardar. Los cambios durarán solo esta sesión.'); }
    render();
  }
  // Guarda el ejemplo inicial y comparte los cambios entre pestañas locales.
  if (storageAvailable) { try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(records)); } catch { storageAvailable = false; } }
  function start() {
    const active = session?.role === 'admin';
    $('login').hidden = !!active; $('application').hidden = !active;
    if (!active) return;
    $('avatar').textContent = 'AB'; $('user-name').textContent = session.name;
    $('user-city').textContent = 'Administrador · Ciudades A y B';
    $('new-button').hidden = false;
    $('role-hint').textContent = 'Administra salidas, acompañamiento y regresos desde un mismo acceso.';
    render();
  }
  function matching() {
    const date = $('plan-date').value, query = $('search').value.toLocaleLowerCase('es').trim();
    return records.filter(r => {
      if (query && !`${r.patientName} ${r.companionName || ''}`.toLocaleLowerCase('es').includes(query)) return false;
      if (filter === 'all') return true;
      if (filter === 'outbound') return r.departureDate === date;
      return people(r).some(p => state(r, p, date) === filter);
    }).sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate) || a.patientName.localeCompare(b.patientName, 'es'));
  }
  const badge = (status, date) => status === 'pending'
    ? '<button type="button" class="status pending" data-press-only aria-label="Regreso por confirmar">◷ Por confirmar</button>'
    : `<span class="status ${escape(status)}">${status === 'return' ? '↙' : status === 'stay' ? '⌂' : '✓'} ${escape(LABELS[status])}</span>${status === 'return' || status === 'returned' ? `<small>${fmt(date)}</small>` : ''}`;
  function render() {
    if (!session) return;
    readStoredRecords();
    const date = $('plan-date').value;
    const plan = calculate(records, date);
    const stats = [
      ['Personas de ida', plan.outbound, 'Ciudad A → Ciudad B', '↗', ''],
      ['Regresos confirmados', plan.confirmed, 'Pacientes y acompañantes', '↙', ''],
      ['Por confirmar', plan.pending, 'Asientos reservados por precaución', '◷', 'amber'],
      ['Permanecen en B', plan.staying, 'Sin asiento de regreso por ahora', '⌂', 'blue'],
    ];
    $('stats').innerHTML = stats.map(([label, value, note, icon, cls]) => `<div class="stat ${cls}"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${note}</small></div>`).join('');
    $('recommendation').textContent = plan.units ? `Enviar ${plan.units} ${plan.units === 1 ? 'unidad' : 'unidades'}` : 'Sin unidades necesarias';
    $('recommendation-detail').textContent = `${plan.outbound} personas de ida · ${plan.confirmed + plan.pending} posibles de regreso${plan.pending ? ' (incluye pendientes)' : ''}.`;
    const busiestTrip = Math.max(plan.outbound, plan.confirmed + plan.pending);
    $('plan-capacity').textContent = `Trayecto con más pasajeros: ${busiestTrip} · Capacidad de ${plan.units} ${plan.units === 1 ? 'unidad' : 'unidades'}: ${plan.units * 16} asientos.`;
    if (previousPlan?.date !== date) {
      $('plan-change').hidden = true;
      $('plan-change').textContent = '';
    } else if (previousPlan.units !== plan.units) {
      $('plan-change').textContent = `${plan.units > previousPlan.units ? 'La demanda aumentó' : 'La demanda disminuyó'}: ahora se deben enviar ${plan.units} ${plan.units === 1 ? 'unidad' : 'unidades'} (antes: ${previousPlan.units}).`;
      $('plan-change').hidden = false;
    }
    previousPlan = { date, units: plan.units };
    $('outbound-units').textContent = plan.outboundUnits; $('extra-units').textContent = plan.extraUnits; $('total-units').textContent = plan.units;
    $('pending-alert').hidden = !plan.pending && !plan.overdue;
    $('pending-alert').textContent = `${plan.pending ? `◷ Hay ${plan.pending} personas por confirmar. La recomendación reserva un asiento para cada una.` : ''}${plan.overdue ? ` ${plan.overdue} regresos son de fechas anteriores y siguen pendientes de completar.` : ''}`;
    $('sync-label').textContent = storageAvailable ? 'Datos guardados en este navegador' : 'Cambios solo en memoria';
    $('record-count').textContent = records.length + ' pacientes';
    const filtered = matching(), pages = Math.max(1, Math.ceil(filtered.length / 8)); page = Math.min(page, pages);
    const shown = filtered.slice((page - 1) * 8, page * 8);
    $('patient-rows').innerHTML = shown.length ? shown.map(r => `<tr><td><div class="person-name"><span class="person-initial">${escape(r.patientName.split(' ').slice(0, 2).map(w => w[0]).join(''))}</span><div><strong>${escape(r.patientName)}</strong><small>${r.companionName ? '↳ ' + escape(r.companionName) : 'Sin acompañante'}</small><small>${r.travelPartyConfirmed ? '✓ ' + (r.companionName ? 'Acompañamiento confirmado' : 'Viaje solo confirmado') : 'Acompañamiento por confirmar'}</small></div></div></td><td>${fmt(r.departureDate)}<small>${r.departureDate === date ? 'Salida en esta fecha' : 'Ciudad A → B'}</small></td><td>${fmt(r.appointmentDate)}<small>${r.appointmentDate.slice(0, 4)}</small></td><td>${badge(r.patientStatus, r.patientReturnDate)}</td><td>${r.companionName ? badge(r.companionStatus, r.companionReturnDate) : '—'}</td><td><button class="row-button" data-edit="${escape(r.id)}">Actualizar →</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No hay registros para esta búsqueda o filtro.</td></tr>';
    $('table-summary').textContent = filtered.length ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, filtered.length)} de ${filtered.length} pacientes · incluye acompañantes` : '0 pacientes';
    $('page-label').textContent = `${page} / ${pages}`; $('prev-page').disabled = page === 1; $('next-page').disabled = page === pages;
    document.querySelector('[data-filter="outbound"]').textContent = 'Salidas de la fecha';
  }
  function openModal(title, content) { $('modal-title').textContent = title; $('modal-content').innerHTML = content; $('modal').showModal(); }
  function travelPartyFields(record = null) {
    const choice = record?.travelPartyConfirmed ? record.companionName ? 'accompanied' : 'solo' : '';
    return `<fieldset class="travel-party"><legend>Confirmación del paciente antes de partir</legend><p class="modal-text">El administrador registra lo que confirmó el paciente.</p><div class="travel-options"><label><input type="radio" name="travelParty" value="solo" required ${choice === 'solo' ? 'checked' : ''}> Viajará solo</label><label><input type="radio" name="travelParty" value="accompanied" required ${choice === 'accompanied' ? 'checked' : ''}> Llevará acompañante</label></div><div id="companion-name-field" ${choice !== 'accompanied' ? 'hidden' : ''}><label class="field-label" for="companion-name">Nombre del acompañante confirmado</label><input id="companion-name" name="companionName" maxlength="100" value="${escape(record?.companionName || '')}" placeholder="Nombre y apellido"></div></fieldset>`;
  }
  function bindTravelParty(form) {
    const update = () => {
      const accompanied = form.querySelector('[name="travelParty"]:checked')?.value === 'accompanied';
      $('companion-name-field').hidden = !accompanied;
      $('companion-name').required = accompanied;
      $('companion-name').disabled = !accompanied;
      const returnEditor = $('companion-return-editor');
      if (returnEditor) { returnEditor.hidden = !accompanied; returnEditor.disabled = !accompanied; }
    };
    form.querySelectorAll('[name="travelParty"]').forEach(input => input.addEventListener('change', update));
    update();
  }
  function newPatient() {
    const departure = $('plan-date').value < today() ? today() : $('plan-date').value;
    openModal('Registrar paciente', `<p class="modal-text">Confirma antes de la salida si el paciente viaja solo o acompañado. La cita debe ser posterior a la salida de ciudad A.</p><form id="new-form"><div class="form-grid"><div class="full"><label for="patient-name">Nombre del paciente</label><input id="patient-name" name="patientName" required maxlength="100" placeholder="Nombre y apellido"></div><div class="full">${travelPartyFields()}</div><div><label for="departure-date">Salida de ciudad A</label><input id="departure-date" name="departureDate" type="date" min="${today()}" required value="${departure}"></div><div><label for="appointment-date">Cita en ciudad B</label><input id="appointment-date" name="appointmentDate" type="date" required value="${addDays(departure, 1)}"></div></div><p id="form-error" class="form-error" role="alert"></p><div class="form-buttons"><button type="button" class="button" data-cancel>Cancelar</button><button class="button primary" type="submit">Guardar paciente</button></div></form>`);
    bindTravelParty($('new-form'));
    $('departure-date').addEventListener('change', () => { if ($('departure-date').value) $('appointment-date').value = addDays($('departure-date').value, 1); });
    $('new-form').addEventListener('submit', event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
      if (!data.patientName.trim()) { $('form-error').textContent = 'Escribe el nombre del paciente.'; return; }
      if (data.departureDate >= data.appointmentDate) { $('form-error').textContent = 'La salida debe ser al menos un día antes de la cita.'; return; }
      let record;
      try {
        record = confirmTravelParty({ id: 'record-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)), patientName: data.patientName.trim(), departureDate: data.departureDate, appointmentDate: data.appointmentDate, patientStatus: 'pending', patientReturnDate: data.appointmentDate, version: 1 }, data.travelParty, data.companionName);
      } catch (error) { $('form-error').textContent = error.message; return; }
      $('plan-date').value = data.departureDate;
      page = 1;
      persist(current => [...current, record]);
      $('modal').close(); toast(`Paciente registrado para el ${fmt(data.departureDate)}. La planeación de ese día ya se actualizó.`);
    });
  }
  function editPatient(id) {
    readStoredRecords();
    const r = records.find(record => record.id === id); if (!r) return;
    const beforeDeparture = r.departureDate >= today();
    const editor = (kind, title, name, status, date) => `<div class="person-editor"><label class="field-label">${title}</label><h3>${escape(name)}</h3><div class="form-grid"><div><label for="${kind}-status">Situación de regreso</label><select id="${kind}-status" name="${kind}Status">${Object.entries(LABELS).map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div id="${kind}-date-field"><label for="${kind}-date">Fecha de regreso</label><input id="${kind}-date" name="${kind}ReturnDate" type="date" min="${r.departureDate}" value="${date || $('plan-date').value}"></div></div></div>`;
    openModal('Administrar traslado', `<p class="modal-text">Actualiza por separado al paciente y al acompañante. Si alguien se queda en B, no ocupa asiento de regreso. Al terminar el viaje, marca “Ya regresó”.</p><form id="edit-form">${beforeDeparture ? travelPartyFields(r) : ''}${editor('patient', 'PACIENTE', r.patientName, r.patientStatus, r.patientReturnDate)}${r.companionName || beforeDeparture ? `<fieldset class="return-editor-group" id="companion-return-editor" aria-label="Regreso del acompañante">${editor('companion', 'ACOMPAÑANTE', r.companionName || 'Acompañante por registrar', r.companionStatus || 'pending', r.companionReturnDate || r.appointmentDate)}</fieldset>` : '<p class="modal-text">Este paciente viaja sin acompañante.</p>'}<p id="form-error" class="form-error" role="alert"></p><div class="form-buttons"><button type="button" class="button" data-cancel>Cancelar</button><button class="button primary" type="submit">Guardar cambios</button></div></form>`);
    if (beforeDeparture) bindTravelParty($('edit-form'));
    const version = r.version;
    for (const kind of ['patient', ...(r.companionName || beforeDeparture ? ['companion'] : [])]) {
      const toggle = () => { const staying = $(kind + '-status').value === 'stay'; $(kind + '-date-field').hidden = staying; $(kind + '-date').required = !staying; $(kind + '-date').disabled = staying; };
      $(kind + '-status').addEventListener('change', toggle); toggle();
    }
    $('edit-form').addEventListener('submit', event => {
      event.preventDefault();
      readStoredRecords();
      if (records.find(record => record.id === id)?.version !== version) { $('form-error').textContent = 'Este registro cambió en otra pestaña. Cierra y vuelve a abrirlo.'; return; }
      const data = Object.fromEntries(new FormData(event.target));
      let updated = r;
      try { if (beforeDeparture) updated = confirmTravelParty(r, data.travelParty, data.companionName); }
      catch (error) { $('form-error').textContent = error.message; return; }
      const hasCompanion = !!updated.companionName;
      persist(current => current.map(record => record.id !== id ? record : { ...updated, patientStatus: data.patientStatus, patientReturnDate: data.patientStatus === 'stay' ? null : data.patientReturnDate, companionStatus: hasCompanion ? data.companionStatus : null, companionReturnDate: !hasCompanion || data.companionStatus === 'stay' ? null : data.companionReturnDate, version: version + 1 }));
      $('modal').close(); toast('Regreso actualizado. El número de unidades se recalculó.');
    });
  }
  $('admin-login').addEventListener('click', () => {
    session = { role: 'admin', name: $('operator-name').value.trim() || 'Administrador de prueba' };
    try { sessionStorage.setItem(SESSION, JSON.stringify(session)); } catch { /* Demo works in memory too. */ }
    start();
  });
  $('logout').addEventListener('click', () => { session = null; try { sessionStorage.removeItem(SESSION); } catch {} start(); });
  $('new-button').addEventListener('click', newPatient);
  $('plan-date').addEventListener('change', () => { if (!$('plan-date').value) $('plan-date').value = today(); page = 1; render(); });
  $('previous-date').addEventListener('click', () => { $('plan-date').value = addDays($('plan-date').value, -1); page = 1; render(); });
  $('next-date').addEventListener('click', () => { $('plan-date').value = addDays($('plan-date').value, 1); page = 1; render(); });
  $('today-button').addEventListener('click', () => { $('plan-date').value = today(); page = 1; render(); });
  $('search').addEventListener('input', () => { page = 1; render(); });
  $('filters').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; filter = button.dataset.filter; page = 1; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b === button)); render(); });
  $('prev-page').addEventListener('click', () => { page--; render(); }); $('next-page').addEventListener('click', () => { page++; render(); });
  $('patient-rows').addEventListener('click', event => { const button = event.target.closest('[data-edit]'); if (button) editPatient(button.dataset.edit); });
  $('close-modal').addEventListener('click', () => $('modal').close());
  $('modal-content').addEventListener('click', event => { if (event.target.closest('[data-cancel]')) $('modal').close(); });
  $('modal').addEventListener('click', event => { if (event.target === $('modal')) { const rect = $('modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('modal').close(); } });
  document.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => { $(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' }); document.querySelectorAll('[data-scroll]').forEach(b => b.classList.toggle('active', b === button)); }));
  $('help-button').addEventListener('click', () => openModal('Cómo probar el ejemplo', `<ol class="help-list"><li>Un <strong>administrador</strong> gestiona las ciudades A y B desde el mismo acceso.</li><li>Al registrar un paciente, el administrador indica lo que confirmó antes de partir: <strong>viajará solo o llevará acompañante</strong>. Si va acompañado, registra su nombre. Cada persona ocupa un asiento.</li><li>Usa <strong>Actualizar</strong> para corregir el acompañamiento antes de la salida y gestionar por separado el regreso de cada persona.</li><li>Selecciona <strong>Permanece en B</strong> para quien se queda. Cuando pueda regresar, selecciona <strong>Regresa</strong> y la fecha correspondiente.</li><li>Después del traslado, selecciona <strong>Ya regresó</strong>. Los botones <strong>Por confirmar</strong> de la tabla tienen una animación al pulsarlos; los estados se modifican desde <strong>Actualizar</strong>.</li></ol><p class="modal-text"><strong>Fórmula:</strong> el mayor entre unidades de ida y unidades de regreso, redondeando hacia arriba cada 16 personas. Los pendientes reservan asiento.</p><p class="modal-text" style="margin-top:12px">El acceso de administrador es simulado. Los datos ficticios se guardan en este navegador y se comparten entre pestañas de la misma dirección; esta demo no sincroniza computadoras distintas.</p>`));
  $('reset-button').addEventListener('click', () => { if (!confirm('¿Restablecer los datos ficticios? Se borrarán los cambios de esta demo.')) return; filter = 'all'; page = 1; $('search').value = ''; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b.dataset.filter === 'all')); persist(seed($('plan-date').value)); toast('Ejemplo restablecido.'); });
  $('export-button').addEventListener('click', () => {
    const rows = [['Paciente', 'Acompañante', 'Confirmación antes de salir', 'Salida de A', 'Cita en B', 'Estado paciente', 'Regreso paciente', 'Estado acompañante', 'Regreso acompañante'], ...matching().map(r => [r.patientName, r.companionName, r.travelPartyConfirmed ? r.companionName ? 'Con acompañante' : 'Viaja solo' : 'Por confirmar', r.departureDate, r.appointmentDate, LABELS[r.patientStatus], r.patientReturnDate, LABELS[r.companionStatus] || '', r.companionReturnDate])];
    const cell = value => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `traslados-${$('plan-date').value}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-press-only]');
    if (!button) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Solo respuesta visual: pulsar el estado no modifica el registro.
    const frames = reducedMotion
      ? [{ backgroundColor: '#f7f7f7', opacity: 1 }, { backgroundColor: '#dddddd', opacity: .7, offset: .4 }, { backgroundColor: '#f7f7f7', opacity: 1 }]
      : [{ transform: 'scale(1)', backgroundColor: '#f7f7f7' }, { transform: 'scale(.9)', backgroundColor: '#dddddd', offset: .4 }, { transform: 'scale(1)', backgroundColor: '#f7f7f7' }];
    button.animate(frames, { duration: reducedMotion ? 160 : 240, easing: 'ease-out' });
  });
  function refreshFromBrowser() { if (readStoredRecords()) render(); }
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) refreshFromBrowser(); });
  window.addEventListener('focus', refreshFromBrowser);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromBrowser(); });
  // El evento storage no se dispara en la pestaña que hizo el cambio.
  // Esta comprobación también detecta cambios directos en los datos locales.
  setInterval(() => { if (!document.hidden) refreshFromBrowser(); }, 1000);
  start();
})();
