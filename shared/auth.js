// Shared between the NNL and NFS apps.
/* ============================= AUTH ============================= */
function showLoginScreen(){
  document.getElementById('boot-loading').style.display = 'none';
  document.getElementById('shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}
function showApp(){
  document.getElementById('boot-loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  document.getElementById('user-email').textContent = currentUser.email + (currentUserRole==='owner' ? ' · Owner' : ' · Sales Rep');
}
async function fetchCurrentUserRole(user){
  const { data, error } = await sbClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if(error){ console.error('Failed to fetch profile role', error); return 'sales_rep'; }
  return data ? data.role : 'sales_rep';
}

const loginSubmitBtn = document.getElementById('login-submit');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorBox = document.getElementById('login-error');
async function doLogin(){
  loginErrorBox.style.display = 'none';
  loginSubmitBtn.disabled = true; loginSubmitBtn.textContent = 'Signing in…';
  const { error } = await sbClient.auth.signInWithPassword({ email: loginEmailInput.value.trim(), password: loginPasswordInput.value });
  loginSubmitBtn.disabled = false; loginSubmitBtn.textContent = 'Sign In';
  if(error){ loginErrorBox.textContent = error.message; loginErrorBox.style.display = 'block'; }
}
loginSubmitBtn.onclick = doLogin;
loginPasswordInput.onkeydown = (e)=>{ if(e.key==='Enter') doLogin(); };
document.getElementById('signout-btn').onclick = ()=> sbClient.auth.signOut();

const newpwInput = document.getElementById('newpw-input');
const newpwConfirmInput = document.getElementById('newpw-confirm-input');
const newpwErrorBox = document.getElementById('newpw-error');
const newpwSuccessBox = document.getElementById('newpw-success');
const newpwSaveBtn = document.getElementById('newpw-save-btn');
function showChangePassword(){
  newpwInput.value = ''; newpwConfirmInput.value = '';
  newpwErrorBox.style.display = 'none'; newpwSuccessBox.style.display = 'none';
  document.getElementById('password-overlay').style.display = 'flex';
}
function hideChangePassword(){
  document.getElementById('password-overlay').style.display = 'none';
}
async function doChangePassword(){
  newpwErrorBox.style.display = 'none'; newpwSuccessBox.style.display = 'none';
  const pw = newpwInput.value, confirm = newpwConfirmInput.value;
  if(pw.length < 6){ newpwErrorBox.textContent = 'Password must be at least 6 characters.'; newpwErrorBox.style.display = 'block'; return; }
  if(pw !== confirm){ newpwErrorBox.textContent = 'Passwords do not match.'; newpwErrorBox.style.display = 'block'; return; }
  newpwSaveBtn.disabled = true; newpwSaveBtn.textContent = 'Saving…';
  const { error } = await sbClient.auth.updateUser({ password: pw });
  newpwSaveBtn.disabled = false; newpwSaveBtn.textContent = 'Save';
  if(error){ newpwErrorBox.textContent = error.message; newpwErrorBox.style.display = 'block'; return; }
  newpwInput.value = ''; newpwConfirmInput.value = '';
  newpwSuccessBox.textContent = 'Password updated.'; newpwSuccessBox.style.display = 'block';
}
document.getElementById('changepw-btn').onclick = showChangePassword;
document.getElementById('newpw-cancel-btn').onclick = hideChangePassword;
document.getElementById('newpw-save-btn').onclick = doChangePassword;
newpwConfirmInput.onkeydown = (e)=>{ if(e.key==='Enter') doChangePassword(); };

let appBooted = false;
let authResolved = false;
sbClient.auth.onAuthStateChange(async (event, session)=>{
  if(session){
    currentUser = session.user;
    currentUserRole = await fetchCurrentUserRole(session.user);
    // Each app can define window.onRoleResolved(role) to react to the role
    // before the shell renders — e.g. NFS redirects sales reps to their
    // allowed tab, NNL blocks them outright. Returning `false` stops here
    // (no showApp()/loadState()) — used by NNL to short-circuit before any
    // data load for a role that app has no UI for. No hook, or any other
    // return value, means proceed normally (the default/NFS case).
    const proceed = (typeof onRoleResolved==='function') ? (onRoleResolved(currentUserRole) !== false) : true;
    if(!proceed){ authResolved = true; return; }
    showApp();
    authResolved = true; // only once the boot screen is actually dismissed — an async step above (e.g. the profile-role fetch) can itself hang, and the watchdog needs to catch that too, not just a totally silent callback
    if(!appBooted){ appBooted = true; await loadState(); }
  } else {
    appBooted = false;
    currentUser = null; currentUserRole = null;
    showLoginScreen();
    authResolved = true;
  }
});
// Watchdog: Supabase's auth client can occasionally get stuck (a known
// intermittent issue with its internal session lock) and never fire the
// callback above, leaving the boot screen stuck on "Loading…" forever with
// no way out for someone who doesn't know to open DevTools and clear
// localStorage themselves. Surface a one-click recovery button instead.
setTimeout(()=>{
  if(!authResolved) document.getElementById('boot-stuck').style.display = 'block';
}, 8000);
document.getElementById('boot-reset-btn').onclick = ()=>{
  Object.keys(localStorage).filter(k=>k.startsWith('sb-')).forEach(k=>localStorage.removeItem(k));
  window.location.reload();
};
