// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - GoTrue (Netlify Identity)
// ===================================================================

(function () {

    var API_URL = 'https://briefing-atelier-clarte-bien-etre.netlify.app/.netlify/identity';

    // Mode courant : 'login', 'invite', ou 'recovery'
    var currentMode = 'login';
    var inviteToken = null;

    function initAuth() {
        var loginGate = document.getElementById('login-gate');
        var loginBtn = document.getElementById('login-btn');
        var loginBtnText = document.getElementById('login-btn-text');
        var loginEmail = document.getElementById('login-email');
        var loginPassword = document.getElementById('login-password');
        var loginError = document.getElementById('login-error');
        var logoutBtn = document.getElementById('logout-btn');

        // --- Initialiser GoTrue via le widget ---
        if (typeof netlifyIdentity !== 'undefined') {
            try {
                netlifyIdentity.init({ APIUrl: API_URL });
                console.log('[Auth] GoTrue récupéré depuis le widget Netlify Identity.');
            } catch (e) {
                console.warn('[Auth] Erreur init widget:', e);
            }
        }

        // --- Vérifier si déjà connecté ---
        var currentUser = (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity.currentUser() : null;
        if (currentUser) {
            console.log('[Auth] Utilisateur déjà connecté :', currentUser.email);
            grantAccess();
            return; // Pas besoin d'aller plus loin
        }
        console.log('[Auth] Aucun utilisateur connecté.');

        // --- Détecter un token dans l'URL ---
        var hash = window.location.hash || '';
        var inviteMatch = hash.match(/invite_token=([^&]+)/);
        var recoveryMatch = hash.match(/recovery_token=([^&]+)/);

        if (inviteMatch) {
            inviteToken = inviteMatch[1];
            currentMode = 'invite';
            console.log('[Auth] Mode INVITATION. Token:', inviteToken.substring(0, 20) + '...');
            setupInviteMode();
        } else if (recoveryMatch) {
            currentMode = 'recovery';
            console.log('[Auth] Mode RÉCUPÉRATION.');
            setupRecoveryMode(recoveryMatch[1]);
        } else {
            currentMode = 'login';
            console.log('[Auth] Mode CONNEXION standard.');
        }

        // --- Unique handler pour le bouton ---
        if (loginBtn) {
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (currentMode === 'invite') {
                    handleInvite();
                } else if (currentMode === 'recovery') {
                    // handled separately
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

        // --- Événements du widget ---
        if (typeof netlifyIdentity !== 'undefined') {
            netlifyIdentity.on('login', function (user) {
                console.log('[Auth] Connecté via widget :', user.email);
                netlifyIdentity.close();
                grantAccess();
            });
            netlifyIdentity.on('error', function (err) {
                console.error('[Auth] Erreur widget:', err);
            });
        }

        // --- Bouton Déconnexion ---
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                if (typeof netlifyIdentity !== 'undefined') {
                    netlifyIdentity.logout();
                }
                clearLocalUser();
                revokeAccess();
            });
        }
        if (typeof netlifyIdentity !== 'undefined') {
            netlifyIdentity.on('logout', function () {
                console.log('[Auth] Déconnecté.');
                revokeAccess();
            });
        }

        // =================================================================
        // SETUP DES MODES
        // =================================================================

        function setupInviteMode() {
            // Changer le texte
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = 'Bienvenue ! Créez votre mot de passe pour accéder à votre espace.';

            // Cacher le champ email
            if (loginEmail) loginEmail.style.display = 'none';

            // Adapter le champ mot de passe
            if (loginPassword) {
                loginPassword.placeholder = 'Choisissez un mot de passe';
                loginPassword.type = 'password';
                loginPassword.value = '';
            }

            // Changer le bouton
            if (loginBtnText) loginBtnText.textContent = 'Créer mon compte';

            // Ajouter un champ de confirmation
            var confirmInput = document.createElement('input');
            confirmInput.type = 'password';
            confirmInput.id = 'login-password-confirm';
            confirmInput.className = 'login-input';
            confirmInput.placeholder = 'Confirmez le mot de passe';
            confirmInput.autocomplete = 'new-password';
            if (loginPassword && loginPassword.parentNode) {
                loginPassword.parentNode.insertBefore(confirmInput, loginPassword.nextSibling);
            }

            // Entrée dans le champ confirmation
            confirmInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loginBtn && loginBtn.click(); }
            });
        }

        function setupRecoveryMode(token) {
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = 'Choisissez un nouveau mot de passe.';
            if (loginEmail) loginEmail.style.display = 'none';
            if (loginPassword) { loginPassword.placeholder = 'Nouveau mot de passe'; loginPassword.value = ''; }
            if (loginBtnText) loginBtnText.textContent = 'Réinitialiser';

            // Override du handler pour le recovery
            if (loginBtn) {
                loginBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var pwd = loginPassword ? loginPassword.value : '';
                    if (!pwd || pwd.length < 6) { showError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
                    setLoading(true);

                    fetch(API_URL + '/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: token, type: 'recovery' })
                    })
                    .then(function (r) { if (!r.ok) throw new Error('Token expiré'); return r.json(); })
                    .then(function (data) {
                        return fetch(API_URL + '/user', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.access_token },
                            body: JSON.stringify({ password: pwd })
                        });
                    })
                    .then(function () { history.replaceState(null, '', window.location.pathname); window.location.reload(); })
                    .catch(function (err) { showError('Erreur. Le lien a peut-être expiré.'); setLoading(false); });
                });
            }
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
            console.log('[Auth] Tentative de connexion pour:', email);

            // Via GoTrue du widget
            if (typeof netlifyIdentity !== 'undefined' && netlifyIdentity.gotrue) {
                netlifyIdentity.gotrue.login(email, password, true)
                    .then(function (user) {
                        console.log('[Auth] Connecté :', user.email);
                        grantAccess();
                    })
                    .catch(function (err) {
                        console.error('[Auth] Erreur login GoTrue:', err);
                        showLoginError(err);
                        setLoading(false);
                    });
            } else {
                // Fallback fetch
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
                    console.log('[Auth] Connecté via fetch.');
                    localStorage.setItem('gotrue.user', JSON.stringify(data));
                    grantAccess();
                })
                .catch(function (err) {
                    console.error('[Auth] Erreur login fetch:', err);
                    showLoginError(err);
                    setLoading(false);
                });
            }
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

            // Étape 1 : Vérifier le token d'invitation → obtenir un access_token
            fetch(API_URL + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: inviteToken, type: 'signup' })
            })
            .then(function (r) {
                console.log('[Auth] Réponse /verify status:', r.status);
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        console.error('[Auth] Réponse /verify:', txt);
                        throw new Error('Token d\'invitation invalide ou expiré. Demandez une nouvelle invitation.');
                    });
                }
                return r.json();
            })
            .then(function (verifyData) {
                console.log('[Auth] Invitation vérifiée. Clés reçues:', Object.keys(verifyData).join(', '));
                var accessToken = verifyData.access_token;

                if (!accessToken) {
                    throw new Error('Aucun access_token reçu. Demandez une nouvelle invitation.');
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
                console.log('[Auth] Réponse /user status:', r.status);
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        console.error('[Auth] Réponse /user:', txt);
                        throw new Error('Erreur lors de la création du compte.');
                    });
                }
                return r.json();
            })
            .then(function (userData) {
                console.log('[Auth] Compte créé avec succès !');
                // Nettoyer le hash et recharger pour le login normal
                history.replaceState(null, '', window.location.pathname);
                // Montrer un message de succès avant de recharger
                showSuccess('Compte créé avec succès ! Redirection...');
                setTimeout(function () {
                    window.location.reload();
                }, 1500);
            })
            .catch(function (err) {
                console.error('[Auth] Erreur invitation:', err);
                showError(err.message || 'Erreur lors de la création du compte.');
                setLoading(false);
            });
        }

        // =================================================================
        // UTILITAIRES
        // =================================================================

        function showLoginError(err) {
            var msg = (err && err.message) ? err.message : String(err);
            var msgLower = msg.toLowerCase();
            if (msgLower.indexOf('invalid') !== -1 || msgLower.indexOf('credentials') !== -1 || msgLower.indexOf('no user') !== -1) {
                showError('Email ou mot de passe incorrect.');
            } else if (msgLower.indexOf('not confirmed') !== -1) {
                showError('Veuillez d\'abord confirmer votre compte via l\'email reçu.');
            } else if (msgLower.indexOf('network') !== -1 || msgLower.indexOf('fetch') !== -1) {
                showError('Erreur de connexion réseau.');
            } else {
                showError('Erreur : ' + msg);
            }
        }

        function showError(msg) {
            if (loginError) {
                loginError.textContent = msg;
                loginError.style.display = msg ? 'block' : 'none';
                loginError.style.color = '#e57373';
            }
        }

        function showSuccess(msg) {
            if (loginError) {
                loginError.textContent = msg;
                loginError.style.display = 'block';
                loginError.style.color = '#81c784';
            }
        }

        function hideError() {
            if (loginError) { loginError.style.display = 'none'; loginError.textContent = ''; }
        }

        function setLoading(isLoading) {
            if (loginBtn) {
                loginBtn.disabled = isLoading;
                loginBtn.style.opacity = isLoading ? '0.7' : '1';
                loginBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
            }
            if (loginBtnText) {
                if (isLoading) {
                    loginBtnText.textContent = currentMode === 'invite' ? 'Création...' : 'Connexion...';
                } else {
                    loginBtnText.textContent = currentMode === 'invite' ? 'Créer mon compte' : 'Se connecter';
                }
            }
        }

        function clearLocalUser() {
            try {
                Object.keys(localStorage).forEach(function (key) {
                    if (key.indexOf('gotrue') !== -1 || key.indexOf('netlify') !== -1) {
                        localStorage.removeItem(key);
                    }
                });
            } catch (e) { /* ignore */ }
        }

        function grantAccess() {
            if (loginGate) {
                loginGate.classList.add('hidden');
                setTimeout(function () { loginGate.style.display = 'none'; }, 700);
            }
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        }

        function revokeAccess() {
            if (loginGate) {
                loginGate.style.display = 'flex';
                requestAnimationFrame(function () { loginGate.classList.remove('hidden'); });
            }
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
