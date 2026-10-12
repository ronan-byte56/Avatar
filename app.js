// Avatar : un personnage qui parle en visio.
// Appli autonome : chaque personne crée son avatar, choisit son cerveau
// (Claude, ChatGPT, Gemini, Mistral) et sa voix. Tout reste sur son appareil.
(function () {
  "use strict";

  const C = window.AVATAR_CONFIG;
  const $ = (id) => document.getElementById(id);
  const EXPRESSIONS = Object.keys(C.expressions);

  // ---------- Petites aides ----------

  function lire(cle) {
    try { return localStorage.getItem("avatar." + cle); } catch (e) { return null; }
  }
  function ecrire(cle, valeur) {
    try {
      if (valeur === null) localStorage.removeItem("avatar." + cle);
      else localStorage.setItem("avatar." + cle, valeur);
    } catch (e) { /* stockage indisponible */ }
  }
  function attendre(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function hasard(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  // ---------- Stockage sur l'appareil (IndexedDB) ----------
  // Profil, clés et vidéos restent dans le navigateur de la personne.

  let baseOuverte = null;
  function base() {
    if (!baseOuverte) {
      baseOuverte = new Promise((resolve, reject) => {
        const req = indexedDB.open("avatar", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("kv");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return baseOuverte;
  }
  async function stocker(cle, valeur) {
    const db = await base();
    return new Promise((resolve, reject) => {
      const t = db.transaction("kv", "readwrite");
      t.objectStore("kv").put(valeur, cle);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
  async function charger(cle) {
    const db = await base();
    return new Promise((resolve, reject) => {
      const req = db.transaction("kv").objectStore("kv").get(cle);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- Le profil ----------

  let P = null;        // profil de l'avatar et de la personne
  let CLES = {};       // clés API, par service

  const nomAvatar = () => (P && P.nomAvatar) || "ton avatar";
  const prenom = () => (P && P.prenom) || "";
  const appellation = () => (P && (P.appellation || P.prenom)) || "";
  const tu = (formeTu, formeVous) => (!P || P.tutoie !== false ? formeTu : formeVous);
  const e = () => (P && P.genre === "f" ? "e" : "");

  function bullesParDefaut() {
    return tu(
      ["Sur quoi on bosse aujourd'hui ?", "Motive-moi", "Raconte-moi une blague", "Donne-moi une idée"],
      ["Sur quoi travaillons-nous aujourd'hui ?", "Motivez-moi", "Racontez-moi une blague", "Donnez-moi une idée"],
    );
  }

  function phrasesAccueil() {
    const a = appellation();
    return tu([
      { expression: "contentement", texte: "Salut " + a + " ! Content" + e() + " de te voir. Sur quoi on bosse aujourd'hui ?" },
      { expression: "complice", texte: "Tiens, te revoilà, " + a + ". J'espère que tu m'apportes un vrai défi aujourd'hui." },
      { expression: "contentement", texte: "Bonjour " + a + " ! Je t'écoute." },
      { expression: "reflexion", texte: "Bonjour " + a + ". J'ai deux ou trois idées pour aujourd'hui… mais dis-moi d'abord ce qui t'amène." },
    ], [
      { expression: "contentement", texte: "Bonjour " + a + " ! Ravi" + e() + " de vous voir. Sur quoi travaillons-nous aujourd'hui ?" },
      { expression: "complice", texte: "Ah, " + a + ", vous voilà. J'espère que vous m'apportez un vrai défi aujourd'hui." },
      { expression: "contentement", texte: "Bonjour " + a + ". Je suis à votre écoute." },
      { expression: "reflexion", texte: "Bonjour " + a + ". J'ai quelques idées pour aujourd'hui… mais dites-moi d'abord ce qui vous amène." },
    ]);
  }

  // Les consignes données au cerveau à chaque échange.
  function consignes() {
    const p = prenom() || "la personne en face";
    return [
      "Tu es " + nomAvatar() + ", un avatar visuel qui discute en visio avec " + p + ".",
      P.apparence ? "Ton apparence : " + P.apparence : "",
      P.caractere ? "Ton caractère : " + P.caractere : "",
      P.portrait ? "Ce que tu sais de " + p + " : " + P.portrait : "",
      "Style : tu " + tu("tutoies", "vouvoies") + " " + p + ". Quand tu t'adresses à " + p + " par son nom, tu dis « " + appellation() + " ». Tu parles français. C'est une conversation orale en visio : réponds en deux à quatre phrases, sans listes, sans titres, sans mise en forme. Tu n'inventes rien : si tu ne sais pas, tu le dis.",
      p + " te parle souvent à voix haute : ce que tu reçois est la transcription de ce qu'il ou elle dit (elle peut contenir de petites fautes, devine le sens), et tes réponses sont lues par une voix de synthèse. Ne parle donc ni de micro, ni de texte, ni de transcription.",
      "Règle technique 1 : commence CHAQUE réponse par une seule étiquette entre crochets qui indique ta réaction, parmi : [repos] [reflexion] [etonnement] [contentement] [pas_contente] [complice]. [pas_contente] pour une mise en garde, [complice] pour l'humour, [etonnement] pour une surprise, [contentement] pour une bonne nouvelle, [reflexion] quand tu réfléchis à voix haute, [repos] sinon.",
      "Règle technique 2 : termine CHAQUE réponse par une dernière ligne qui commence par « SUGGESTIONS: » suivie de trois ou quatre phrases très courtes (six mots au plus), séparées par « | », que " + p + " pourrait te dire ensuite, écrites à la première personne, comme s'il ou elle te parlait. Cette ligne ne sera ni affichée ni lue.",
    ].filter(Boolean).join("\n\n");
  }

  // ---------- Vidéos et images ----------

  const medias = {}; // pour chaque expression : { url, video } ou null

  async function chargerMedias() {
    for (const nom of EXPRESSIONS) {
      if (medias[nom]) URL.revokeObjectURL(medias[nom].url);
      const m = await charger("media:" + nom).catch(() => null);
      medias[nom] = m && m.blob ? { url: URL.createObjectURL(m.blob), video: m.video } : null;
    }
  }

  async function enregistrerMedia(nom, blob, video) {
    await stocker("media:" + nom, { blob, video });
    if (medias[nom]) URL.revokeObjectURL(medias[nom].url);
    medias[nom] = { url: URL.createObjectURL(blob), video };
    afficherTousMedias();
    if (nom === "repos") { $("absente").hidden = true; if (!expressionCourante || expressionCourante === "repos") montrer("repos", true); }
  }

  function afficherListeMedias(ul, avecAide) {
    ul.innerHTML = "";
    for (const [nom, expr] of Object.entries(C.expressions)) {
      const li = document.createElement("li");
      const bloc = document.createElement("div");
      const etat = document.createElement("span");
      const m = medias[nom];
      if (m && m.video) { etat.className = "ok"; etat.textContent = "✔ " + expr.libelle + " : vidéo"; }
      else if (m) { etat.className = "secours"; etat.textContent = "◐ " + expr.libelle + " : image fixe"; }
      else { etat.className = "manque"; etat.textContent = "✘ " + expr.libelle + (nom === "repos" ? " : indispensable" : " : rien pour l'instant"); }
      bloc.appendChild(etat);
      if (avecAide) {
        const aide = document.createElement("small");
        aide.textContent = expr.aide;
        bloc.appendChild(aide);
      }
      li.appendChild(bloc);

      const actions = document.createElement("div");
      actions.className = "actions-media";
      if (navigator.mediaDevices && window.MediaRecorder) {
        const filmer = document.createElement("button");
        filmer.type = "button";
        filmer.className = "choisir";
        filmer.textContent = "Filmer";
        filmer.onclick = () => ouvrirStudio(nom);
        actions.appendChild(filmer);
      }
      const label = document.createElement("label");
      label.className = "choisir";
      label.appendChild(document.createTextNode(m ? "Remplacer" : "Choisir"));
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "video/*,image/*";
      input.hidden = true;
      input.onchange = () => {
        const f = input.files[0];
        if (f) enregistrerMedia(nom, f, f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
      };
      label.appendChild(input);
      actions.appendChild(label);
      li.appendChild(actions);
      ul.appendChild(li);
    }
  }

  function afficherTousMedias() {
    afficherListeMedias($("etat-medias"), false);
    afficherListeMedias($("ass-medias"), true);
  }

  // ---------- Studio : filmer une expression avec la caméra ----------
  // Le son n'est pas enregistré : les vidéos sont muettes.

  let flux = null, enregistreur = null, filmEnCours = null;

  async function ouvrirStudio(nom) {
    filmEnCours = { nom, blob: null };
    $("studio-titre").textContent = C.expressions[nom].libelle;
    $("studio-consigne").textContent = C.expressions[nom].consigne;
    $("studio-garder").hidden = true;
    $("studio-filmer").hidden = false;
    $("studio-filmer").textContent = "Filmer (" + C.dureeFilm + " s)";
    $("studio-compte").textContent = "";
    $("studio").hidden = false;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } }, audio: false });
      const v = $("studio-video");
      v.srcObject = flux;
      v.classList.add("miroir");
      v.loop = false;
      v.play().catch(() => {});
    } catch (err) {
      $("studio-compte").textContent = "La caméra n'est pas accessible. Autorise-la dans le navigateur, ou utilise « Choisir » pour prendre une vidéo déjà filmée.";
      $("studio-filmer").hidden = true;
    }
  }

  function fermerStudio() {
    if (enregistreur && enregistreur.state === "recording") enregistreur.stop();
    if (flux) flux.getTracks().forEach((t) => t.stop());
    flux = null;
    const v = $("studio-video");
    v.srcObject = null;
    v.removeAttribute("src");
    $("studio").hidden = true;
  }

  async function filmer() {
    if (!flux) return;
    $("studio-filmer").hidden = true;
    $("studio-garder").hidden = true;
    const v = $("studio-video");
    if (!v.srcObject) { v.removeAttribute("src"); v.srcObject = flux; v.classList.add("miroir"); v.play().catch(() => {}); }
    for (const n of [3, 2, 1]) { $("studio-compte").textContent = n + "…"; await attendre(800); }
    const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    const type = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    const morceaux = [];
    enregistreur = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
    enregistreur.ondataavailable = (ev) => { if (ev.data.size) morceaux.push(ev.data); };
    const fini = new Promise((r) => { enregistreur.onstop = r; });
    enregistreur.start();
    for (let s = C.dureeFilm; s > 0; s--) { $("studio-compte").textContent = "On tourne… " + s; await attendre(1000); }
    enregistreur.stop();
    await fini;
    filmEnCours.blob = new Blob(morceaux, { type: enregistreur.mimeType || "video/webm" });
    $("studio-compte").textContent = "Voilà le résultat. Tu le gardes ?";
    v.srcObject = null;
    v.classList.remove("miroir");
    v.src = URL.createObjectURL(filmEnCours.blob);
    v.loop = true;
    v.play().catch(() => {});
    $("studio-filmer").textContent = "Recommencer";
    $("studio-filmer").hidden = false;
    $("studio-garder").hidden = false;
  }

  async function garderFilm() {
    if (!filmEnCours || !filmEnCours.blob) return;
    await enregistrerMedia(filmEnCours.nom, filmEnCours.blob, true);
    fermerStudio();
  }

  // ---------- Affichage du visage ----------

  const calques = [$("calque-a"), $("calque-b")];
  let calqueActif = 0;
  let expressionCourante = null;
  let jeton = 0;

  function montrer(nom, boucle) {
    const m = medias[nom] || (nom !== "repos" ? medias.repos : null);
    if (!m) return Promise.resolve();
    const monJeton = ++jeton;
    expressionCourante = nom;
    $("etiquette").textContent = (medias[nom] ? C.expressions[nom] : C.expressions.repos).libelle;

    const suivant = calques[1 - calqueActif];
    suivant.innerHTML = "";
    let el;
    if (m.video) {
      el = document.createElement("video");
      el.muted = true; // le son des vidéos n'est jamais joué
      el.playsInline = true;
      el.loop = boucle;
      el.src = m.url;
    } else {
      el = document.createElement("img");
      el.alt = "";
      el.src = m.url;
    }
    suivant.appendChild(el);

    const pret = m.video
      ? new Promise((r) => { el.oncanplay = r; el.onerror = r; })
      : new Promise((r) => { el.onload = r; el.onerror = r; });

    return pret.then(() => {
      if (monJeton !== jeton) return;
      if (m.video) el.play().catch(() => {});
      suivant.classList.add("visible");
      calques[calqueActif].classList.remove("visible");
      const ancien = calques[calqueActif];
      calqueActif = 1 - calqueActif;
      setTimeout(() => { if (!ancien.classList.contains("visible")) ancien.innerHTML = ""; }, 500);
      if (boucle) return;
      const max = (m.video ? C.dureeReaction : C.dureeImage) * 1000;
      return new Promise((r) => {
        const t = setTimeout(r, max);
        if (m.video) el.onended = () => { clearTimeout(t); r(); };
      });
    }).then(() => monJeton);
  }

  async function reagir(nom) {
    if (!C.expressions[nom]) nom = "repos";
    if (nom === "repos") { if (expressionCourante !== "repos") montrer("repos", true); return; }
    const monJeton = await montrer(nom, false);
    if (monJeton === jeton) montrer("repos", true);
  }

  // ---------- Voix ----------
  // Deux possibilités : la voix de l'appareil (gratuite) ou ElevenLabs
  // (voix naturelles, avec une clé). Réglages gardés sur l'appareil.

  let voixActive = lire("voix") !== "0";
  const audio = new Audio();
  let audioDeverrouille = false;

  function majBoutonVoix() {
    $("btn-voix").textContent = voixActive ? "🔊" : "🔇";
    $("btn-voix").setAttribute("aria-pressed", String(voixActive));
  }

  function typeVoix() { return lire("typeVoix") === "elevenlabs" && CLES.elevenlabs ? "elevenlabs" : "appareil"; }

  function voixFrancaises() {
    if (!("speechSynthesis" in window)) return [];
    const feminines = /denise|vivienne|eloise|julie|hortense|amelie|am[ée]lie|marie|sylvie|audrey|aurelie|female|femme/i;
    const masculines = /henri|paul|claude|remy|rémy|thomas|nicolas|antoine|alain|male|homme/i;
    const note = (v) =>
      (/natural|online|neural|premium|enhanced/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2) +
      ((P && P.genre === "m" ? masculines : feminines).test(v.name) ? 0 : 0.5);
    return speechSynthesis.getVoices()
      .filter((v) => v.lang && v.lang.toLowerCase().startsWith("fr"))
      .sort((a, b) => note(a) - note(b));
  }

  function voixChoisie() {
    const liste = voixFrancaises();
    return liste.find((v) => v.name === lire("nomVoix")) || liste[0] || null;
  }

  let voixEleven = [];
  async function chargerVoixEleven() {
    if (!CLES.elevenlabs) { voixEleven = []; return; }
    try {
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": CLES.elevenlabs } });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      voixEleven = (d.voices || []).map((v) => ({ id: v.voice_id, nom: v.name + (v.labels && v.labels.gender ? " (" + (v.labels.gender === "female" ? "femme" : v.labels.gender === "male" ? "homme" : v.labels.gender) + ")" : "") }));
      for (const id of ["eleven-etat", "ass-eleven-etat"]) $(id).textContent = voixEleven.length + " voix disponibles.";
    } catch (err) {
      voixEleven = [];
      for (const id of ["eleven-etat", "ass-eleven-etat"]) $(id).textContent = "Clé ElevenLabs refusée ou service injoignable.";
    }
    remplirListesVoix();
  }

  function remplirListesVoix() {
    const eleven = typeVoix() === "elevenlabs";
    for (const id of ["choix-voix", "ass-choix-voix"]) {
      const select = $(id);
      select.innerHTML = "";
      const liste = eleven
        ? voixEleven.map((v) => ({ valeur: v.id, texte: v.nom, choisie: v.id === lire("voixEleven") }))
        : voixFrancaises().map((v) => ({ valeur: v.name, texte: v.name.replace(/^Microsoft /, "").replace(/ - .*$/, ""), choisie: voixChoisie() && v.name === voixChoisie().name }));
      for (const v of liste) {
        const o = document.createElement("option");
        o.value = v.valeur;
        o.textContent = v.texte;
        o.selected = v.choisie;
        select.appendChild(o);
      }
      if (!liste.length) {
        const o = document.createElement("option");
        o.textContent = eleven ? "Aucune voix : vérifie la clé ElevenLabs" : "Aucune voix française sur cet appareil";
        select.appendChild(o);
      }
    }
    for (const nom of ["type-voix", "ass-type-voix"]) {
      for (const r of document.getElementsByName(nom)) r.checked = r.value === (lire("typeVoix") || "appareil");
    }
    for (const cle of ["debit", "hauteur"]) {
      $(cle).value = lire(cle) || 1;
      $("ass-" + cle).value = lire(cle) || 1;
    }
    for (const id of ["cle-elevenlabs", "ass-cle-elevenlabs"]) if (document.activeElement !== $(id)) $(id).value = CLES.elevenlabs || "";
    for (const el of document.querySelectorAll(".si-eleven")) el.hidden = (lire("typeVoix") || "appareil") !== "elevenlabs";
    for (const el of document.querySelectorAll(".si-appareil")) el.hidden = (lire("typeVoix") || "appareil") === "elevenlabs";
  }

  // Sur téléphone, le son ne peut démarrer qu'après un geste : on « réveille »
  // la voix et le lecteur audio à chaque appui.
  function amorcerVoix() {
    if ("speechSynthesis" in window) {
      try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (err) {}
    }
    if (!audioDeverrouille) {
      audio.src = silenceWav();
      audio.play().then(() => { audioDeverrouille = true; }).catch(() => {});
    }
  }

  function silenceWav() {
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, "RIFF"); v.setUint32(4, 36 + n, true); s(8, "WAVE"); s(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    s(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  let minuterieAvis = null;
  function avis(texte) {
    const el = $("avis");
    el.textContent = texte;
    el.hidden = false;
    clearTimeout(minuterieAvis);
    minuterieAvis = setTimeout(() => { el.hidden = true; }, 6000 + texte.length * 60);
  }

  function arreterVoix() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    audio.pause();
  }

  // quandFini : appelé quand l'avatar a fini de parler.
  async function parler(texte, forcer, quandFini) {
    const fin = quandFini || (() => {});
    if (!doitParler() && !forcer) { fin(); return; }
    arreterVoix();
    if (typeVoix() === "elevenlabs") {
      try {
        const id = lire("voixEleven") || (voixEleven[0] && voixEleven[0].id);
        if (!id) throw new Error("pas de voix");
        const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + id, {
          method: "POST",
          headers: { "xi-api-key": CLES.elevenlabs, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text: texte, model_id: C.elevenlabs.modele }),
        });
        if (!r.ok) throw new Error(r.status);
        const blob = await r.blob();
        audio.src = URL.createObjectURL(blob);
        audio.onended = fin;
        audio.onerror = fin;
        await audio.play();
        return;
      } catch (err) {
        alerte("La voix ElevenLabs n'a pas marché (clé, quota ou voix). Je repasse sur la voix de l'appareil.");
      }
    }
    if (!("speechSynthesis" in window)) { avis(texte); fin(); return; }
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = "fr-FR";
    u.rate = Number(lire("debit") || 1);
    u.pitch = Number(lire("hauteur") || 1);
    const v = voixChoisie();
    if (v) u.voice = v;
    let commence = false, fait = false;
    const une = () => { if (!fait) { fait = true; fin(); } };
    u.onstart = () => { commence = true; };
    u.onend = une;
    u.onerror = (err) => {
      if (err && err.error !== "interrupted" && err.error !== "canceled") avis(texte);
      une();
    };
    setTimeout(() => { if (!commence && !fait) avis(texte); }, 3000);
    setTimeout(une, 5000 + texte.length * 90);
    speechSynthesis.speak(u);
  }

  // ---------- Fil de discussion et bulles ----------

  function ajouterMessage(qui, texte) {
    const div = document.createElement("div");
    div.className = "msg " + qui;
    div.textContent = texte;
    $("fil").appendChild(div);
    $("fil").scrollTop = $("fil").scrollHeight;
    return div;
  }

  function alerte(texte) { ajouterMessage("info", texte); avis(texte); }

  function avatarDit(expression, texte, parVoix) {
    ajouterMessage("elle", texte);
    parler(texte, parVoix, parVoix ? reecouter : null);
    reagir(expression);
  }

  function afficherBulles(liste) {
    const zone = $("bulles");
    zone.innerHTML = "";
    for (const texte of liste.slice(0, 4)) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.textContent = texte;
      bouton.onclick = () => { amorcerVoix(); envoyer(texte); };
      zone.appendChild(bouton);
    }
  }

  function bullesActuelles() {
    try { const b = JSON.parse(lire("bulles") || "null"); if (Array.isArray(b) && b.length) return b; } catch (err) {}
    return bullesParDefaut();
  }

  // ---------- Cerveau ----------

  let historique = [];
  try { historique = JSON.parse(lire("historique") || "[]"); } catch (err) { historique = []; }
  let occupee = false;

  function fournisseur() { return (P && P.cerveau && P.cerveau.fournisseur) || "gemini"; }
  function modele() { return (P && P.cerveau && P.cerveau.modele) || C.cerveaux[fournisseur()].modele; }

  function majMode() {
    const f = fournisseur();
    $("mode").textContent = CLES[f] ? C.cerveaux[f].nom.replace(/ \(.*\)$/, "") : "pas de cerveau";
  }

  function decouperReponse(brut) {
    let texte = brut.trim();
    let suggestions = [];
    const s = texte.match(/\n?\s*\**SUGGESTIONS?\**\s*:\s*(.+)\s*$/i);
    if (s) {
      suggestions = s[1].split("|").map((x) => x.trim().replace(/^["«*\s]+|["»*\s]+$/g, "")).filter(Boolean);
      texte = texte.slice(0, s.index).trim();
    }
    let expression = "repos";
    const m = texte.match(/^\s*\[([a-z_]+)\]\s*/i);
    if (m) { expression = m[1].toLowerCase(); texte = texte.slice(m[0].length).trim(); }
    return { expression, texte, suggestions };
  }

  // Un appel au cerveau choisi. messages : [{role: "user"|"assistant", content}].
  // Les modèles changent souvent de nom. Si celui demandé n'existe plus,
  // on demande au service la liste de ses modèles et on prend le plus récent.
  function numeroVersion(nom) {
    return (nom.match(/\d+(\.\d+)?/g) || ["0"]).map(Number).reduce((a, n, i) => a + n / Math.pow(100, i), 0);
  }
  async function modeleDeSecours(f, cle) {
    try {
      if (f === "gemini") {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": cle } });
        const d = await r.json();
        const noms = (d.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => m.name.replace(/^models\//, ""))
          .filter((n) => /flash/.test(n) && !/lite|image|tts|live|audio|embed|exp|preview|thinking/.test(n));
        noms.sort((a, b) => numeroVersion(b) - numeroVersion(a));
        return noms[0] || null;
      }
      if (f === "openai") {
        const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + cle } });
        const d = await r.json();
        const ids = (d.data || []).map((m) => m.id);
        const choix = ids.filter((n) => /^gpt-[\d.]+-mini$/.test(n)).concat(ids.filter((n) => /^gpt-[\d.]+$/.test(n)));
        choix.sort((a, b) => numeroVersion(b) - numeroVersion(a));
        return choix[0] || null;
      }
    } catch (err) { /* liste indisponible */ }
    return null;
  }

  async function appelerCerveau(systeme, messages, f, cle, mod, dejaEssaye) {
    f = f || fournisseur();
    cle = cle || CLES[f];
    mod = mod || modele();
    let url, options, lireTexte;
    if (f === "claude") {
      url = "https://api.anthropic.com/v1/messages";
      options = {
        headers: {
          "content-type": "application/json",
          "x-api-key": cle,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "server-side-fallback-2026-07-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: { model: mod, max_tokens: 4000, system: systeme, messages, output_config: { effort: "low" }, fallbacks: "default" },
      };
      lireTexte = (d) => {
        if (d.stop_reason === "refusal") throw { refus: true };
        return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      };
    } else if (f === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(mod) + ":generateContent";
      options = {
        headers: { "content-type": "application/json", "x-goog-api-key": cle },
        body: {
          systemInstruction: { parts: [{ text: systeme }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        },
      };
      // Réfléchir le moins possible avant de répondre : c'est une conversation, il faut aller vite.
      if (lire("geminiSansNiveau") !== "1") options.body.generationConfig = { thinkingConfig: { thinkingLevel: "minimal" } };
      lireTexte = (d) => ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map((p) => p.text || "").join("");
    } else {
      url = f === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions";
      options = {
        headers: { "content-type": "application/json", Authorization: "Bearer " + cle },
        body: { model: mod, messages: [{ role: "system", content: systeme }, ...messages] },
      };
      lireTexte = (d) => (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
    }
    let r, d;
    // Service surchargé (erreur 500 à 504) : on réessaie deux fois, après une courte pause.
    for (let essai = 0; essai < 3; essai++) {
      try {
        r = await fetch(url, { method: "POST", headers: options.headers, body: JSON.stringify(options.body) });
      } catch (err) {
        throw { message: "Impossible de joindre " + C.cerveaux[f].nom + ". Vérifie la connexion internet." };
      }
      d = await r.json().catch(() => ({}));
      if (r.status < 500 || essai === 2) break;
      await attendre(1500 * (essai + 1));
    }
    if (!r.ok) {
      const detail = (d.error && (d.error.message || d.error)) || d.message || "erreur " + r.status;
      if (r.status >= 500) throw { message: C.cerveaux[f].nom + " est surchargé en ce moment. Réessaie dans une minute." };
      // Ce modèle Gemini n'accepte pas le réglage de réflexion : on l'enlève et on recommence.
      if (f === "gemini" && r.status === 400 && /thinking/i.test(String(detail)) && lire("geminiSansNiveau") !== "1") {
        ecrire("geminiSansNiveau", "1");
        return appelerCerveau(systeme, messages, f, cle, mod, dejaEssaye);
      }
      if (r.status === 401 || r.status === 403) throw { message: "La clé " + C.cerveaux[f].nom + " est refusée. Vérifie-la dans les réglages." };
      if (r.status === 429) throw { message: "Le quota de " + C.cerveaux[f].nom + " est atteint pour le moment. Réessaie plus tard." };
      if (r.status === 404 || (r.status === 400 && /model/i.test(String(detail)))) {
        const autre = !dejaEssaye && (await modeleDeSecours(f, cle));
        if (autre && autre !== mod) {
          const texte = await appelerCerveau(systeme, messages, f, cle, autre, true);
          // Ça a marché avec l'autre modèle : on le garde pour la suite.
          await enregistrerProfil({ cerveau: { fournisseur: f, modele: autre } });
          for (const pre of ["", "ass-"]) if ($(pre + "modele")) $(pre + "modele").value = autre;
          return texte;
        }
        throw { message: "Le modèle « " + mod + " » n'existe pas chez " + C.cerveaux[f].nom + ". Change-le dans les réglages." };
      }
      throw { message: C.cerveaux[f].nom + " a renvoyé une erreur (" + r.status + "). Réessaie ; si ça continue, vérifie la clé et le modèle dans les réglages." };
    }
    const texte = lireTexte(d).trim();
    if (!texte) throw { message: C.cerveaux[f].nom + " n'a rien répondu." };
    return texte;
  }

  async function envoyer(texte, parVoix) {
    texte = texte.trim();
    if (!texte || occupee) return;
    ajouterMessage("moi", texte);
    if (!CLES[fournisseur()]) {
      avatarDit("etonnement", tu("Il me manque mon cerveau : choisis-le et colle sa clé dans les réglages.", "Il me manque mon cerveau : choisissez-le et collez sa clé dans les réglages."), parVoix);
      return;
    }
    occupee = true;
    $("message").disabled = true;
    const attente = ajouterMessage("elle attente", nomAvatar() + " réfléchit…");
    montrer("reflexion", true);
    historique.push({ role: "user", content: texte });
    while (historique.length > 30 || (historique.length && historique[0].role !== "user")) historique.shift();
    try {
      const brut = await appelerCerveau(consignes(), historique);
      const rep = decouperReponse(brut);
      historique.push({ role: "assistant", content: "[" + rep.expression + "] " + rep.texte });
      ecrire("historique", JSON.stringify(historique));
      attente.remove();
      if (rep.suggestions.length) { ecrire("bulles", JSON.stringify(rep.suggestions)); afficherBulles(rep.suggestions); }
      avatarDit(rep.expression, rep.texte, parVoix);
    } catch (err) {
      historique.pop();
      attente.remove();
      avatarDit(err && err.refus ? "pas_contente" : "etonnement",
        err && err.refus ? tu("Je préfère ne pas répondre à celle-là. On parle d'autre chose ?", "Je préfère ne pas répondre à celle-là. Parlons d'autre chose ?")
          : (err && err.message) || "Petit souci technique.", parVoix);
    } finally {
      occupee = false;
      $("message").disabled = false;
    }
  }

  // ---------- Oreilles : conversation à voix haute ----------
  // Un appui sur le micro : l'avatar écoute, répond à voix haute, puis
  // se remet à écouter. Un nouvel appui arrête.

  const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
  let conversation = false, ecoute = null, silences = 0;

  function majMicro(etat) {
    $("btn-micro").classList.toggle("actif", conversation);
    $("btn-micro").classList.toggle("ecoute", etat === "ecoute");
    $("btn-micro").title = conversation ? "Arrêter la conversation" : "Parler à " + nomAvatar();
    $("message").placeholder = etat === "ecoute" ? tu("Je t'écoute…", "Je vous écoute…") : tu("Écris à ", "Écrivez à ") + nomAvatar() + "…";
  }

  function arreterConversation() {
    conversation = false;
    if (ecoute) { try { ecoute.abort(); } catch (err) {} ecoute = null; }
    majMicro("");
  }

  function ecouter() {
    if (!conversation || occupee || ecoute) return;
    const r = new Reconnaissance();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    r.onresult = (ev) => {
      let provisoire = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else provisoire += ev.results[i][0].transcript;
      }
      $("message").value = final + provisoire;
    };
    r.onerror = (ev) => {
      const messages = {
        "not-allowed": "Le micro est bloqué : autorise-le dans le navigateur, puis réessaie.",
        "service-not-allowed": "Le micro est bloqué : autorise-le dans le navigateur, puis réessaie.",
        network: "La reconnaissance vocale a besoin d'internet.",
        "audio-capture": "Je ne trouve pas de micro sur cet appareil.",
      };
      if (messages[ev.error]) { alerte(messages[ev.error]); arreterConversation(); }
    };
    r.onend = () => {
      ecoute = null;
      const texte = final.trim();
      $("message").value = "";
      if (!conversation) return;
      majMicro("");
      if (texte) { silences = 0; envoyer(texte, true); return; }
      if (++silences >= 2) { arreterConversation(); return; }
      ecouter();
    };
    ecoute = r;
    arreterVoix();
    try { r.start(); majMicro("ecoute"); } catch (err) { ecoute = null; }
  }

  function reecouter() { if (conversation) setTimeout(ecouter, 300); }

  // ---------- Découpe du filigrane ----------

  function appliquerRognage() {
    const h = Number(lire("rogneHaut") ?? C.rognerHaut ?? 0) / 100;
    const b = Number(lire("rogneBas") ?? C.rognerBas ?? 0) / 100;
    const reste = Math.max(0.5, 1 - h - b);
    $("cadre").style.aspectRatio = "9 / " + (16 * reste).toFixed(3);
    document.documentElement.style.setProperty("--media-hauteur", (100 / reste) + "%");
    document.documentElement.style.setProperty("--media-haut", (-100 * h / reste) + "%");
    $("rogne-haut").value = Math.round(h * 100);
    $("rogne-bas").value = Math.round(b * 100);
    $("val-haut").textContent = Math.round(h * 100) + " %";
    $("val-bas").textContent = Math.round(b * 100) + " %";
  }

  // ---------- Mode téléphone : vues Visage / Texte ----------

  const ecranEtroit = window.matchMedia("(max-width: 700px)");
  function majCompact() {
    const compact = lire("compact") === "1" || ecranEtroit.matches;
    document.body.classList.toggle("compact", compact);
    const cible = compact ? $("superpose") : $("cadre").parentNode;
    if ($("bulles").parentNode !== cible) cible.appendChild($("bulles"));
    $("btn-compact").setAttribute("aria-pressed", String(lire("compact") === "1"));
  }

  function vue() { return lire("vue") === "texte" ? "texte" : "visage"; }
  function changerVue(v) {
    ecrire("vue", v);
    document.body.dataset.vue = v;
    for (const b of document.querySelectorAll("#onglets button")) b.classList.toggle("actif", b.dataset.vue === v);
    if (v === "texte") arreterVoix();
    $("fil").scrollTop = $("fil").scrollHeight;
  }

  function doitParler() {
    return document.body.classList.contains("compact") ? vue() === "visage" : voixActive;
  }

  function activerGlissement() {
    let x0 = null, y0 = null;
    const zone = $("scene");
    zone.addEventListener("touchstart", (ev) => { x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; }, { passive: true });
    zone.addEventListener("touchend", (ev) => {
      if (x0 === null || !document.body.classList.contains("compact")) return;
      const dx = ev.changedTouches[0].clientX - x0, dy = ev.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) changerVue(vue() === "visage" ? "texte" : "visage");
    });
  }

  // ---------- Assistant de création ----------

  const NB_ETAPES = 6;
  let etape = 1;

  function ouvrirAssistant(n) {
    remplirAssistant();
    $("reglages").hidden = true;
    $("assistant").hidden = false;
    allerEtape(n || 1);
  }

  function remplirAssistant() {
    const p = P || {};
    $("f-nom").value = p.nomAvatar || "";
    $("f-prenom").value = p.prenom || "";
    $("f-appellation").value = p.appellation || "";
    $("f-genre-f").checked = p.genre !== "m";
    $("f-genre-m").checked = p.genre === "m";
    $("f-tu").checked = p.tutoie !== false;
    $("f-vous").checked = p.tutoie === false;
    $("f-apparence").value = p.apparence || "";
    $("f-caractere").value = p.caractere || "Chaleureux, avec un peu d'humour, mais franc et factuel. Ne cherche pas à faire plaisir et n'invente rien.";
    $("f-portrait").value = p.portrait || "";
    remplirCerveau("ass-");
  }

  function nomAvatarSaisi() { return $("f-nom").value.trim() || "ton avatar"; }

  function allerEtape(n) {
    etape = Math.max(1, Math.min(NB_ETAPES, n));
    for (const s of document.querySelectorAll("#assistant .etape")) s.hidden = Number(s.dataset.n) !== etape;
    $("ass-progression").textContent = "Étape " + etape + " sur " + NB_ETAPES;
    $("ass-retour").hidden = etape === 1;
    $("ass-suivant").textContent = etape === NB_ETAPES ? "Terminer" : "Suivant";
    $("ass-erreur").textContent = "";
    for (const el of document.querySelectorAll(".nom-avatar")) el.textContent = nomAvatarSaisi();
    if (etape === 4) afficherTousMedias();
    if (etape === 5) remplirListesVoix();
    if (etape === 6) remplirCerveau("ass-");
  }

  async function etapeSuivante() {
    const erreur = (t) => { $("ass-erreur").textContent = t; };
    if (etape === 1) {
      if (!$("f-nom").value.trim()) return erreur("Donne un nom à ton avatar.");
      if (!$("f-prenom").value.trim()) return erreur("Indique ton prénom.");
    }
    if (etape <= 3) {
      await enregistrerProfil({
        nomAvatar: $("f-nom").value.trim(),
        prenom: $("f-prenom").value.trim(),
        appellation: $("f-appellation").value.trim(),
        genre: $("f-genre-m").checked ? "m" : "f",
        tutoie: !$("f-vous").checked,
        apparence: $("f-apparence").value.trim(),
        caractere: $("f-caractere").value.trim(),
        portrait: $("f-portrait").value.trim(),
      });
    }
    if (etape === 4 && !medias.repos) return erreur("Ajoute au moins « Repos attentif » : c'est le visage de base.");
    if (etape === 6) {
      await lireCerveau("ass-");
      if (!CLES[fournisseur()]) return erreur("Colle la clé de " + C.cerveaux[fournisseur()].nom + " (ou choisis un autre cerveau).");
      await enregistrerProfil({ termine: true });
      $("assistant").hidden = true;
      appliquerProfil();
      accueillir();
      return;
    }
    allerEtape(etape + 1);
  }

  // Bloc « cerveau » (dans l'assistant et dans les réglages), préfixe "ass-" ou "".
  function remplirCerveau(pre) {
    const f = fournisseur();
    for (const r of document.getElementsByName(pre + "fournisseur")) r.checked = r.value === f;
    $(pre + "cle-cerveau").value = CLES[f] || "";
    $(pre + "modele").value = modele();
    majInfosCerveau(pre);
  }

  function fournisseurSaisi(pre) {
    const r = [...document.getElementsByName(pre + "fournisseur")].find((x) => x.checked);
    return r ? r.value : fournisseur();
  }

  function majInfosCerveau(pre) {
    const f = fournisseurSaisi(pre);
    const info = C.cerveaux[f];
    $(pre + "prix").textContent = info.prix;
    const lien = $(pre + "lien-cle");
    lien.href = info.cle;
    lien.textContent = "Créer une clé " + info.nom;
  }

  async function lireCerveau(pre) {
    const f = fournisseurSaisi(pre);
    const cle = $(pre + "cle-cerveau").value.trim();
    if (cle) CLES[f] = cle;
    await stocker("cles", CLES);
    const mod = $(pre + "modele").value.trim() || C.cerveaux[f].modele;
    await enregistrerProfil({ cerveau: { fournisseur: f, modele: mod } });
    majMode();
  }

  async function testerCerveau(pre) {
    const etat = $(pre + "etat-cerveau");
    await lireCerveau(pre);
    const f = fournisseur();
    if (!CLES[f]) { etat.textContent = "Colle d'abord la clé."; return; }
    etat.textContent = "Test en cours…";
    try {
      const t = await appelerCerveau("Tu es " + nomAvatarSaisiOuProfil() + ". Réponds en français, en une phrase courte.", [{ role: "user", content: "Dis bonjour à " + (appellation() || "la personne") + "." }]);
      etat.textContent = "Ça marche. Réponse : « " + t + " »";
    } catch (err) {
      etat.textContent = (err && err.message) || "Le test n'a pas marché.";
    }
  }

  function nomAvatarSaisiOuProfil() { return $("assistant").hidden ? nomAvatar() : nomAvatarSaisi(); }

  async function enregistrerProfil(champs) {
    P = { ...(P || {}), ...champs };
    await stocker("profil", P);
  }

  function appliquerProfil() {
    document.title = P && P.nomAvatar ? P.nomAvatar : "Avatar";
    $("nom").textContent = P && P.nomAvatar ? P.nomAvatar : "Avatar";
    majMicro("");
    $("absente").hidden = !!medias.repos;
    afficherBulles(bullesActuelles());
    afficherTousMedias();
    remplirCerveau("");
    majMode();
  }

  // ---------- Mise en place ----------

  function construireInterface() {
    for (const [nom, expr] of Object.entries(C.expressions)) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.textContent = expr.libelle;
      bouton.onclick = () => reagir(nom);
      $("tests").appendChild(bouton);
    }

    $("saisie").onsubmit = (ev) => {
      ev.preventDefault();
      const t = $("message").value;
      $("message").value = "";
      amorcerVoix();
      envoyer(t);
    };

    if (Reconnaissance) {
      $("btn-micro").onclick = () => {
        amorcerVoix();
        if (conversation) { arreterConversation(); return; }
        conversation = true;
        silences = 0;
        ecouter();
      };
    } else {
      $("btn-micro").hidden = true;
    }

    $("btn-voix").onclick = () => {
      voixActive = !voixActive;
      ecrire("voix", voixActive ? "1" : "0");
      majBoutonVoix();
      if (!voixActive) arreterVoix();
    };

    $("btn-reglages").onclick = () => { remplirCerveau(""); remplirListesVoix(); $("reglages").hidden = false; };
    $("btn-fermer").onclick = () => { $("reglages").hidden = true; };
    $("reglages").onclick = (ev) => { if (ev.target === $("reglages")) $("reglages").hidden = true; };
    $("btn-modifier-avatar").onclick = () => ouvrirAssistant(1);
    $("btn-ouvrir-medias").onclick = () => ouvrirAssistant(P && P.nomAvatar ? 4 : 1);

    $("ass-suivant").onclick = etapeSuivante;
    $("ass-retour").onclick = () => allerEtape(etape - 1);
    $("f-nom").addEventListener("input", () => { for (const el of document.querySelectorAll(".nom-avatar")) el.textContent = nomAvatarSaisi(); });

    // Importer un fichier texte ou Markdown (.md) : son contenu va dans le champ.
    for (const [bouton, champ] of [["import-caractere", "f-caractere"], ["import-portrait", "f-portrait"]]) {
      $(bouton).onchange = async (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        const texte = (await f.text()).trim().slice(0, 30000);
        const zone = $(champ);
        zone.value = zone.value.trim() ? zone.value.trim() + "\n\n" + texte : texte;
        ev.target.value = "";
      };
    }

    // Cerveau
    for (const pre of ["", "ass-"]) {
      for (const r of document.getElementsByName(pre + "fournisseur")) {
        r.onchange = () => {
          const f = fournisseurSaisi(pre);
          $(pre + "cle-cerveau").value = CLES[f] || "";
          $(pre + "modele").value = (P && P.cerveau && P.cerveau.fournisseur === f && P.cerveau.modele) || C.cerveaux[f].modele;
          majInfosCerveau(pre);
        };
      }
      $(pre + "tester-cerveau").onclick = () => testerCerveau(pre);
    }
    $("enregistrer-cerveau").onclick = async () => { await lireCerveau(""); $("etat-cerveau").textContent = "Enregistré."; };

    // Voix
    const phraseTest = () => tu("Bonjour " + appellation() + ", je suis " + nomAvatarSaisiOuProfil() + ". Ma voix te plaît ?", "Bonjour " + appellation() + ", je suis " + nomAvatarSaisiOuProfil() + ". Ma voix vous plaît ?");
    for (const nom of ["type-voix", "ass-type-voix"]) {
      for (const r of document.getElementsByName(nom)) {
        r.onchange = () => { ecrire("typeVoix", r.value); remplirListesVoix(); if (r.value === "elevenlabs") chargerVoixEleven(); };
      }
    }
    for (const id of ["cle-elevenlabs", "ass-cle-elevenlabs"]) {
      $(id).onchange = async (ev) => {
        CLES.elevenlabs = ev.target.value.trim();
        await stocker("cles", CLES);
        chargerVoixEleven();
      };
    }
    for (const id of ["choix-voix", "ass-choix-voix"]) {
      $(id).onchange = (ev) => {
        ecrire(typeVoix() === "elevenlabs" ? "voixEleven" : "nomVoix", ev.target.value);
        remplirListesVoix();
        amorcerVoix();
        parler(phraseTest(), true);
      };
    }
    for (const cle of ["debit", "hauteur"]) {
      for (const id of [cle, "ass-" + cle]) {
        $(id).onchange = (ev) => { ecrire(cle, ev.target.value); remplirListesVoix(); amorcerVoix(); parler(phraseTest(), true); };
      }
    }
    for (const id of ["test-voix", "ass-test-voix"]) $(id).onclick = () => { amorcerVoix(); parler(phraseTest(), true); };
    if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = remplirListesVoix;

    // Studio
    $("studio-filmer").onclick = filmer;
    $("studio-garder").onclick = garderFilm;
    $("studio-fermer").onclick = fermerStudio;

    $("btn-oublier").onclick = () => {
      historique = [];
      ecrire("historique", null);
      ecrire("bulles", null);
      $("fil").innerHTML = "";
      afficherBulles(bullesParDefaut());
      ajouterMessage("info", "Conversation effacée : " + nomAvatar() + " repart de zéro.");
    };

    $("btn-compact").onclick = () => { ecrire("compact", lire("compact") === "1" ? "0" : "1"); majCompact(); };
    ecranEtroit.addEventListener("change", majCompact);

    for (const cote of ["haut", "bas"]) {
      $("rogne-" + cote).oninput = (ev) => { ecrire(cote === "haut" ? "rogneHaut" : "rogneBas", ev.target.value); appliquerRognage(); };
    }

    majBoutonVoix();
    majCompact();
    appliquerRognage();
    changerVue(vue());
    for (const b of document.querySelectorAll("#onglets button")) b.onclick = () => changerVue(b.dataset.vue);
    activerGlissement();
  }

  async function demarrer() {
    construireInterface();
    try {
      P = (await charger("profil")) || null;
      CLES = (await charger("cles")) || {};
      await chargerMedias();
    } catch (err) {
      alerte("Ce navigateur ne permet pas d'enregistrer les réglages (navigation privée ?). L'appli ne pourra rien garder.");
    }
    appliquerProfil();
    remplirListesVoix();
    if (typeVoix() === "elevenlabs") chargerVoixEleven();
    if (P && P.termine && medias.repos) accueillir();
    else ouvrirAssistant(P && P.nomAvatar ? 4 : 1);
  }

  async function accueillir() {
    await montrer("repos", true);
    $("fil").innerHTML = "";
    for (const m of historique) ajouterMessage(m.role === "user" ? "moi" : "elle", m.role === "user" ? m.content : decouperReponse(m.content).texte);
    await attendre(800);
    const accueil = hasard(phrasesAccueil());
    avatarDit(accueil.expression, accueil.texte);
  }

  if ("speechSynthesis" in window) speechSynthesis.getVoices();

  // Appli installable et utilisable hors ligne (sauf le cerveau et la voix ElevenLabs).
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  demarrer();
})();
