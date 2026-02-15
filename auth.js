// ===================================================================
// SYSTÈME D'AUTHENTIFICATION - Netlify Identity
// ===================================================================
// Ce script gère l'écran de connexion et la protection de l'atelier.
// Il utilise le widget Netlify Identity (chargé dans le <head>).
// ===================================================================

document.addEventListener('DOMContentLoaded', function () {

    const loginGate = document.getElementById('login-gate');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Vérifie si Netlify Identity Widget est chargé
    if (typeof netlifyIdentity === 'undefined') {
        console.error('Netlify Identity Widget non chargé.');
        return;
    }

    // --- Initialisation ---
    netlifyIdentity.init();

    // Vérifie si l'utilisateur est déjà connecté
    const currentUser = netlifyIdentity.currentUser();
    if (currentUser) {
        grantAccess();
    }

    // --- Bouton "Se connecter" ---
    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            netlifyIdentity.open('login');
        });
    }

    // --- Quand l'utilisateur se connecte avec succès ---
    netlifyIdentity.on('login', function (user) {
        console.log('Connecté :', user.email);
        netlifyIdentity.close();
        grantAccess();
    });

    // --- Bouton "Déconnexion" ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            netlifyIdentity.logout();
        });
    }

    // --- Quand l'utilisateur se déconnecte ---
    netlifyIdentity.on('logout', function () {
        console.log('Déconnecté');
        revokeAccess();
    });

    // --- Fonctions d'accès ---
    function grantAccess() {
        if (loginGate) {
            loginGate.classList.add('hidden');
            // Supprime complètement après l'animation
            setTimeout(() => {
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
            // Petit délai pour que le display:flex soit appliqué avant l'animation
            requestAnimationFrame(() => {
                loginGate.classList.remove('hidden');
            });
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
    }

});
