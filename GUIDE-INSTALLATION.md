# Guide d'Installation — Système de Connexion pour vos Ateliers de Clarté

## Ce que vous avez reçu

Voici les fichiers modifiés et nouveaux à intégrer dans votre projet :

| Fichier | Description |
|---------|-------------|
| `index.html` | Votre HTML avec l'écran de connexion ajouté |
| `style.css` | Votre CSS avec les styles de l'écran de connexion |
| `auth.js` | **Nouveau fichier** — Gère toute la logique de connexion/déconnexion |

---

## Étape 1 — Ajouter les fichiers à votre projet GitHub

### 1.1 Remplacez `index.html` et `style.css`
Remplacez vos fichiers existants par les versions modifiées.

### 1.2 Ajoutez `auth.js` à la racine de votre projet
Placez le fichier `auth.js` au même niveau que `index.html` et `script.js`.

### 1.3 Ajoutez les deux scripts dans votre `index.html`
Vérifiez que ces deux lignes sont bien présentes dans le `<head>` de votre HTML :

```html
<!-- Netlify Identity Widget (déjà ajouté) -->
<script type="text/javascript" src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

Et juste **avant** la balise `</body>`, ajoutez :

```html
<script src="auth.js"></script>
<script src="script.js"></script>
```

> **Important :** `auth.js` doit être chargé **avant** `script.js` pour que l'écran de connexion apparaisse en premier.

---

## Étape 2 — Activer Netlify Identity dans le Dashboard Netlify

C'est l'étape la plus importante ! Voici comment faire :

1. Allez sur **[app.netlify.com](https://app.netlify.com)**
2. Cliquez sur le **site de l'atelier** concerné
3. Dans le menu de gauche, cliquez sur **"Integrations"**
4. Cherchez **"Netlify Identity"** et cliquez sur **"Enable"**
5. C'est activé ! ✅

---

## Étape 3 — Configurer les inscriptions (TRÈS IMPORTANT)

Par défaut, n'importe qui peut créer un compte. Vous devez **fermer les inscriptions** et inviter vos clients manuellement.

1. Toujours dans votre site sur Netlify, allez dans **Integrations > Netlify Identity**
2. Cliquez sur **"Configuration and usage"**
3. Sous **"Registration"**, changez de **"Open"** à **"Invite only"**
4. Cliquez **"Save"**

> Cela signifie que seules les personnes que VOUS invitez pourront se connecter.

---

## Étape 4 — Inviter un client

Quand vous êtes prêt à donner accès à un client :

1. Dans le dashboard Netlify de votre site, allez dans **Integrations > Netlify Identity**
2. Cliquez sur l'onglet **"Users"** (ou "Identity" dans le menu)
3. Cliquez sur **"Invite users"**
4. Entrez l'**adresse email** de votre client
5. Cliquez **"Send"**

Votre client recevra un email avec un lien pour créer son mot de passe.

---

## Comment ça marche pour votre client

1. Votre client reçoit un **email d'invitation** avec un lien
2. Il clique sur le lien et **crée son mot de passe**
3. Quand il va sur l'URL de son atelier, il voit l'**écran de connexion**
4. Il entre son email et mot de passe → il accède à l'atelier
5. Un **bouton "Déconnexion"** discret apparaît en bas à droite

---

## Résumé de l'architecture

```
Votre projet GitHub (par atelier)
├── index.html          ← Modifié (ajout de l'écran de connexion)
├── style.css           ← Modifié (ajout des styles login)
├── script.js           ← Inchangé (votre code existant)
├── auth.js             ← NOUVEAU (logique d'authentification)
└── images/
    └── logo-clartem-blanc.png
```

---

## Pour chaque nouvel atelier

Quand vous créez un nouvel atelier de clarté pour un client :

1. **Copiez** ces fichiers dans le nouveau repository
2. **Déployez** sur Netlify comme d'habitude
3. **Activez** Netlify Identity sur le nouveau site (Étape 2)
4. **Fermez les inscriptions** (Étape 3)
5. **Invitez** votre client par email (Étape 4)

---

## FAQ

**Q : C'est gratuit ?**
Oui ! Le plan gratuit de Netlify Identity inclut jusqu'à 1 000 utilisateurs actifs par site.

**Q : C'est sécurisé ?**
Oui. L'authentification est gérée côté serveur par Netlify. Les tokens sont sécurisés par JWT. Ce n'est pas un simple mot de passe côté client.

**Q : Mon client a oublié son mot de passe ?**
Pas de souci ! Sur l'écran de connexion, le widget Netlify Identity propose un lien "Forgot password" qui enverra un email de réinitialisation.

**Q : Puis-je inviter plusieurs personnes sur le même atelier ?**
Oui. Vous pouvez inviter autant de personnes que nécessaire (vous-même inclus pour tester !).

**Q : Le formulaire Netlify Forms fonctionne toujours ?**
Oui, les deux systèmes (Identity + Forms) sont indépendants et compatibles.
