// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - Netlify Identity
// ===================================================================

(function () {

    // URL de l'API Identity de votre site
    var SITE_URL = 'https://briefing-atelier-clarte-bien-etre.netlify.app';

    function initAuth() {
        var loginGate = document.getElementById('login-gate');
        var loginBtn = document.getElementById('login-btn');
        var logoutBtn = document.getElementById('logout-btn');

        // Vérifie que le widget est bien chargé
        if (typeof netlifyIdentity === 'undefined') {
            console.warn('[Auth] Netlify Identity Widget non détecté. Réessai dans 500ms...');
            setTimeout(initAuth, 500);
            return;
        }

        // Initialisation du widget AVEC l'URL explicite de l'API
        try {
            netlifyIdentity.init({
                APIUrl: SITE_URL + '/.netlify/identity'
            });
            console.log('[Auth] Netlify Identity initialisé avec API:', SITE_URL + '/.netlify/identity');
        } catch (e) {
            console.error('[Auth] Erreur lors de init():', e);
        }

        // --- Gestion des tokens d'invitation / confirmation dans l'URL ---
        var hash = window.location.hash;
        if (hash) {
            console.log('[Auth] Hash détecté dans l\'URL:', hash);
            if (hash.indexOf('invite_token=') !== -1 ||
                hash.indexOf('confirmation_token=') !== -1 ||
                hash.indexOf('recovery_token=') !== -1) {
                console.log('[Auth] Token détecté, ouverture du widget...');
                try {
                    netlifyIdentity.open();
                } catch (e) {
                    console.error('[Auth] Erreur ouverture widget pour token:', e);
                }
            }
        }

        // Vérifie si déjà connecté
        var currentUser = netlifyIdentity.currentUser();
        if (currentUser) {
            console.log('[Auth] Utilisateur déjà connecté :', currentUser.email);
            grantAccess();
        } else {
            console.log('[Auth] Aucun utilisateur connecté.');
        }

        // Bouton "Se connecter"
        if (loginBtn) {
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Auth] Clic sur Se connecter...');

                try {
                    netlifyIdentity.open('login');
                    console.log('[Auth] netlifyIdentity.open("login") appelé.');
                } catch (err) {
                    console.error('[Auth] Erreur open("login"):', err);
                    try {
                        netlifyIdentity.open();
                        console.log('[Auth] Fallback: netlifyIdentity.open() appelé.');
                    } catch (err2) {
                        console.error('[Auth] Erreur fallback:', err2);
                    }
                }

                // Diagnostic après 500ms
                setTimeout(function () {
                    var modals = document.querySelectorAll(
                        '.ReactModalPortal, .ReactModal__Overlay, ' +
                        '[class*="netlifyIdentity"], [class*="ReactModal"], ' +
                        'iframe[src*="netlify"], .netlify-identity-widget'
                    );
                    console.log('[Auth] Diagnostic - Éléments widget trouvés:', modals.length);

                    if (modals.length > 0) {
                        modals.forEach(function (el) {
                            el.style.zIndex = '99999';
                        });
                        console.log('[Auth] Z-index forcé.');
                    } else {
                        console.warn('[Auth] AUCUN élément widget dans le DOM !');
                        console.log('[Auth] - typeof netlifyIdentity:', typeof netlifyIdentity);
                        console.log('[Auth] - Méthodes:', Object.keys(netlifyIdentity).join(', '));
                        console.log('[Auth] - currentUser:', netlifyIdentity.currentUser());

                        // Test connectivité API Identity
                        fetch(SITE_URL + '/.netlify/identity/settings')
                            .then(function (r) {
                                console.log('[Auth] - API status:', r.status);
                                return r.json();
                            })
                            .then(function (data) {
                                console.log('[Auth] - API settings:', JSON.stringify(data));
                            })
                            .catch(function (err) {
                                console.error('[Auth] - API INACCESSIBLE:', err.message);
                            });
                    }
                }, 500);
            });
        }

        // Événement : connexion réussie
        netlifyIdentity.on('login', function (user) {
            console.log('[Auth] Connecté :', user.email);
            netlifyIdentity.close();
            grantAccess();
        });

        // Événement : erreur
        netlifyIdentity.on('error', function (err) {
            console.error('[Auth] Erreur Identity:', err);
        });

        // Bouton "Déconnexion"
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                netlifyIdentity.logout();
            });
        }

        // Événement : déconnexion
        netlifyIdentity.on('logout', function () {
            console.log('[Auth] Déconnecté.');
            revokeAccess();
        });

        // --- Fonctions ---
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
