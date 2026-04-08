const SUPABASE_URL = 'https://hsczygcbmtyzkzeksajm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vasykiHn5SkF8J1aXN5nGQ_szCzdf-V';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Proteger las páginas que no sean de login
window.addEventListener('DOMContentLoaded', async () => {
    const isLoginPage = window.location.pathname.includes('login.html');
    
    // Obtener sesión actual
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && !isLoginPage) {
        // Redirigir al login si no estamos autorizados
        window.location.href = 'login.html';
        return;
    }

    if (session && !isLoginPage) {
        // Chequear nivel del factor de autenticación (Para forzar el 2FA)
        const { data: { authenticatorAssuranceLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (authenticatorAssuranceLevel.currentLevel !== 'aal2' && authenticatorAssuranceLevel.nextLevel === 'aal2') {
            // El usuario configuró 2FA pero no lo ha pasado en esta sesión
            window.location.href = 'login.html';
        }
        
        // Poner el correo
        const userEmailElem = document.getElementById('userEmailDisplay');
        if (userEmailElem) userEmailElem.textContent = session.user.email;
    }
});

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}
