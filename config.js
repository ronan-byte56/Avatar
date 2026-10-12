// =====================================================================
//  RÉGLAGES COMMUNS DE L'APPLI « Avatar »
//  Tout ce qui est propre à chaque personne (avatar, cerveau, clés, voix,
//  vidéos) se règle dans l'appli et reste sur son appareil.
// =====================================================================

window.AVATAR_CONFIG = {

  // Les expressions que l'avatar sait jouer. "repos" tourne en boucle.
  // "consigne" : ce qu'on demande à la personne filmée.
  expressions: {
    repos: { libelle: "Repos attentif", aide: "Écoute, regarde la caméra, cligne des yeux. C'est la vidéo principale.", consigne: "Regarde la caméra comme si tu écoutais quelqu'un. Cligne des yeux, bouge un peu la tête, sans parler." },
    reflexion: { libelle: "Réflexion", aide: "Cherche une réponse, regard qui part sur le côté.", consigne: "Réfléchis : regard vers le haut ou sur le côté, main au menton si tu veux." },
    etonnement: { libelle: "Étonnement", aide: "Surprise, sourcils levés.", consigne: "Prends un air étonné : sourcils levés, yeux grands ouverts." },
    contentement: { libelle: "Contentement", aide: "Bonne nouvelle, sourire, petit rire.", consigne: "Souris largement, petit rire silencieux, hoche la tête." },
    pas_contente: { libelle: "Pas content(e)", aide: "Mise en garde, gros yeux.", consigne: "Fais les gros yeux, comme pour une mise en garde." },
    complice: { libelle: "Complice", aide: "Humour, clin d'œil.", consigne: "Fais un clin d'œil complice, avec un petit sourire en coin." },
  },

  dureeReaction: 10, // durée maximale d'une réaction (s)
  dureeImage: 4,     // durée d'affichage d'une image fixe (s)
  dureeFilm: 6,      // durée d'un enregistrement d'expression (s)
  rognerHaut: 0,     // bande coupée en haut de la vidéo, en % (filigrane)
  rognerBas: 0,      // bande coupée en bas

  // Les cerveaux possibles. Le modèle se change dans l'appli si besoin.
  cerveaux: {
    claude: {
      nom: "Claude (Anthropic)",
      modele: "claude-opus-5-5",
      cle: "https://console.anthropic.com/settings/keys",
      prix: "Payant à l'usage (crédit prépayé). Un abonnement Claude Pro ne s'utilise pas ici.",
    },
    openai: {
      nom: "ChatGPT (OpenAI)",
      modele: "gpt-5-mini",
      cle: "https://platform.openai.com/api-keys",
      prix: "Payant à l'usage (crédit prépayé). Un abonnement ChatGPT Plus ne s'utilise pas ici.",
    },
    gemini: {
      nom: "Gemini (Google)",
      modele: "gemini-2.5-flash",
      cle: "https://aistudio.google.com/apikey",
      prix: "Formule gratuite avec un quota quotidien. En gratuit, Google peut utiliser les échanges pour améliorer ses modèles.",
    },
    mistral: {
      nom: "Mistral (France)",
      modele: "mistral-small-latest",
      cle: "https://console.mistral.ai/api-keys",
      prix: "Formule d'essai gratuite (« Experiment », numéro de téléphone demandé). Les échanges peuvent servir à entraîner leurs modèles.",
    },
  },

  // Voix « naturelle » en option.
  elevenlabs: {
    cle: "https://elevenlabs.io/app/settings/api-keys",
    modele: "eleven_multilingual_v2",
  },
};
