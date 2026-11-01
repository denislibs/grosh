// Вход через Google без ухода со страницы: кнопка Google в нашей шторке.
// По нажатию браузер показывает выбор аккаунта поверх приложения (FedCM в Chrome, окно в остальных).
const SRC = 'https://accounts.google.com/gsi/client';
let loading = null;

export const loadGoogle = () => (loading ||= new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  const s = document.createElement('script');
  s.src = SRC; s.async = true;
  s.onload = resolve;
  s.onerror = () => { loading = null; reject(new Error('network')); };
  document.head.append(s);
}));

const sha256 = async str => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * Рисует кнопку Google в `el`; onCredential(idToken, nonce) — когда аккаунт выбран.
 * Google получает хеш nonce, Supabase — исходную строку и сверяет их сам.
 */
export async function renderGoogleButton(el, { clientId, dark, onCredential }) {
  await loadGoogle();
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const hashed = await sha256(nonce);
  const id = window.google.accounts.id;
  id.initialize({
    client_id: clientId,
    nonce: hashed,
    context: 'signin',
    itp_support: true,
    use_fedcm_for_button: true,
    callback: r => onCredential(r.credential, nonce),
  });
  id.renderButton(el, {
    type: 'standard', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
    theme: dark ? 'filled_black' : 'outline', locale: 'ru', width: Math.min(400, Math.max(200, el.clientWidth || 320)),
  });
}
