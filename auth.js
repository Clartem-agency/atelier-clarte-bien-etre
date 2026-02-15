// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - GoTrue (Netlify Identity)
// ===================================================================

(function () {

    var API_URL = 'https://briefing-atelier-clarte-bien-etre.netlify.app/.netlify/identity';

    // ⚠️ CRITIQUE : Capturer le hash AVANT tout init du widget
    // car netlifyIdentity.init() consomme et supprime le token du hash !
    var rawHash = window.location.hash || '';
    var inviteMatch = rawHash.match(/invite_token=([^&]+)/);
    var recoveryMatch = rawHash.match(/recovery_token=([^&]+)/);
    var confirmMatch = rawHash.match(/confirmation_token=([^&]+)/);

    var savedInviteToken = inviteMatch ? inviteMatch[1] : null;
    var savedRecoveryToken = recoveryMatch ? recoveryMatch[1] : null;
    var savedConfirmToken = confirmMatch ? confirmMatch[1] : null;

    if (savedInviteToken) console.log('[Auth] Token d\'invitation capturé avant init:', savedInviteToken.substring(0, 20) + '...');
    if (savedRecoveryToken) console.log('[Auth] Token de récupération capturé avant init.');
    if (savedConfirmToken) console.log('[Auth] Token de confirmation capturé avant init.');

    // Mode courant
    var currentMode = savedInviteToken ? 'invite' : (savedRecoveryToken ? 'recovery' : 'login');

    function initAuth() {
        var loginGate = document.getElementById('login-gate');
        var loginBtn = document.getElementById('login-btn');
        var loginBtnText = document.getElementById('login-btn-text');
        var loginEmail = document.getElementById('login-email');
        var loginPassword = document.getElementById('login-password');
        var loginError = document.getElementById('login-error');
        var logoutBtn = document.getElementById('logout-btn');

        // --- Initialiser le widget (SEULEMENT en mode login, pas en mode invite) ---
        if (currentMode === 'login' && typeof netlifyIdentity !== 'undefined') {
            try {
                netlifyIdentity.init({ APIUrl: API_URL });
                console.log('[Auth] Widget Netlify Identity initialisé.');
            } catch (e) {
                console.warn('[Auth] Erreur init widget:', e);
            }
        } else if (currentMode !== 'login') {
            console.log('[Auth] Mode ' + currentMode + ' : widget init ignoré pour préserver le token.');
        }

        // --- Vérifier si déjà connecté ---
        var currentUser = (typeof netlifyIdentity !== 'undefined' && currentMode === 'login') ? netlifyIdentity.currentUser() : null;
        if (currentUser) {
            console.log('[Auth] Utilisateur déjà connecté :', currentUser.email);
            grantAccess();
            return;
        }
        console.log('[Auth] Mode:', currentMode);

        // --- Configurer l'interface selon le mode ---
        if (currentMode === 'invite') {
            setupInviteMode();
        } else if (currentMode === 'recovery') {
            setupRecoveryMode();
        }
        // En mode 'login', l'interface est déjà correcte par défaut

        // --- Gestion de la confirmation ---
        if (savedConfirmToken) {
            handleConfirmation();
        }

        // --- Unique handler pour le bouton ---
        if (loginBtn) {
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (currentMode === 'invite') {
                    handleInvite();
                } else if (currentMode === 'recovery') {
                    handleRecovery();
                } else {
                    handleLogin();
                }
            });
        }

        // --- Entrée dans les champs ---
        if (loginPassword) {
            loginPassword.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loginBtn && loginBtn.click(); }
            });
        }
        if (loginEmail) {
            loginEmail.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loginPassword && loginPassword.focus(); }
            });
        }

        // --- Bouton Déconnexion ---
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                if (typeof netlifyIdentity !== 'undefined') {
                    try { netlifyIdentity.logout(); } catch (e) { /* ignore */ }
                }
                clearLocalUser();
                revokeAccess();
                console.log('[Auth] Déconnecté.');
            });
        }

        // =================================================================
        // SETUP DES MODES (interface uniquement)
        // =================================================================

        function setupInviteMode() {
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = 'Bienvenue ! Créez votre mot de passe pour accéder à votre espace.';

            if (loginEmail) loginEmail.style.display = 'none';

            if (loginPassword) {
                loginPassword.placeholder = 'Choisissez un mot de passe';
                loginPassword.type = 'password';
                loginPassword.value = '';
                loginPassword.autocomplete = 'new-password';
            }

            if (loginBtnText) loginBtnText.textContent = 'Créer mon compte';

            // Champ de confirmation
            var confirmInput = document.createElement('input');
            confirmInput.type = 'password';
            confirmInput.id = 'login-password-confirm';
            confirmInput.className = 'login-input';
            confirmInput.placeholder = 'Confirmez le mot de passe';
            confirmInput.autocomplete = 'new-password';
            if (loginPassword && loginPassword.parentNode) {
                loginPassword.parentNode.insertBefore(confirmInput, loginPassword.nextSibling);
            }
            confirmInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loginBtn && loginBtn.click(); }
            });
        }

        function setupRecoveryMode() {
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = 'Choisissez un nouveau mot de passe.';
            if (loginEmail) loginEmail.style.display = 'none';
            if (loginPassword) { loginPassword.placeholder = 'Nouveau mot de passe'; loginPassword.value = ''; }
            if (loginBtnText) loginBtnText.textContent = 'Réinitialiser';
        }

        // =================================================================
        // HANDLERS
        // =================================================================

        function handleLogin() {
            var email = loginEmail ? loginEmail.value.trim() : '';
            var password = loginPassword ? loginPassword.value : '';

            if (!email) { showError('Veuillez entrer votre adresse email.'); return; }
            if (!password) { showError('Veuillez entrer votre mot de passe.'); return; }

            hideError();
            setLoading(true);
            console.log('[Auth] Connexion pour:', email);

            fetch(API_URL + '/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'grant_type=password&username=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password)
            })
            .then(function (r) {
                if (!r.ok) return r.json().then(function (d) { throw new Error(d.error_description || d.msg || 'Identifiants incorrects'); });
                return r.json();
            })
            .then(function (data) {
                console.log('[Auth] Connecté !');
                // Stocker les infos de session pour que netlifyIdentity.currentUser() fonctionne au rechargement
                try {
                    var userData = {
                        access_token: data.access_token,
                        token_type: data.token_type,
                        expires_in: data.expires_in,
                        refresh_token: data.refresh_token,
                        expires_at: Date.now() + (data.expires_in * 1000)
                    };
                    localStorage.setItem('gotrue.user', JSON.stringify(userData));
                } catch (e) { /* ignore */ }
                grantAccess();
            })
            .catch(function (err) {
                console.error('[Auth] Erreur login:', err);
                showLoginError(err);
                setLoading(false);
            });
        }

        function handleInvite() {
            var password = loginPassword ? loginPassword.value : '';
            var confirmEl = document.getElementById('login-password-confirm');
            var passwordConfirm = confirmEl ? confirmEl.value : '';

            if (!password || password.length < 6) {
                showError('Le mot de passe doit contenir au moins 6 caractères.');
                return;
            }
            if (password !== passwordConfirm) {
                showError('Les mots de passe ne correspondent pas.');
                return;
            }

            hideError();
            setLoading(true);
            console.log('[Auth] Acceptation de l\'invitation...');
            console.log('[Auth] Token utilisé:', savedInviteToken.substring(0, 20) + '...');

            // Étape 1 : Vérifier le token d'invitation → obtenir un access_token
            fetch(API_URL + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: savedInviteToken, type: 'signup' })
            })
            .then(function (r) {
                console.log('[Auth] /verify status:', r.status);
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        console.error('[Auth] /verify réponse:', txt);
                        throw new Error('Token d\'invitation invalide ou expiré. Demandez une nouvelle invitation.');
                    });
                }
                return r.json();
            })
            .then(function (verifyData) {
                console.log('[Auth] Invitation vérifiée ! Clés:', Object.keys(verifyData).join(', '));
                var accessToken = verifyData.access_token;
                if (!accessToken) {
                    throw new Error('Aucun access_token reçu.');
                }

                // Étape 2 : Définir le mot de passe
                return fetch(API_URL + '/user', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + accessToken
                    },
                    body: JSON.stringify({ password: password })
                });
            })
            .then(function (r) {
                console.log('[Auth] /user status:', r.status);
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        console.error('[Auth] /user réponse:', txt);
                        throw new Error('Erreur lors de la création du compte.');
                    });
                }
                return r.json();
            })
            .then(function () {
                console.log('[Auth] Compte créé avec succès !');
                showSuccess('Compte créé ! Vous pouvez maintenant vous connecter.');
                // Nettoyer le hash et passer en mode login
                history.replaceState(null, '', window.location.pathname);
                setTimeout(function () { window.location.reload(); }, 2000);
            })
            .catch(function (err) {
                console.error('[Auth] Erreur invitation:', err);
                showError(err.message);
                setLoading(false);
            });
        }

        function handleRecovery() {
            var password = loginPassword ? loginPassword.value : '';
            if (!password || password.length < 6) {
                showError('Le mot de passe doit contenir au moins 6 caractères.');
                return;
            }
            hideError();
            setLoading(true);

            fetch(API_URL + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: savedRecoveryToken, type: 'recovery' })
            })
            .then(function (r) { if (!r.ok) throw new Error('Token expiré'); return r.json(); })
            .then(function (data) {
                return fetch(API_URL + '/user', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.access_token },
                    body: JSON.stringify({ password: password })
                });
            })
            .then(function () {
                showSuccess('Mot de passe modifié ! Redirection...');
                history.replaceState(null, '', window.location.pathname);
                setTimeout(function () { window.location.reload(); }, 2000);
            })
            .catch(function (err) {
                showError('Erreur. Le lien a peut-être expiré.');
                setLoading(false);
            });
        }

        function handleConfirmation() {
            fetch(API_URL + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: savedConfirmToken, type: 'signup' })
            })
            .then(function (r) { if (!r.ok) throw new Error('Erreur'); return r.json(); })
            .then(function () {
                showSuccess('Compte confirmé ! Vous pouvez vous connecter.');
                history.replaceState(null, '', window.location.pathname);
            })
            .catch(function () {
                showError('Erreur de confirmation. Le lien a peut-être expiré.');
            });
        }

        // =================================================================
        // UTILITAIRES
        // =================================================================

        function showLoginError(err) {
            var msg = (err && err.message) ? err.message : String(err);
            var lower = msg.toLowerCase();
            if (lower.indexOf('invalid') !== -1 || lower.indexOf('credentials') !== -1 || lower.indexOf('no user') !== -1) {
                showError('Email ou mot de passe incorrect.');
            } else if (lower.indexOf('not confirmed') !== -1) {
                showError('Veuillez d\'abord confirmer votre compte via l\'email reçu.');
            } else {
                showError('Erreur : ' + msg);
            }
        }

        function showError(msg) {
            if (loginError) { loginError.textContent = msg; loginError.style.display = msg ? 'block' : 'none'; loginError.style.color = '#e57373'; }
        }

        function showSuccess(msg) {
            if (loginError) { loginError.textContent = msg; loginError.style.display = 'block'; loginError.style.color = '#81c784'; }
        }

        function hideError() {
            if (loginError) { loginError.style.display = 'none'; loginError.textContent = ''; }
        }

        function setLoading(isLoading) {
            if (loginBtn) { loginBtn.disabled = isLoading; loginBtn.style.opacity = isLoading ? '0.7' : '1'; loginBtn.style.pointerEvents = isLoading ? 'none' : 'auto'; }
            if (loginBtnText) {
                if (isLoading) { loginBtnText.textContent = currentMode === 'invite' ? 'Création...' : 'Connexion...'; }
                else { loginBtnText.textContent = currentMode === 'invite' ? 'Créer mon compte' : 'Se connecter'; }
            }
        }

        function clearLocalUser() {
            try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('gotrue') !== -1 || k.indexOf('netlify') !== -1) localStorage.removeItem(k); }); } catch (e) {}
        }

        function grantAccess() {
            if (loginGate) { loginGate.classList.add('hidden'); setTimeout(function () { loginGate.style.display = 'none'; }, 700); }
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        }

        function revokeAccess() {
            if (loginGate) { loginGate.style.display = 'flex'; requestAnimationFrame(function () { loginGate.classList.remove('hidden'); }); }
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    // Lance quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }

})();
