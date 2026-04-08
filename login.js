let globalFactorId = null;

const loginForm = document.getElementById('loginForm');
const setupMfaForm = document.getElementById('setupMfaForm');
const mfaForm = document.getElementById('mfaForm');

const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const mfaSetupError = document.getElementById('mfaSetupError');
const mfaError = document.getElementById('mfaError');

function showError(elem, msg) {
    if (!elem) return;
    elem.textContent = msg;
    elem.classList.remove('hidden');
}

function hideErrors() {
    [errorMsg, mfaSetupError, mfaError].forEach(e => {
        if (e) e.classList.add('hidden');
    });
}

function setLoading(btn, state) {
    if (!btn) return;
    if (state) {
        btn.classList.add('btn-loading');
        btn.dataset.original = btn.textContent;
        btn.textContent = 'Cargando...';
    } else {
        btn.classList.remove('btn-loading');
        if (btn.dataset.original) btn.textContent = btn.dataset.original;
    }
}

async function handleMFAState(session) {
    try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) throw error;
        
        const { currentLevel, nextLevel } = data;

        if (currentLevel === 'aal1' && nextLevel === 'aal2') {
            // Usuario tiene configurado MFA pero no validó en esta sesión
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('mfaSection').classList.remove('hidden');
        } else if (currentLevel === 'aal1' && nextLevel === 'aal1') {
            // Usuario debe afiliar 2FA
            await enrollMFA();
        } else {
            // Autorizado Full (aal2)
            window.location.href = 'index.html';
        }
    } catch (err) {
        showError(errorMsg, "Error de verificación de estado MFA");
        console.error(err);
    }
}

async function enrollMFA() {
    try {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('setupMfaSection').classList.remove('hidden');

        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;

        globalFactorId = data.id;

        // Generar QR en el canvas con la librería QR
        if (data.totp.qr_code) {
           // Si viene nativo, supabase da uri de authenticator. Usaremos la URI.
           QRCode.toCanvas(document.getElementById('qrImage'), data.totp.uri, function (error) {
               if (error) console.error(error);
           });
        }
    } catch (err) {
        showError(mfaSetupError, "Fallo al iniciar registro de factor de seguridad.");
        console.error(err);
    }
}


loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    setLoading(loginBtn, true);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const autoReg = document.getElementById('autoRegister').checked;

    try {
        // 1. Intentar Loguear
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            if (error.message.includes('Invalid login credentials') && autoReg) {
                // SignUp auto fallback
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) {
                    showError(errorMsg, signUpError.message);
                } else if (!signUpData.session) {
                    // Si confirmación de email está habilitada en supabase, advertir:
                    showError(errorMsg, "Revisa tu bandeja de correo para verificar la cuenta antes de iniciar.");
                } else {
                    // Exito en registro
                    await handleMFAState(signUpData.session);
                }
            } else {
                showError(errorMsg, "Credenciales inválidas o correo no registrado.");
            }
            return;
        }
        
        if (data.session) {
            await handleMFAState(data.session);
        }
    } catch (err) {
        showError(errorMsg, "Ocurrió un problema de conexión.");
        console.error(err);
    } finally {
        setLoading(loginBtn, false);
    }
});


setupMfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    const btn = document.getElementById('setupBtn');
    setLoading(btn, true);

    const code = document.getElementById('setupMfaCode').value.trim();

    try {
        const challenge = await supabase.auth.mfa.challenge({ factorId: globalFactorId });
        if (challenge.error) throw challenge.error;

        const verify = await supabase.auth.mfa.verify({
            factorId: globalFactorId,
            challengeId: challenge.data.id,
            code
        });

        if (verify.error) throw verify.error;

        // Ya validó!
        window.location.href = 'index.html';
    } catch (err) {
        showError(mfaSetupError, "Código incorrecto. Vuelve a intentarlo.");
        console.error(err);
    } finally {
        setLoading(btn, false);
    }
});


mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    const btn = document.getElementById('verifyBtn');
    setLoading(btn, true);

    const code = document.getElementById('mfaCode').value.trim();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.factors) throw new Error("No hay factor configurado para intentar reto.");

        const totpFactor = user.factors.find(f => f.factor_type === 'totp' && f.status === 'verified');
        if (!totpFactor) throw new Error("No factor 2fa valido.");

        const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (challenge.error) throw challenge.error;

        const verify = await supabase.auth.mfa.verify({
            factorId: totpFactor.id,
            challengeId: challenge.data.id,
            code
        });

        if (verify.error) throw verify.error;

        // MFA passed
        window.location.href = 'index.html';
    } catch (err) {
        showError(mfaError, "El código es incorrecto.");
        console.error(err);
    } finally {
        setLoading(btn, false);
    }
});
