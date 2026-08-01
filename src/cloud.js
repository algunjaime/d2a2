import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  signup,
  updateUser,
} from '@netlify/identity';

const app = window.D2A2App;
const body = document.body;
const authMessage = document.getElementById('authMessage');
const authStandard = document.getElementById('authStandard');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const passwordForm = document.getElementById('passwordForm');
const migrationModal = document.getElementById('migrationModal');
const migrationText = document.getElementById('migrationText');

let currentUser = null;
let passwordFlow = null;
let saveChain = Promise.resolve();
const saveTimers = new Map();
const latestSessions = new Map();

window.D2A2Cloud = {
  active: false,
  saveSession(session) {
    if (!this.active || !session?.id) return;
    latestSessions.set(session.id, session);
    clearTimeout(saveTimers.get(session.id));
    saveTimers.set(session.id, setTimeout(() => flushSession(session.id), 750));
    setSyncState('Cambios pendientes');
  },
  deleteSession(id) {
    if (!this.active || !id) return;
    clearTimeout(saveTimers.get(id));
    saveTimers.delete(id);
    latestSessions.delete(id);
    saveChain = saveChain.then(() => api('/api/sessions', { method: 'DELETE', body: { id } }))
      .then(() => setSyncState('Sincronizado'))
      .catch(error => setSyncState(readableError(error), true));
  },
};

function setAuthMessage(message = '', type = '') {
  authMessage.textContent = message;
  authMessage.className = `auth-message${type ? ` ${type}` : ''}`;
}

function readableError(error) {
  const message = String(error?.message || error || 'No fue posible completar la operación.');
  if (/invalid login|credentials|invalid_grant/i.test(message)) return 'El correo o la contraseña no son correctos.';
  if (/already registered|already exists/i.test(message)) return 'Ya existe una cuenta con este correo.';
  if (/signup.*disabled|invite/i.test(message)) return 'El registro está limitado a personas invitadas.';
  if (/network|fetch|offline/i.test(message)) return 'Sin conexión. Los cambios continúan guardados en este dispositivo.';
  if (/identity.*configured|missing identity/i.test(message)) return 'Activa Identity en la configuración del proyecto de Netlify.';
  return message;
}

function setAuthBusy(form, busy) {
  [...form.elements].forEach(element => { element.disabled = busy; });
}

function selectAuthTab(name) {
  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    const selected = button.dataset.authTab === name;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  loginForm.classList.toggle('hidden', name !== 'login');
  signupForm.classList.toggle('hidden', name !== 'signup');
  setAuthMessage();
  (name === 'login' ? document.getElementById('loginEmail') : document.getElementById('signupName'))?.focus();
}

document.querySelectorAll('[data-auth-tab]').forEach(button => {
  button.addEventListener('click', () => selectAuthTab(button.dataset.authTab));
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  setAuthBusy(loginForm, true);
  setAuthMessage('Verificando…');
  try {
    const user = await login(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
    await enterAccount(user);
  } catch (error) {
    setAuthMessage(readableError(error), 'error');
  } finally {
    setAuthBusy(loginForm, false);
  }
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  const password = document.getElementById('signupPassword').value;
  if (password.length < 10) {
    setAuthMessage('La contraseña debe tener al menos 10 caracteres.', 'error');
    return;
  }
  setAuthBusy(signupForm, true);
  setAuthMessage('Creando la cuenta…');
  try {
    const user = await signup(
      document.getElementById('signupEmail').value.trim(),
      password,
      { full_name: document.getElementById('signupName').value.trim() },
    );
    if (user?.confirmedAt) await enterAccount(user);
    else setAuthMessage('Cuenta creada. Revisa tu correo para confirmar el registro.', 'success');
  } catch (error) {
    setAuthMessage(readableError(error), 'error');
  } finally {
    setAuthBusy(signupForm, false);
  }
});

document.querySelector('[data-auth-action="forgot"]').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    setAuthMessage('Escribe tu correo para enviarte el enlace de recuperación.', 'error');
    document.getElementById('loginEmail').focus();
    return;
  }
  try {
    await requestPasswordRecovery(email);
    setAuthMessage('Te enviamos un enlace para cambiar tu contraseña.', 'success');
  } catch (error) {
    setAuthMessage(readableError(error), 'error');
  }
});

passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const password = document.getElementById('newPassword').value;
  if (password.length < 10) {
    setAuthMessage('La contraseña debe tener al menos 10 caracteres.', 'error');
    return;
  }
  setAuthBusy(passwordForm, true);
  try {
    const user = passwordFlow?.type === 'invite'
      ? await acceptInvite(passwordFlow.token, password)
      : await updateUser({ password });
    passwordFlow = null;
    await enterAccount(user);
  } catch (error) {
    setAuthMessage(readableError(error), 'error');
  } finally {
    setAuthBusy(passwordForm, false);
  }
});

function showPasswordFlow(result) {
  passwordFlow = result;
  authStandard.classList.add('hidden');
  passwordForm.classList.remove('hidden');
  document.getElementById('authTitle').textContent = result.type === 'invite' ? 'Crea tu contraseña' : 'Cambia tu contraseña';
  setAuthMessage(result.type === 'invite' ? 'Completa la invitación para entrar a D’2A2.' : 'Elige una nueva contraseña para tu cuenta.');
  document.getElementById('newPassword').focus();
}

async function api(url, { method = 'GET', body: payload } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Solicitud rechazada (${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function setSyncState(text, error = false) {
  document.querySelectorAll('[data-sync-state]').forEach(element => {
    element.textContent = text;
    element.classList.toggle('error', error);
  });
}

function renderAccount() {
  const slot = document.getElementById('accountSlot');
  if (!slot) return;
  slot.replaceChildren();
  const email = document.createElement('span');
  email.className = 'account-email';
  email.textContent = currentUser?.email || 'Modo local';
  const status = document.createElement('span');
  status.className = 'sync-state';
  status.dataset.syncState = '';
  status.textContent = window.D2A2Cloud.active ? 'Sincronizado' : 'Solo en este dispositivo';
  const identity = document.createElement('span');
  identity.className = 'account-identity';
  identity.append(email, status);
  slot.append(identity);
  if (currentUser) {
    const details = document.createElement('details');
    details.className = 'account-menu session-menu';
    const summary = document.createElement('summary');
    summary.className = 'btn btn-ghost btn-small';
    summary.textContent = 'Cuenta';
    const menu = document.createElement('div');
    menu.className = 'session-menu-pop';
    const deleteData = document.createElement('button');
    deleteData.className = 'btn btn-danger btn-small';
    deleteData.type = 'button';
    deleteData.textContent = 'Eliminar mis sesiones';
    deleteData.addEventListener('click', deletePrivateData);
    menu.append(deleteData);
    details.append(summary, menu);
    slot.append(details);
    const button = document.createElement('button');
    button.className = 'btn btn-ghost btn-small';
    button.type = 'button';
    button.textContent = 'Salir';
    button.addEventListener('click', signOut);
    slot.append(button);
  }
}

async function deletePrivateData() {
  const confirmation = prompt('Esta acción eliminará permanentemente todas tus sesiones guardadas en la nube. Escribe ELIMINAR para confirmar.');
  if (confirmation !== 'ELIMINAR') return;
  try {
    await api('/api/account-data', { method: 'DELETE', body: { confirmation } });
    localStorage.removeItem(`d2a2_pending_import_${currentUser.id}`);
    app.clearLocalSessions();
    app.toast('Tus sesiones fueron eliminadas. La cuenta permanece activa.');
  } catch (error) {
    app.toast(readableError(error));
  }
}

window.addEventListener('d2a2-render', renderAccount);

async function flushSession(id) {
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);
  saveChain = saveChain.then(async () => {
    const session = app.getSession(id) || latestSessions.get(id);
    if (!session || !window.D2A2Cloud.active) return;
    setSyncState('Sincronizando…');
    try {
      const result = await api('/api/sessions', {
        method: 'POST',
        body: { session, expectedVersion: Number(session.syncVersion) || 0 },
      });
      app.updateSyncVersion(id, result.version);
      latestSessions.delete(id);
      setSyncState('Sincronizado');
    } catch (error) {
      if (error.status === 409) setSyncState('Cambios detectados en otro dispositivo. Recarga antes de continuar.', true);
      else setSyncState(readableError(error), true);
      throw error;
    }
  }).catch(() => {});
  return saveChain;
}

async function flushAll() {
  const ids = [...new Set([...saveTimers.keys(), ...latestSessions.keys()])];
  for (const id of ids) await flushSession(id);
  await saveChain;
}

function askMigration(count) {
  migrationText.textContent = `Encontramos ${count} sesión${count === 1 ? '' : 'es'} creada${count === 1 ? '' : 's'} o modificada${count === 1 ? '' : 's'} en este dispositivo. Puedes llevarla${count === 1 ? '' : 's'} a tu cuenta privada.`;
  migrationModal.classList.add('show');
  return new Promise(resolve => {
    const handler = event => {
      const button = event.target.closest('[data-migration-action]');
      if (!button) return;
      migrationModal.removeEventListener('click', handler);
      migrationModal.classList.remove('show');
      resolve(button.dataset.migrationAction === 'import');
    };
    migrationModal.addEventListener('click', handler);
  });
}

async function loadPrivateSessions(user) {
  setSyncState('Cargando sesiones…');
  const result = await api('/api/sessions');
  const cloudSessions = Array.isArray(result.sessions) ? result.sessions : [];
  const pendingKey = `d2a2_pending_import_${user.id}`;
  let deferred = [];
  try { deferred = JSON.parse(localStorage.getItem(pendingKey) || '[]'); } catch { deferred = []; }
  const localSessions = [...app.getSessions(), ...(Array.isArray(deferred) ? deferred : [])];
  const cloudById = new Map(cloudSessions.map(session => [session.id, session]));
  const candidates = [...new Map(localSessions.map(session => [session.id, session])).values()].filter(local => {
    const remote = cloudById.get(local.id);
    if (!remote) return true;
    return Number(local.syncVersion) === Number(remote.syncVersion) && new Date(local.updatedAt) > new Date(remote.updatedAt);
  });
  let merged = cloudSessions;
  if (candidates.length) {
    if (await askMigration(candidates.length)) {
      merged = [...cloudSessions.filter(remote => !candidates.some(local => local.id === remote.id)), ...candidates];
      app.replaceSessions(merged);
      for (const item of candidates) {
        latestSessions.set(item.id, item);
        await flushSession(item.id);
      }
      localStorage.removeItem(pendingKey);
      merged = app.getSessions();
      app.toast('Sesiones importadas a tu cuenta privada.');
    } else {
      localStorage.setItem(pendingKey, JSON.stringify(candidates));
    }
  }
  app.replaceSessions(merged);
  setSyncState('Sincronizado');
}

async function enterAccount(user) {
  currentUser = user;
  window.D2A2Cloud.active = true;
  body.classList.remove('auth-pending', 'auth-locked');
  body.classList.add('authenticated');
  setAuthMessage();
  renderAccount();
  try {
    await loadPrivateSessions(user);
  } catch (error) {
    setSyncState(readableError(error), true);
    app.toast('No se pudo cargar la nube. Tus cambios locales siguen protegidos por el acceso a tu cuenta.');
  }
}

async function signOut() {
  setSyncState('Cerrando sesión…');
  await flushAll();
  try { await logout(); } catch {}
  window.D2A2Cloud.active = false;
  currentUser = null;
  app.clearLocalSessions();
  body.classList.remove('authenticated', 'auth-pending');
  body.classList.add('auth-locked');
  authStandard.classList.remove('hidden');
  passwordForm.classList.add('hidden');
  document.getElementById('authTitle').textContent = 'Tus sesiones, solo para ti';
  loginForm.reset();
  setAuthMessage('Sesión cerrada correctamente.', 'success');
  renderAccount();
}

window.addEventListener('online', () => {
  if (window.D2A2Cloud.active) flushAll();
});

async function bootstrap() {
  try {
    const callback = await handleAuthCallback();
    if (callback?.type === 'invite' && callback.token) {
      body.classList.replace('auth-pending', 'auth-locked');
      showPasswordFlow(callback);
      return;
    }
    if (callback?.type === 'recovery') {
      body.classList.replace('auth-pending', 'auth-locked');
      showPasswordFlow(callback);
      return;
    }
    const user = callback?.user || await getUser();
    if (user) await enterAccount(user);
    else body.classList.replace('auth-pending', 'auth-locked');
  } catch (error) {
    body.classList.replace('auth-pending', 'auth-locked');
    setAuthMessage(readableError(error), 'error');
  }
}

bootstrap();
