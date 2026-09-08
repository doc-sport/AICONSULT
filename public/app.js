/* AIConsult — logique du navigateur : enregistrement, transcription, génération et édition du compte rendu. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    status: $("status"),
    btnStart: $("btn-start"), btnPause: $("btn-pause"), btnStop: $("btn-stop"),
    timer: $("rec-timer"), indicator: $("rec-indicator"), support: $("rec-support"), interim: $("interim"),
    audioPanel: $("audio-panel"), audioPlayer: $("audio-player"), audioDownload: $("audio-download"),
    btnTranscribeServer: $("btn-transcribe-server"), audioFile: $("audio-file"),
    transcript: $("transcript"), transcriptCount: $("transcript-count"), btnClearTranscript: $("btn-clear-transcript"),
    notes: $("notes"), contexte: $("contexte"),
    btnGenerate: $("btn-generate"), generateStatus: $("generate-status"), generateError: $("generate-error"),
    reportToolbar: $("report-toolbar"), reportEmpty: $("report-empty"), report: $("report"), reportMeta: $("report-meta"),
    btnCopy: $("btn-copy"), btnDownload: $("btn-download"), btnPrint: $("btn-print"),
    btnNew: $("btn-new"), draftInfo: $("draft-info"),
    privacyDialog: $("privacy-dialog"), privacyList: $("privacy-list"),
    printView: $("print-view"),
  };

  const STORAGE_KEY = "aiconsult.draft";
  const state = { report: null, reportMeta: null, audioBlob: null, audioMime: "", checked: {} };
  let config = { serverTranscription: false, mock: false, model: "" };

  /* ───────────────────────── Configuration serveur ───────────────────────── */
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      config = cfg;
      el.status.textContent = `Rédaction : ${cfg.model}` + (cfg.serverTranscription ? " · transcription serveur disponible" : "");
      el.btnTranscribeServer.hidden = !cfg.serverTranscription;
    })
    .catch(() => { el.status.textContent = "Serveur injoignable"; });

  /* ───────────────────────── Brouillon local ───────────────────────── */
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  }
  function saveDraft() {
    try {
      const draft = {
        transcript: el.transcript.value, notes: el.notes.value, contexte: el.contexte.value,
        report: state.report, reportMeta: state.reportMeta, checked: state.checked, savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      el.draftInfo.textContent = `Brouillon enregistré dans ce navigateur à ${new Date().toLocaleTimeString("fr-FR")}`;
    } catch { /* stockage indisponible : on continue sans brouillon */ }
  }
  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      el.transcript.value = d.transcript || "";
      el.notes.value = d.notes || "";
      el.contexte.value = d.contexte || "";
      state.checked = d.checked || {};
      if (d.report) { state.report = d.report; state.reportMeta = d.reportMeta || null; renderReport(); }
      updateCount();
      if (d.savedAt) el.draftInfo.textContent = `Brouillon restauré (enregistré le ${new Date(d.savedAt).toLocaleString("fr-FR")})`;
    } catch { /* brouillon illisible : ignoré */ }
  }
  function clearAll() {
    if (!confirm("Effacer la transcription, les notes, le compte rendu et le brouillon local ?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignoré */ }
    el.transcript.value = ""; el.notes.value = ""; el.contexte.value = "";
    state.report = null; state.reportMeta = null; state.checked = {};
    state.audioBlob = null;
    el.audioPanel.hidden = true; el.audioPlayer.removeAttribute("src");
    el.generateError.hidden = true; el.draftInfo.textContent = "";
    renderReport(); updateCount();
  }

  /* ───────────────────────── Transcription ───────────────────────── */
  function updateCount() {
    const words = el.transcript.value.trim().split(/\s+/).filter(Boolean).length;
    el.transcriptCount.textContent = `${words} mot${words > 1 ? "s" : ""}`;
  }
  let lastFinalAt = 0;
  function appendTranscript(text) {
    const clean = text.trim();
    if (!clean) return;
    const now = Date.now();
    const current = el.transcript.value;
    let sep = "";
    if (current.length) sep = now - lastFinalAt > 4000 ? "\n" : " ";
    lastFinalAt = now;
    el.transcript.value = current + sep + clean.charAt(0).toUpperCase() + clean.slice(1);
    el.transcript.scrollTop = el.transcript.scrollHeight;
    updateCount(); scheduleSave();
  }

  /* ───────────────────────── Enregistrement ───────────────────────── */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const canDictate = !!SpeechRecognition;

  if (!canRecord && !canDictate) {
    el.support.textContent = "Ce navigateur ne permet ni l'enregistrement ni la dictée. Utilisez Chrome, Edge ou Safari récents, ou collez une transcription.";
    el.btnStart.disabled = true;
  } else if (!canDictate) {
    el.support.textContent = "La reconnaissance vocale n'est pas disponible dans ce navigateur : l'audio sera enregistré, mais la transcription en direct ne fonctionnera pas (Chrome, Edge ou Safari la proposent).";
  } else if (!window.isSecureContext) {
    el.support.textContent = "Le micro n'est accessible qu'en contexte sécurisé (https ou localhost).";
  } else {
    el.support.textContent = "La transcription en direct utilise la reconnaissance vocale du navigateur (français). Parlez distinctement ; vous pourrez corriger le texte.";
  }

  let recorder = null, stream = null, chunks = [], recognition = null;
  let recording = false, paused = false, timerInterval = null, startedAt = 0, accumulatedMs = 0;

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  function tickTimer() { el.timer.textContent = fmtTime(accumulatedMs + (paused ? 0 : Date.now() - startedAt)); }

  function pickMime() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return candidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  }

  function startRecognition() {
    if (!canDictate) return;
    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) appendTranscript(res[0].transcript);
        else interim += res[0].transcript;
      }
      el.interim.textContent = interim;
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        el.support.textContent = "Accès au micro refusé pour la reconnaissance vocale. Autorisez le micro dans le navigateur.";
      } else if (event.error === "network") {
        el.support.textContent = "La reconnaissance vocale du navigateur a perdu la connexion réseau ; l'enregistrement audio continue.";
      }
    };
    // Le navigateur interrompt la reconnaissance après quelques secondes de silence : on la relance tant que l'on enregistre.
    recognition.onend = () => {
      el.interim.textContent = "";
      if (recording && !paused) { try { recognition.start(); } catch { /* déjà relancée */ } }
    };
    try { recognition.start(); } catch { /* ignoré */ }
  }
  function stopRecognition() {
    if (!recognition) return;
    const r = recognition; recognition = null;
    r.onend = null;
    try { r.stop(); } catch { /* ignoré */ }
    el.interim.textContent = "";
  }

  async function startRecording() {
    el.generateError.hidden = true;
    chunks = []; state.audioBlob = null;
    accumulatedMs = 0; paused = false;
    try {
      if (canRecord) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const mimeType = pickMime();
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        state.audioMime = recorder.mimeType || mimeType || "audio/webm";
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = finalizeAudio;
        recorder.start(1000);
      }
    } catch (err) {
      el.support.textContent = "Impossible d'accéder au micro : " + (err && err.message ? err.message : err);
      return;
    }
    recording = true;
    startedAt = Date.now();
    timerInterval = setInterval(tickTimer, 500);
    el.indicator.hidden = false; el.indicator.classList.remove("paused");
    el.btnStart.disabled = true; el.btnPause.disabled = false; el.btnStop.disabled = false;
    el.btnPause.textContent = "‖ Pause";
    lastFinalAt = Date.now();
    startRecognition();
  }

  function togglePause() {
    if (!recording) return;
    if (!paused) {
      paused = true; accumulatedMs += Date.now() - startedAt;
      if (recorder && recorder.state === "recording") recorder.pause();
      stopRecognition();
      el.btnPause.textContent = "▶ Reprendre"; el.indicator.classList.add("paused");
    } else {
      paused = false; startedAt = Date.now();
      if (recorder && recorder.state === "paused") recorder.resume();
      startRecognition();
      el.btnPause.textContent = "‖ Pause"; el.indicator.classList.remove("paused");
    }
    tickTimer();
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    if (!paused) accumulatedMs += Date.now() - startedAt;
    clearInterval(timerInterval); tickTimer();
    stopRecognition();
    if (recorder && recorder.state !== "inactive") recorder.stop(); else finalizeAudio();
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    el.indicator.hidden = true;
    el.btnStart.disabled = false; el.btnPause.disabled = true; el.btnStop.disabled = true;
    el.btnPause.textContent = "‖ Pause";
  }

  function finalizeAudio() {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: state.audioMime || "audio/webm" });
    setAudio(blob, "consultation");
  }
  function setAudio(blob, baseName) {
    state.audioBlob = blob;
    const url = URL.createObjectURL(blob);
    el.audioPlayer.src = url;
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    el.audioDownload.href = url;
    el.audioDownload.download = `${baseName}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`;
    el.audioPanel.hidden = false;
  }

  async function transcribeOnServer() {
    if (!state.audioBlob) return;
    el.btnTranscribeServer.disabled = true;
    const original = el.btnTranscribeServer.textContent;
    el.btnTranscribeServer.textContent = "Transcription en cours…";
    try {
      const form = new FormData();
      form.append("audio", state.audioBlob, "consultation.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      if (el.transcript.value.trim() && !confirm("Remplacer la transcription actuelle par celle du serveur ?")) return;
      el.transcript.value = data.text; updateCount(); scheduleSave();
    } catch (err) {
      showError("Transcription serveur impossible : " + err.message);
    } finally {
      el.btnTranscribeServer.disabled = false;
      el.btnTranscribeServer.textContent = original;
    }
  }

  el.audioFile.addEventListener("change", () => {
    const file = el.audioFile.files && el.audioFile.files[0];
    if (!file) return;
    setAudio(file, file.name.replace(/\.[^.]+$/, ""));
    if (config.serverTranscription) transcribeOnServer();
    else showError("La transcription serveur n'est pas configurée : le fichier est chargé pour écoute uniquement. Dictez ou collez la transcription.");
  });

  /* ───────────────────────── Vérification des données identifiantes ───────────────────────── */
  const IDENTIFIER_PATTERNS = [
    { label: "Civilité suivie d'un nom", re: /\b(?:Monsieur|Madame|Mademoiselle|Mme|Mlle|M\.|Mr|Dr|Docteur)\s+[A-ZÀ-Ý][\wÀ-ÿ'-]{2,}/g },
    { label: "Prénom ou nom annoncé", re: /\b(?:je m'appelle|il s'appelle|elle s'appelle|s'appelle|prénommé[e]?|nommé[e]?)\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+/gi },
    { label: "Date de naissance complète", re: /\b(?:né[e]?\s+le|date de naissance)\s*:?\s*\d{1,2}(?:\s|\/|-|\.)\s*(?:\d{1,2}|[a-zéû]+)(?:\s|\/|-|\.)\s*\d{2,4}/gi },
    { label: "Numéro de téléphone", re: /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}\b/g },
    { label: "Adresse électronique", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
    { label: "Numéro de sécurité sociale", re: /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?\d{2}\s?\d{3}\s?\d{3}(?:\s?\d{2})?\b/g },
    { label: "Adresse postale", re: /\b\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|boulevard|bd|allée|chemin|impasse|place|route)\s+[\wÀ-ÿ' -]{3,}/gi },
  ];
  function detectIdentifiers(text) {
    const found = [];
    for (const { label, re } of IDENTIFIER_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) && found.length < 20) found.push({ label, match: m[0].trim() });
    }
    return found;
  }
  function confirmPrivacy(found) {
    return new Promise((resolve) => {
      el.privacyList.innerHTML = "";
      for (const f of found) {
        const li = document.createElement("li");
        li.innerHTML = `${escapeHtml(f.label)} : <code>${escapeHtml(f.match)}</code>`;
        el.privacyList.appendChild(li);
      }
      el.privacyDialog.addEventListener("close", () => resolve(el.privacyDialog.returnValue === "send"), { once: true });
      el.privacyDialog.showModal();
    });
  }

  /* ───────────────────────── Génération ───────────────────────── */
  function showError(msg) { el.generateError.textContent = msg; el.generateError.hidden = false; }

  async function generate() {
    el.generateError.hidden = true;
    const transcript = el.transcript.value.trim();
    if (transcript.length < 20) { showError("La transcription est vide ou trop courte."); return; }
    const found = detectIdentifiers(transcript + "\n" + el.notes.value);
    if (found.length && !(await confirmPrivacy(found))) { el.transcript.focus(); return; }

    el.btnGenerate.disabled = true;
    el.generateStatus.textContent = "Rédaction du compte rendu en cours (30 s à 2 min selon la longueur)…";
    try {
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, notes: el.notes.value, contexte: el.contexte.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      state.report = data.report;
      state.reportMeta = { model: data.model, generatedAt: new Date().toISOString(), usage: data.usage || null };
      state.checked = {};
      renderReport(); saveDraft();
      el.report.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showError(err.message || "Erreur lors de la génération.");
    } finally {
      el.btnGenerate.disabled = false;
      el.generateStatus.textContent = "";
    }
  }

  /* ───────────────────────── Rendu du compte rendu ───────────────────────── */
  // Structure d'affichage : [clé du chemin, libellé, options]
  const SECTIONS = [
    { title: "Présentation", fields: [["presentation", null, { short: true }]] },
    { title: "Motif de consultation", fields: [["motif_consultation"]] },
    { title: "Antécédents personnels", fields: [["antecedents_personnels"]] },
    { title: "Facteurs de risque cardiovasculaire", fields: [["facteurs_risque_cardiovasculaire"]] },
    { title: "Antécédents familiaux", fields: [["antecedents_familiaux"]] },
    { title: "Mode de vie", fields: [
      ["mode_de_vie.travail_scolarite", "Travail / scolarité"],
      ["mode_de_vie.pratique_sportive.passe_sportif", "Pratique sportive — passé sportif"],
      ["mode_de_vie.pratique_sportive.pratique_actuelle", "Pratique sportive — pratique actuelle ou récente"],
      ["mode_de_vie.autres", "Autres"],
    ] },
    { title: "Histoire de la maladie", fields: [["histoire_maladie"]] },
    { title: "Examen clinique", fields: [
      ["examen_clinique.examen", "Examen"],
      ["examen_clinique.electrocardiogramme", "Électrocardiogramme"],
    ] },
    { title: "Conclusion", fields: [
      ["conclusion.diagnostics", "Diagnostic(s) retenu(s) ou suspecté(s)", { list: true }],
    ] },
    { title: "Conduite à tenir", fields: [
      ["conclusion.conduite_a_tenir.imagerie", "Imagerie"],
      ["conclusion.conduite_a_tenir.kinesitherapie", "Kinésithérapie"],
      ["conclusion.conduite_a_tenir.medicaments", "Médicaments"],
      ["conclusion.conduite_a_tenir.autres_prescriptions", "Autres prescriptions"],
      ["conclusion.conduite_a_tenir.recommandations_pratique_sportive", "Recommandations de pratique sportive"],
      ["conclusion.conduite_a_tenir.autoreeducation", "Auto-rééducation"],
      ["conclusion.conduite_a_tenir.suivi", "Suivi"],
    ] },
  ];

  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split("."); const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
    target[last] = value;
  }
  function autosize(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function renderReport() {
    el.report.innerHTML = "";
    const has = !!state.report;
    el.report.hidden = !has; el.reportEmpty.hidden = has; el.reportToolbar.hidden = !has; el.reportMeta.hidden = !has;
    if (!has) return;
    const r = state.report;

    for (const section of SECTIONS) {
      const sec = document.createElement("section");
      sec.className = "cr-section";
      sec.innerHTML = `<h3>${escapeHtml(section.title)}</h3>`;
      for (const [path, label, opts = {}] of section.fields) {
        const wrap = document.createElement("div");
        wrap.className = label ? "cr-sub" : "";
        if (label) wrap.innerHTML = `<h4>${escapeHtml(label)}</h4>`;
        const ta = document.createElement("textarea");
        ta.rows = 1;
        if (opts.short) ta.className = "short";
        const value = getPath(r, path);
        ta.value = opts.list ? (Array.isArray(value) ? value : []).join("\n") : (value ?? "");
        ta.addEventListener("input", () => {
          setPath(state.report, path, opts.list ? ta.value.split("\n").map((s) => s.trim()).filter(Boolean) : ta.value);
          autosize(ta); scheduleSave();
        });
        wrap.appendChild(ta);
        sec.appendChild(wrap);
      }
      el.report.appendChild(sec);
    }

    // Points à vérifier : liste à cocher, non incluse dans le document final.
    const points = Array.isArray(r.points_a_verifier) ? r.points_a_verifier : [];
    if (points.length) {
      const sec = document.createElement("section");
      sec.className = "cr-section";
      sec.innerHTML = `<h3>Points à vérifier avant validation</h3><p class="hint">Signalés par l'assistant ; cette liste n'est pas reprise dans le compte rendu exporté.</p>`;
      const ul = document.createElement("ul"); ul.className = "checks";
      points.forEach((p, i) => {
        const li = document.createElement("li");
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!state.checked[i];
        const span = document.createElement("span"); span.textContent = p;
        if (cb.checked) li.classList.add("done");
        cb.addEventListener("change", () => { state.checked[i] = cb.checked; li.classList.toggle("done", cb.checked); scheduleSave(); });
        li.append(cb, span); ul.appendChild(li);
      });
      sec.appendChild(ul);
      el.report.appendChild(sec);
    }

    requestAnimationFrame(() => el.report.querySelectorAll("textarea").forEach(autosize));

    const m = state.reportMeta;
    el.reportMeta.textContent = m
      ? `Généré le ${new Date(m.generatedAt).toLocaleString("fr-FR")} · modèle ${m.model}` +
        (m.usage ? ` · ${m.usage.input_tokens} jetons en entrée, ${m.usage.output_tokens} en sortie` : "") +
        " · à relire et valider par le médecin."
      : "";
  }
  window.addEventListener("resize", () => el.report.querySelectorAll("textarea").forEach(autosize));

  /* ───────────────────────── Export ───────────────────────── */
  function reportToMarkdown() {
    const r = state.report; if (!r) return "";
    const date = state.reportMeta ? new Date(state.reportMeta.generatedAt) : new Date();
    const lines = ["# Compte rendu de consultation", `*${date.toLocaleDateString("fr-FR")}*`, ""];
    for (const section of SECTIONS) {
      lines.push(`## ${section.title}`);
      for (const [path, label, opts = {}] of section.fields) {
        const value = getPath(r, path);
        if (label) lines.push(`**${label}**`);
        if (opts.list) { for (const d of (Array.isArray(value) ? value : [])) lines.push(`- ${d}`); }
        else lines.push(value || "Non abordé");
        lines.push("");
      }
    }
    return lines.join("\n").trim() + "\n";
  }
  function reportToPrintHtml() {
    const r = state.report; if (!r) return "";
    const date = state.reportMeta ? new Date(state.reportMeta.generatedAt) : new Date();
    let html = `<h1>Compte rendu de consultation</h1><p class="meta">${date.toLocaleDateString("fr-FR")}</p>`;
    for (const section of SECTIONS) {
      html += `<h2>${escapeHtml(section.title)}</h2>`;
      for (const [path, label, opts = {}] of section.fields) {
        const value = getPath(r, path);
        if (label) html += `<h3>${escapeHtml(label)}</h3>`;
        if (opts.list) html += `<ul>${(Array.isArray(value) ? value : []).map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`;
        else html += `<p>${escapeHtml(value || "Non abordé")}</p>`;
      }
    }
    return html;
  }
  function flash(btn, text) {
    const original = btn.textContent; btn.textContent = text; btn.classList.add("ok");
    setTimeout(() => { btn.textContent = original; btn.classList.remove("ok"); }, 1600);
  }
  async function copyReport() {
    try { await navigator.clipboard.writeText(reportToMarkdown()); flash(el.btnCopy, "Copié ✓"); }
    catch { showError("Copie impossible : le navigateur a refusé l'accès au presse-papiers."); }
  }
  function downloadReport() {
    const blob = new Blob([reportToMarkdown()], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `compte-rendu-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function printReport() {
    el.printView.innerHTML = reportToPrintHtml();
    window.print();
  }

  /* ───────────────────────── Liaison des événements ───────────────────────── */
  el.btnStart.addEventListener("click", startRecording);
  el.btnPause.addEventListener("click", togglePause);
  el.btnStop.addEventListener("click", stopRecording);
  el.btnTranscribeServer.addEventListener("click", transcribeOnServer);
  el.transcript.addEventListener("input", () => { updateCount(); scheduleSave(); });
  el.notes.addEventListener("input", scheduleSave);
  el.contexte.addEventListener("input", scheduleSave);
  el.btnClearTranscript.addEventListener("click", () => {
    if (el.transcript.value && !confirm("Effacer la transcription ?")) return;
    el.transcript.value = ""; updateCount(); scheduleSave();
  });
  el.btnGenerate.addEventListener("click", generate);
  el.btnCopy.addEventListener("click", copyReport);
  el.btnDownload.addEventListener("click", downloadReport);
  el.btnPrint.addEventListener("click", printReport);
  el.btnNew.addEventListener("click", clearAll);
  window.addEventListener("beforeunload", (e) => { if (recording) { e.preventDefault(); e.returnValue = ""; } });

  restoreDraft();
  updateCount();
})();
