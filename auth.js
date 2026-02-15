// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - Netlify Identity
// ===================================================================

(function () {

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

        // Initialisation du widget
        netlifyIdentity.init();
        console.log('[Auth] Netlify Identity initialisé.');

        // Observateur DOM : s'assure que tout élément du widget ait un z-index supérieur au login-gate
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1 && (
                        node.classList.contains('ReactModalPortal') ||
                        node.className.toString().indexOf('ReactModal') !== -1 ||
                        node.className.toString().indexOf('netlifyIdentity') !== -1
                    )) {
                        node.style.zIndex = '10001';
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Vérifie si déjà connecté
        var currentUser = netlifyIdentity.currentUser();
        if (currentUser) {
            console.log('[Auth] Utilisateur déjà connecté :', currentUser.email);
            grantAccess();
        }

        // Bouton "Se connecter"
        if (loginBtn) {
            loginBtn.addEventListener('click', function () {
                console.log('[Auth] Ouverture du widget de connexion...');
                netlifyIdentity.open('login');

                // Fix z-index : force le widget à s'afficher au-dessus du login-gate
                setTimeout(function () {
                    var portals = document.querySelectorAll('.ReactModalPortal, .ReactModal__Overlay, [class*="netlifyIdentity"], [class*="ReactModal"]');
                    portals.forEach(function (el) {
                        el.style.zIndex = '10001';
                    });
                    console.log('[Auth] Z-index corrigé pour', portals.length, 'éléments du widget.');
                }, 100);
            });
        }

        // Événement : connexion réussie
        netlifyIdentity.on('login', function (user) {
            console.log('[Auth] Connecté :', user.email);
            netlifyIdentity.close();
            grantAccess();
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
