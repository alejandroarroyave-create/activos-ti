const SUPABASE_URL = 'https://hsczygcbmtyzkzeksajm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzY3p5Z2NibXR5emt6ZWtzYWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk0NDksImV4cCI6MjA5MTI1NTQ0OX0.YetS-bD8wd_ZsLjeEhO_9ZsrlnxHd-MVPcC0iQS5EF0';
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
