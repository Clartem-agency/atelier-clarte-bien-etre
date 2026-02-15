// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - GoTrue (Netlify Identity)
// Sans dépendance au popup du widget
// ===================================================================

(function () {

    var API_URL = 'https://briefing-atelier-clarte-bien-etre.netlify.app/.netlify/identity';
    var gotrueInstance = null;

    function initAuth() {
        var loginGate = document.getElementById('login-gate');
        var loginBtn = document.getElementById('login-btn');
        var loginBtnText = document.getElementById('login-btn-text');
        var loginEmail = document.getElementById('login-email');
        var loginPassword = document.getElementById('login-password');
        var loginError = document.getElementById('login-error');
        var logoutBtn = document.getElementById('logout-btn');

        // Initialiser GoTrue
        // Option 1 : via le widget Netlify Identity (s'il est chargé)
        if (typeof netlifyIdentity !== 'undefined') {
            try {
                netlifyIdentity.init({ APIUrl: API_URL });
                gotrueInstance = netlifyIdentity.gotrue;
                console.log('[Auth] GoTrue récupéré depuis le widget Netlify Identity.');
            } catch (e) {
                console.warn('[Auth] Erreur init widget:', e);
            }
        }

        // Option 2 : créer GoTrue manuellement si le widget n'a pas fonctionné
        if (!gotrueInstance && typeof GoTrue !== 'undefined') {
            gotrueInstance = new GoTrue({ APIUrl: API_URL, audience: '', setCookie: true });
            console.log('[Auth] GoTrue créé manuellement.');
        }

        // Option 3 : utiliser fetch directement comme fallback ultime
        if (!gotrueInstance) {
            console.warn('[Auth] GoTrue non disponible. Utilisation de fetch comme fallback.');
        }

        // --- Vérifier si déjà connecté ---
        var currentUser = getCurrentUser();
        if (currentUser) {
            console.log('[Auth] Utilisateur déjà connecté :', currentUser.email);
            grantAccess();
        } else {
            console.log('[Auth] Aucun utilisateur connecté.');
        }

        // --- Gestion des tokens dans l'URL (invitation, confirmation, recovery) ---
        handleTokenInUrl();

        // --- Bouton Se connecter ---
        if (loginBtn) {
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                doLogin();
            });
        }

        // --- Appuyer sur Entrée dans les champs ---
        if (loginPassword) {
            loginPassword.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doLogin();
                }
            });
        }
        if (loginEmail) {
            loginEmail.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (loginPassword) loginPassword.focus();
                }
            });
        }

        // --- Bouton Déconnexion ---
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                var user = getCurrentUser();
                if (user && typeof user.logout === 'function') {
                    user.logout().then(function () {
                        console.log('[Auth] Déconnecté.');
                        revokeAccess();
                    }).catch(function (err) {
                        console.error('[Auth] Erreur déconnexion:', err);
                        // Forcer la déconnexion côté client
                        clearLocalUser();
                        revokeAccess();
                    });
                } else {
                    clearLocalUser();
                    revokeAccess();
                }
            });
        }

        // =========================
        // FONCTIONS
        // =========================

        function doLogin() {
            var email = loginEmail ? loginEmail.value.trim() : '';
            var password = loginPassword ? loginPassword.value : '';

            // Validation
            if (!email) {
                showError('Veuillez entrer votre adresse email.');
                if (loginEmail) loginEmail.focus();
                return;
            }
            if (!password) {
                showError('Veuillez entrer votre mot de passe.');
                if (loginPassword) loginPassword.focus();
                return;
            }

            hideError();
            setLoading(true);

            // Tentative de connexion
            if (gotrueInstance && typeof gotrueInstance.login === 'function') {
                // Via GoTrue
                gotrueInstance.login(email, password, true)
                    .then(function (user) {
                        console.log('[Auth] Connecté via GoTrue :', user.email);
                        grantAccess();
                    })
                    .catch(function (err) {
                        console.error('[Auth] Erreur login GoTrue:', err);
                        handleLoginError(err);
                        setLoading(false);
                    });
            } else {
                // Fallback via fetch
                fetch(API_URL + '/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'grant_type=password&username=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password)
                })
                .then(function (r) {
                    if (!r.ok) {
                        return r.json().then(function (data) {
                            throw new Error(data.error_description || data.msg || 'Identifiants incorrects');
                        });
                    }
                    return r.json();
                })
                .then(function (data) {
                    console.log('[Auth] Connecté via fetch.');
                    // Sauvegarder le token
                    localStorage.setItem('gotrue.user', JSON.stringify(data));
                    grantAccess();
                })
                .catch(function (err) {
                    console.error('[Auth] Erreur login fetch:', err);
                    handleLoginError(err);
                    setLoading(false);
                });
            }
        }

        function handleLoginError(err) {
            var msg = (err && err.message) ? err.message : String(err);
            var msgLower = msg.toLowerCase();

            if (msgLower.indexOf('invalid') !== -1 || msgLower.indexOf('credentials') !== -1 || msgLower.indexOf('unauthorized') !== -1) {
                showError('Email ou mot de passe incorrect.');
            } else if (msgLower.indexOf('not confirmed') !== -1 || msgLower.indexOf('confirm') !== -1) {
                showError('Veuillez d\'abord confirmer votre compte via le lien reçu par email.');
            } else if (msgLower.indexOf('network') !== -1 || msgLower.indexOf('fetch') !== -1) {
                showError('Erreur de connexion. Vérifiez votre connexion internet.');
            } else {
                showError('Erreur : ' + msg);
            }
        }

        function handleTokenInUrl() {
            var hash = window.location.hash;
            if (!hash) return;

            // Token d'invitation
            var inviteMatch = hash.match(/invite_token=([^&]+)/);
            if (inviteMatch) {
                console.log('[Auth] Token d\'invitation détecté:', inviteMatch[1].substring(0, 20) + '...');
                showInviteForm(inviteMatch[1]);
                return;
            }

            // Token de confirmation
            var confirmMatch = hash.match(/confirmation_token=([^&]+)/);
            if (confirmMatch) {
                console.log('[Auth] Token de confirmation détecté.');
                confirmUser(confirmMatch[1]);
                return;
            }

            // Token de récupération
            var recoveryMatch = hash.match(/recovery_token=([^&]+)/);
            if (recoveryMatch) {
                console.log('[Auth] Token de récupération détecté.');
                showRecoveryForm(recoveryMatch[1]);
                return;
            }
        }

        function showInviteForm(token) {
            // Transformer le formulaire de login en formulaire d'acceptation d'invitation
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) {
                subtitle.textContent = 'Bienvenue ! Créez votre mot de passe pour accéder à votre espace.';
            }
            if (loginEmail) {
                loginEmail.style.display = 'none';
            }
            if (loginPassword) {
                loginPassword.placeholder = 'Choisissez un mot de passe';
            }
            if (loginBtnText) {
                loginBtnText.textContent = 'Créer mon compte';
            }

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

            // Remplacer le handler du bouton
            if (loginBtn) {
                loginBtn.onclick = function (e) {
                    e.preventDefault();
                    var pwd = loginPassword ? loginPassword.value : '';
                    var pwdConfirm = confirmInput ? confirmInput.value : '';

                    if (!pwd || pwd.length < 6) {
                        showError('Le mot de passe doit contenir au moins 6 caractères.');
                        return;
                    }
                    if (pwd !== pwdConfirm) {
                        showError('Les mots de passe ne correspondent pas.');
                        return;
                    }

                    hideError();
                    setLoading(true);

                    // Étape 1 : Vérifier le token d'invitation pour obtenir un access_token
                    fetch(API_URL + '/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: token, type: 'invite' })
                    })
                    .then(function (r) {
                        if (!r.ok) {
                            return r.json().then(function (d) { throw new Error(d.msg || d.error_description || 'Token d\'invitation invalide ou expiré.'); });
                        }
                        return r.json();
                    })
                    .then(function (verifyData) {
                        console.log('[Auth] Token d\'invitation vérifié. Définition du mot de passe...');
                        var accessToken = verifyData.access_token;

                        if (!accessToken) {
                            throw new Error('Aucun access_token reçu. Veuillez demander une nouvelle invitation.');
                        }

                        // Étape 2 : Définir le mot de passe avec l'access_token
                        return fetch(API_URL + '/user', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + accessToken
                            },
                            body: JSON.stringify({ password: pwd })
                        });
                    })
                    .then(function (r) {
                        if (!r.ok) {
                            return r.json().then(function (d) { throw new Error(d.msg || 'Erreur lors de la création du compte.'); });
                        }
                        return r.json();
                    })
                    .then(function (r) {
                        if (!r.ok) {
                            return r.json().then(function (d) { throw new Error(d.msg || 'Erreur lors de la création du compte.'); });
                        }
                        return r.json();
                    })
                    .then(function () {
                        console.log('[Auth] Invitation acceptée !');
                        // Nettoyer le hash
                        history.replaceState(null, '', window.location.pathname);
                        showError('');
                        // Recharger pour afficher le formulaire de login normal
                        window.location.reload();
                    })
                    .catch(function (err) {
                        console.error('[Auth] Erreur acceptation invitation:', err);
                        showError(err.message || 'Erreur lors de la création du compte.');
                        setLoading(false);
                    });
                };
            }
        }

        function confirmUser(token) {
            fetch(API_URL + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, type: 'signup' })
            })
            .then(function (r) {
                if (!r.ok) throw new Error('Erreur de confirmation');
                return r.json();
            })
            .then(function () {
                console.log('[Auth] Compte confirmé !');
                history.replaceState(null, '', window.location.pathname);
                showError('Compte confirmé ! Vous pouvez maintenant vous connecter.');
                if (loginError) loginError.style.color = '#4CAF50';
            })
            .catch(function (err) {
                console.error('[Auth] Erreur confirmation:', err);
                showError('Erreur lors de la confirmation. Le lien a peut-être expiré.');
            });
        }

        function showRecoveryForm(token) {
            var subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = 'Choisissez un nouveau mot de passe.';
            if (loginEmail) loginEmail.style.display = 'none';
            if (loginPassword) loginPassword.placeholder = 'Nouveau mot de passe';
            if (loginBtnText) loginBtnText.textContent = 'Réinitialiser';

            if (loginBtn) {
                loginBtn.onclick = function (e) {
                    e.preventDefault();
                    var pwd = loginPassword ? loginPassword.value : '';
                    if (!pwd || pwd.length < 6) {
                        showError('Le mot de passe doit contenir au moins 6 caractères.');
                        return;
                    }
                    setLoading(true);
                    fetch(API_URL + '/user', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ password: pwd })
                    })
                    .then(function (r) {
                        if (!r.ok) throw new Error('Erreur');
                        history.replaceState(null, '', window.location.pathname);
                        window.location.reload();
                    })
                    .catch(function (err) {
                        showError('Erreur. Le lien a peut-être expiré.');
                        setLoading(false);
                    });
                };
            }
        }

        function getCurrentUser() {
            // Via le widget
            if (typeof netlifyIdentity !== 'undefined') {
                var u = netlifyIdentity.currentUser();
                if (u) return u;
            }
            // Via GoTrue
            if (gotrueInstance && typeof gotrueInstance.currentUser === 'function') {
                var u2 = gotrueInstance.currentUser();
                if (u2) return u2;
            }
            return null;
        }

        function clearLocalUser() {
            try {
                localStorage.removeItem('gotrue.user');
                // Nettoyer aussi les clés du widget
                Object.keys(localStorage).forEach(function (key) {
                    if (key.indexOf('gotrue') !== -1 || key.indexOf('netlify') !== -1) {
                        localStorage.removeItem(key);
                    }
                });
            } catch (e) { /* ignore */ }
        }

        function showError(msg) {
            if (loginError) {
                loginError.textContent = msg;
                loginError.style.display = msg ? 'block' : 'none';
                loginError.style.color = '';
            }
        }

        function hideError() {
            if (loginError) {
                loginError.style.display = 'none';
                loginError.textContent = '';
            }
        }

        function setLoading(isLoading) {
            if (loginBtn) loginBtn.disabled = isLoading;
            if (loginBtnText) {
                loginBtnText.textContent = isLoading ? 'Connexion...' : 'Se connecter';
            }
            if (loginBtn) {
                loginBtn.style.opacity = isLoading ? '0.7' : '1';
                loginBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
            }
        }

        function grantAccess() {
            if (loginGate) {
                loginGate.classList.add('hidden');
                setTimeout(function () {
                    loginGate.style.display = 'none';
                }, 700);
            }
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-flex';
            }
        }

        function revokeAccess() {
            if (loginGate) {
                loginGate.style.display = 'flex';
                requestAnimationFrame(function () {
                    loginGate.classList.remove('hidden');
                });
            }
            if (logoutBtn) {
                logoutBtn.style.display = 'none';
            }
        }
    }

    // Lance quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }

})();
