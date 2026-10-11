/* The Book of Answers — a small, dependency-free ritual. */
(() => {
  "use strict";

  const answers = window.BookAnswers;
  const $ = (id) => document.getElementById(id);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storage = {
    get(key, fallback) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Private browsing can disable storage. */
      }
    },
  };
  const copy = {
    zh: {
      lang: "zh-CN",
      switchLanguage: "切换到英文",
      title: "答案之书",
      subtitle: "The Book of Answers",
      eyebrow: "留一点时间，给自己",
      heading: "所有答案，\n都始于内心。",
      intro: "有些犹豫，不必急着解开。\n让心安静下来，带着问题翻开这一页。",
      pageLabel: "此刻，给你的答案",
      prompt: "深呼吸，在心中默念你的问题",
      openPrompt: "听听这一句，在你心里留下的回响",
      waiting: "答案正在向你走来…",
      open: "翻开答案",
      close: "合上书本",
      opening: "轻轻翻开…",
      closing: "收好这一页…",
      again: "再问一次",
      openLabel: "翻开答案之书",
      closeLabel: "合上答案之书",
      keyboard: "也可以按空格键翻书",
      touch: "轻触书本，也能找到答案",
      soundOn: "声音开启",
      soundOff: "声音关闭",
      mute: "关闭音效",
      unmute: "开启音效",
      closed: "书本已合上。",
    },
    en: {
      lang: "en",
      switchLanguage: "Switch to Chinese",
      title: "Book of Answers",
      subtitle: "A little room for wonder",
      eyebrow: "A MOMENT, JUST FOR YOU",
      heading: "Every answer\nbegins within.",
      intro:
        "Not every uncertainty needs to be solved today.\nQuiet your mind. Bring a question. Turn a page.",
      pageLabel: "A WORD FOR THIS MOMENT",
      prompt: "Take a breath. Hold your question in mind.",
      openPrompt: "Listen to the echo these words leave within.",
      waiting: "A little clarity is on its way…",
      open: "Open the book",
      close: "Close the book",
      opening: "Turning a page…",
      closing: "Keeping this moment…",
      again: "Ask again",
      openLabel: "Open the Book of Answers",
      closeLabel: "Close the Book of Answers",
      keyboard: "or press Space to turn the page",
      touch: "Tap the book to find your answer",
      soundOn: "Sound on",
      soundOff: "Sound off",
      mute: "Mute sound effects",
      unmute: "Enable sound effects",
      closed: "The book is closed.",
    },
  };

  const savedLanguage = storage.get("book.language", "zh");
  const state = {
    language: Object.hasOwn(copy, savedLanguage) ? savedLanguage : "zh",
    phase: "closed",
    index: -1,
    bag: [],
    sound: storage.get("book.sound", "on") !== "off",
  };

  // One audio graph with a master volume: muting also stops already-ringing notes.
  class SoundEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.voices = new Set();
    }
    ready() {
      if (!state.sound) return false;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        if (!this.context) {
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = 0.34;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === "suspended")
          this.context.resume().catch(() => {});
        return true;
      } catch {
        return false;
      }
    }
    track(source, nodes) {
      this.voices.add(source);
      source.onended = () => {
        this.voices.delete(source);
        source.disconnect();
        nodes.forEach((node) => node.disconnect());
      };
    }
    setEnabled(enabled) {
      if (!enabled) {
        this.voices.forEach((source) => {
          try {
            source.stop();
          } catch {
            /* Already ended. */
          }
        });
      }
      if (this.master)
        this.master.gain.setTargetAtTime(
          enabled ? 0.34 : 0,
          this.context.currentTime,
          0.025,
        );
    }
    tone(frequency, delay = 0, duration = 0.8, volume = 0.12, pan = 0) {
      if (!this.ready()) return;
      const ctx = this.context,
        start = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        stereo = ctx.createStereoPanner();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      stereo.pan.value = pan;
      oscillator.connect(gain).connect(stereo).connect(this.master);
      this.track(oscillator, [gain, stereo]);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
    rustle(delay = 0, duration = 0.5, volume = 0.2, closing = false) {
      if (!this.ready()) return;
      const ctx = this.context,
        start = ctx.currentTime + delay;
      const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const progress = i / data.length;
        data[i] =
          (Math.random() * 2 - 1) *
          Math.sin(Math.PI * progress) *
          (1 - progress);
      }
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter();
      const gain = ctx.createGain(),
        stereo = ctx.createStereoPanner();
      source.buffer = buffer;
      filter.type = closing ? "lowpass" : "bandpass";
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(closing ? 600 : 1600, start);
      filter.frequency.exponentialRampToValueAtTime(
        closing ? 140 : 600,
        start + duration,
      );
      gain.gain.value = volume;
      stereo.pan.setValueAtTime(closing ? -0.4 : 0.45, start);
      stereo.pan.linearRampToValueAtTime(
        closing ? 0.3 : -0.45,
        start + duration,
      );
      source.connect(filter).connect(gain).connect(stereo).connect(this.master);
      this.track(source, [filter, gain, stereo]);
      source.start(start);
      source.stop(start + duration);
    }
    open() {
      this.rustle(0, 0.65, 0.32);
      this.rustle(0.14, 0.4, 0.16);
      this.tone(196, 0, 0.4, 0.09);
    }
    reveal(sentiment) {
      const chords = {
        positive: [392, 493.88, 587.33, 783.99],
        neutral: [349.23, 523.25, 698.46],
        negative: [293.66, 440, 587.33],
      };
      const notes = chords[sentiment] || chords.neutral;
      notes.forEach((note, index) => {
        this.tone(note, index * 0.13, 1.9, 0.115, (index - 1) * 0.22);
        this.tone(note * 2, index * 0.13 + 0.16, 1.3, 0.022, (1 - index) * 0.2);
        this.tone(note, index * 0.13 + 0.32, 1.6, 0.025, 0.3);
      });
    }
    close() {
      this.rustle(0, 0.45, 0.28, true);
      this.tone(130.81, 0.2, 0.3, 0.12);
    }
    click() {
      this.tone(880, 0, 0.16, 0.06);
      this.tone(1320, 0.035, 0.12, 0.025);
    }
  }
  const audio = new SoundEngine();

  // Shuffle once per cycle; all 365 answers appear before any are repeated.
  // Keep the first answer of a new cycle different from the previous answer.
  function nextAnswer() {
    if (!state.bag.length) {
      state.bag = answers.map((_, index) => index);
      for (let i = state.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
      }
      if (state.bag.at(-1) === state.index)
        [state.bag[0], state.bag[state.bag.length - 1]] = [
          state.bag.at(-1),
          state.bag[0],
        ];
    }
    return state.bag.pop();
  }

  function setMultiline(element, text) {
    element.replaceChildren();
    text.split("\n").forEach((line, index) => {
      if (index) element.append(document.createElement("br"));
      element.append(document.createTextNode(line));
    });
  }

  function render() {
    const t = copy[state.language];
    const busy = state.phase === "opening" || state.phase === "closing";
    const open = state.phase === "open";
    document.documentElement.lang = t.lang;
    document.title = `${t.title} · The Book of Answers`;
    document
      .querySelectorAll("[data-i18n]")
      .forEach((element) => setMultiline(element, t[element.dataset.i18n]));
    $("languageToggle").textContent = state.language === "zh" ? "EN" : "中文";
    $("languageToggle").lang = state.language === "zh" ? "en" : "zh-CN";
    $("languageToggle").setAttribute("aria-label", t.switchLanguage);
    $("languageToggle").title = t.switchLanguage;
    $("coverTitle").textContent = t.title;
    $("coverSubtitle").textContent = t.subtitle;
    $("actionLabel").textContent = busy
      ? t[state.phase]
      : open
        ? t.close
        : t.open;
    $("prompt").textContent =
      state.phase === "opening" ? t.waiting : open ? t.openPrompt : t.prompt;
    $("actionButton").disabled = busy;
    $("bookButton").disabled = busy;
    $("againButton").disabled = busy;
    $("againButton").hidden = !open;
    $("bookButton").setAttribute("aria-expanded", String(open));
    $("bookButton").setAttribute(
      "aria-label",
      open ? t.closeLabel : t.openLabel,
    );
    $("answerPage").setAttribute("aria-hidden", String(!open));
    $("soundLabel").textContent = state.sound ? t.soundOn : t.soundOff;
    $("soundIcon").setAttribute(
      "href",
      state.sound ? "#sound-on" : "#sound-off",
    );
    $("soundToggle").setAttribute("aria-pressed", String(state.sound));
    $("soundToggle").setAttribute(
      "aria-label",
      state.sound ? t.mute : t.unmute,
    );
    $("soundToggle").title = state.sound ? t.mute : t.unmute;
    if (state.index >= 0) {
      $("answerText").textContent = answers[state.index][state.language];
      $("pageNumber").textContent = String(state.index + 1).padStart(3, "0");
    }
  }

  function particles(sentiment) {
    if (motion.matches) return;
    const palette = {
      positive: ["#e5cd90", "#f5e8c6"],
      neutral: ["#c0d2c2", "#dfd4ab"],
      negative: ["#b4c8cc", "#d2dbc9"],
    };
    const colors = palette[sentiment] || palette.neutral;
    const count = window.innerWidth < 760 ? 14 : 24;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.style.setProperty("--size", `${1.5 + Math.random() * 3}px`);
      particle.style.setProperty("--sx", `${(Math.random() - 0.5) * 180}px`);
      particle.style.setProperty("--dx", `${(Math.random() - 0.5) * 340}px`);
      particle.style.setProperty("--dy", `${-100 - Math.random() * 150}px`);
      particle.style.setProperty("--duration", `${1.4 + Math.random() * 1.1}s`);
      particle.style.setProperty("--color", colors[i % colors.length]);
      particle.addEventListener("animationend", () => particle.remove(), {
        once: true,
      });
      fragment.append(particle);
    }
    $("particles").replaceChildren(fragment);
  }

  const wait = (duration) =>
    new Promise((resolve) =>
      setTimeout(resolve, motion.matches ? 0 : duration),
    );
  async function openBook() {
    if (state.phase !== "closed") return;
    state.phase = "opening";
    state.index = nextAnswer();
    $("announcement").textContent = "";
    $("scene").classList.add("is-busy", "is-open");
    render();
    audio.open();
    await wait(520);
    audio.reveal(answers[state.index].sentiment);
    particles(answers[state.index].sentiment);
    await wait(650);
    state.phase = "open";
    $("scene").classList.remove("is-busy");
    render();
    $("announcement").textContent = answers[state.index][state.language];
  }

  async function closeBook() {
    if (state.phase !== "open") return;
    state.phase = "closing";
    $("scene").classList.add("is-busy", "is-closing");
    $("scene").classList.remove("is-open");
    $("particles").replaceChildren();
    render();
    audio.close();
    await wait(1100);
    state.phase = "closed";
    $("scene").classList.remove("is-busy", "is-closing");
    render();
    $("announcement").textContent = copy[state.language].closed;
  }

  function toggleBook() {
    if (state.phase === "closed") void openBook();
    else if (state.phase === "open") void closeBook();
  }
  $("bookButton").addEventListener("click", toggleBook);
  $("actionButton").addEventListener("click", toggleBook);
  $("againButton").addEventListener("click", async () => {
    if (state.phase !== "open") return;
    // The secondary button disappears during the transition; retain usable focus.
    $("actionButton").focus();
    await closeBook();
    await openBook();
    $("actionButton").focus();
  });
  $("scene").addEventListener("click", (event) => {
    if (state.phase === "open" && !event.target.closest("button"))
      void closeBook();
  });
  $("languageToggle").addEventListener("click", () => {
    state.language = state.language === "zh" ? "en" : "zh";
    storage.set("book.language", state.language);
    audio.click();
    render();
    if (state.phase === "open")
      $("announcement").textContent = answers[state.index][state.language];
  });
  $("soundToggle").addEventListener("click", () => {
    state.sound = !state.sound;
    storage.set("book.sound", state.sound ? "on" : "off");
    audio.setEnabled(state.sound);
    if (state.sound) audio.click();
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.code !== "Space" ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (
      event.target.closest(
        'button, a, input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    event.preventDefault();
    toggleBook();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && audio.context)
      audio.context.suspend().catch(() => {});
  });
  motion.addEventListener("change", () => {
    if (motion.matches) $("particles").replaceChildren();
  });
  render();
})();
