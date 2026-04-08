const SUPABASE_URL = 'https://hsczygcbmtyzkzeksajm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzY3p5Z2NibXR5emt6ZWtzYWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk0NDksImV4cCI6MjA5MTI1NTQ0OX0.YetS-bD8wd_ZsLjeEhO_9ZsrlnxHd-MVPcC0iQS5EF0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Proteger las páginas que no sean de login
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const isLoginPage = window.location.pathname.includes('login.html');
        
        // Obtener sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!session && !isLoginPage) {
            // Redirigir al login si no estamos autorizados
            window.location.href = 'login.html';
            return;
        }

        if (session && !isLoginPage) {
            // Poner el correo INMEDIATAMENTE
            const userEmailElem = document.getElementById('userEmailDisplay');
            if (userEmailElem) userEmailElem.textContent = session.user.email;

            // Chequear nivel del factor de autenticación con protección antiquiebre
            try {
                const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                if (data && data.currentLevel !== 'aal2' && data.nextLevel === 'aal2') {
                    // El usuario configuró 2FA pero no lo ha pasado
                    window.location.href = 'login.html';
                }
            } catch (mfaErr) {
                console.warn("MFA chequeo falló, ignorando por ahora para prevenir bloqueo:", mfaErr);
            }
        }
    } catch (globalErr) {
        console.error("Error global de inicialización:", globalErr);
    }
});

async function logout() {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Error intentando cerrar sesión remota:", e);
    } finally {
        // Garantizar que la limpieza visual y redirección suceda sí o sí
        localStorage.clear(); 
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}
