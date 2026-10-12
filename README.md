# Avatar

Un personnage qui te parle en visio : son visage, ses expressions, sa voix, son caractère, et le cerveau de ton choix (Claude, ChatGPT, Gemini ou Mistral).

**Ouvrir l'appli : https://ronan-byte56.github.io/Avatar/**

Sur téléphone : ouvrir le lien dans Chrome, puis menu ⋮ → *Ajouter à l'écran d'accueil*.

## Ce que fait l'appli

- Un assistant de démarrage crée l'avatar : son nom, comment il t'appelle, tutoiement ou vouvoiement, son apparence, son rôle, ce qu'il sait de toi (avec import d'un fichier `.md`).
- Son visage : une vidéo par expression (repos, réflexion, étonnement, contentement, pas content, complice), filmée directement dans l'appli avec des consignes, ou choisie dans ses fichiers. Le son des vidéos n'est jamais joué.
- Sa voix : celle de l'appareil (gratuite) ou ElevenLabs (voix naturelles, avec une clé).
- Son cerveau : Claude, ChatGPT, Gemini ou Mistral, avec sa propre clé API. Gemini et Mistral ont une formule gratuite ; un abonnement ChatGPT Plus ou Claude Pro ne s'utilise pas ici.
- Le micro 🎤 : conversation à voix haute en continu (Chrome, Edge).
- Tout reste sur l'appareil de la personne : profil, clés, vidéos et conversation.

## Fichiers

`index.html` (la page), `app.js` (le moteur), `config.js` (réglages communs : expressions, cerveaux et modèles par défaut), `app.css`, `manifest.json` et `sw.js` (appli installable), icônes.

Après une modification, augmenter le numéro de version dans `sw.js` (`avatar-v5` → `avatar-v6`…) et dans `index.html` (`?v=5` → `?v=6` sur les trois fichiers) pour que les appareils récupèrent la nouvelle version.
