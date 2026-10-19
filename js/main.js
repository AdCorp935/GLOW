/* ==========================================================================
   Glow — interactions du site
   Menu, FAQ, formulaire, carrousel des réalisations, effets au défilement
   et au survol.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const EASE = 'cubic-bezier(.2, .7, .2, 1)';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  root.classList.add('js');
  if (!reduceMotion) root.classList.add('motion-ok');

  /* ---------- Planification : une seule passe par image ---------- */

  const scrollTasks = [];
  const measureTasks = [];
  let scrollFrame = 0;
  let measureFrame = 0;

  const runScroll = () => {
    scrollFrame = 0;
    const y = window.scrollY;
    const vh = window.innerHeight;
    scrollTasks.forEach((task) => task(y, vh));
  };
  const remeasure = () => {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measureTasks.forEach((task) => task());
      runScroll();
    });
  };
  const onScroll = (task) => scrollTasks.push(task);
  const onMeasure = (task) => measureTasks.push(task);
  const pageTop = (el) => {
    let y = 0;
    for (let node = el; node; node = node.offsetParent) y += node.offsetTop;
    return y;
  };

  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(runScroll);
  }, { passive: true });
  window.addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);

  initMenu();
  initNav();
  initFaq();
  initContactForm();
  initYear();
  initHighlights();
  initCounters();
  initSteps();
  initMotion();
  initShowcase();
  initMarquee();
  if (finePointer) initSpotlight();
  remeasure();

  /* ---------- Menu mobile ---------- */

  function initMenu() {
    const burger = $('.burger');
    const menu = $('#mobile-menu');
    if (!burger || !menu) return;

    const isOpen = () => !menu.hidden;
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.hidden = !open;
    };

    burger.addEventListener('click', () => setOpen(!isOpen()));
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    $('.nav__cta-mobile')?.addEventListener('click', () => setOpen(false));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        burger.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (isOpen() && !event.target.closest('.site-header')) setOpen(false);
    });

    const desktop = window.matchMedia('(min-width: 901px)');
    desktop.addEventListener('change', () => {
      if (desktop.matches) setOpen(false);
    });
  }

  /* ---------- Navigation : état au défilement et section en cours ---------- */

  function initNav() {
    const header = $('.site-header');
    if (!header) return;
    onScroll((y) => header.classList.toggle('is-scrolled', y > 24));

    const bar = $('.nav__links');
    const indicator = $('.nav__indicator');
    if (!bar || !indicator) return;
    const links = $$('a', bar);
    let active = null;
    let hovered = null;

    // La pastille glisse vers le lien survolé, sinon vers la section en cours
    const place = () => {
      const target = hovered || active;
      if (!target) {
        indicator.style.opacity = '0';
        return;
      }
      const appearing = indicator.style.opacity !== '1';
      if (appearing) indicator.style.transition = 'opacity .3s';
      indicator.style.width = `${target.offsetWidth}px`;
      indicator.style.transform = `translateX(${target.offsetLeft}px)`;
      indicator.style.opacity = '1';
      if (appearing) {
        indicator.getBoundingClientRect();
        indicator.style.transition = '';
      }
    };

    links.forEach((link) => {
      link.addEventListener('mouseenter', () => { hovered = link; place(); });
      link.addEventListener('focus', () => { hovered = link; place(); });
      link.addEventListener('blur', () => { hovered = null; place(); });
    });
    bar.addEventListener('mouseleave', () => { hovered = null; place(); });

    // Section lue : celle qui traverse une fine bande au milieu de l'écran
    const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        active = byId.get(entry.target.id) || null;
        links.forEach((link) => link.classList.toggle('is-active', link === active));
        place();
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('main > section, .site-footer').forEach((section) => spy.observe(section));
    onMeasure(place);
  }

  /* ---------- FAQ : une seule réponse ouverte à la fois ---------- */

  function initFaq() {
    const list = $('.faq-list');
    if (!list) return;
    const items = $$('.faq-item', list);

    const setOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.faq-q', item).setAttribute('aria-expanded', String(open));
      $('.faq-a', item).inert = !open;
    };

    items.forEach((item) => {
      setOpen(item, item.classList.contains('is-open'));
      $('.faq-q', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((other) => setOpen(other, other === item && open));
      });
    });

    // Replie les réponses sans animation au chargement
    list.classList.add('is-enhanced', 'is-instant');
    requestAnimationFrame(() => requestAnimationFrame(() => list.classList.remove('is-instant')));
  }

  /* ---------- Formulaire de contact ---------- */

  function initContactForm() {
    const form = $('#contact-form');
    if (!form) return;

    const success = $('#form-success');
    const successTitle = $('#success-title');
    const successText = $('#success-text');
    const errorBox = $('#form-error');
    const submit = $('.form__submit', form);
    const nameInput = form.elements.namedItem('nom');
    const emailInput = form.elements.namedItem('email');
    const planInput = $('#plan-input');
    const planPill = $('#plan-pill');
    const planName = $('#plan-name');

    // L'attribut action décide du mode d'envoi : mailto: ou service de formulaire
    const action = form.getAttribute('action') || '';
    const mailtoAddress = action.startsWith('mailto:') ? action.slice(7).split('?')[0] : '';
    const contactEmail = ($('a[href^="mailto:"]')?.getAttribute('href') || '').slice(7);

    const setPlan = (plan) => {
      planInput.value = plan;
      planName.textContent = plan;
      planPill.hidden = !plan;
    };
    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = !message;
    };
    const markInvalid = (input, invalid) => {
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    const showForm = () => {
      success.hidden = true;
      form.hidden = false;
    };
    const showSuccess = (title, text) => {
      successTitle.textContent = title;
      successText.textContent = text;
      form.hidden = true;
      success.hidden = false;
      successTitle.focus();
    };

    // Formule choisie depuis la section Tarifs (le lien fait défiler jusqu'au formulaire)
    $$('[data-plan]').forEach((link) => {
      link.addEventListener('click', () => {
        setPlan(link.dataset.plan);
        showError('');
        showForm();
      });
    });
    $('#plan-clear').addEventListener('click', () => setPlan(''));

    // Pastilles : un second clic sur la pastille sélectionnée la désélectionne
    $$('.chip', form).forEach((chip) => {
      const input = $('input', chip);
      chip.addEventListener('click', (event) => {
        if (event.target === input || !input.checked) return;
        event.preventDefault();
        input.checked = false;
      });
    });

    [nameInput, emailInput].forEach((input) => {
      input.addEventListener('input', () => markInvalid(input, false));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('nom') || '').trim();
      const email = String(data.get('email') || '').trim();
      const nameOk = name !== '';
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

      markInvalid(nameInput, !nameOk);
      markInvalid(emailInput, !emailOk);
      if (!nameOk || !emailOk) {
        showError('Indiquez votre nom et une adresse e-mail valide pour que nous puissions vous répondre.');
        (nameOk ? emailInput : nameInput).focus();
        return;
      }
      showError('');

      const firstName = name.split(/\s+/)[0];
      const received = [
        `Merci ${firstName}, votre demande est bien arrivée.`,
        'Nous revenons vers vous sous 24 h ouvrées avec une première estimation.',
      ];

      // Champ piège rempli : sans doute un robot, rien n'est envoyé
      if (data.get('_gotcha')) {
        showSuccess(...received);
        return;
      }

      if (mailtoAddress) {
        window.location.href = buildMailto(mailtoAddress, data);
        showSuccess(
          `Merci ${firstName}, il ne reste plus qu’à envoyer.`,
          `Votre messagerie s’est ouverte avec votre demande pré-remplie. Si rien ne s’est ouvert, écrivez-nous directement à ${mailtoAddress}.`,
        );
        return;
      }

      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(action, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        showSuccess(...received);
      } catch {
        showError(`L’envoi n’a pas abouti. Réessayez dans un instant ou écrivez-nous à ${contactEmail}.`);
      } finally {
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
      }
    });

    $('#form-reset').addEventListener('click', () => {
      form.reset();
      setPlan('');
      showError('');
      markInvalid(nameInput, false);
      markInvalid(emailInput, false);
      showForm();
      nameInput.focus();
    });
  }

  function buildMailto(address, data) {
    const fields = [
      ['Nom', data.get('nom')],
      ['E-mail', data.get('email')],
      ['Type de projet', data.get('type')],
      ['Budget estimé', data.get('budget')],
      ['Formule', data.get('formule')],
    ];
    const lines = fields.filter(([, value]) => value).map(([label, value]) => `${label} : ${value}`);
    const message = String(data.get('message') || '').trim();
    if (message) lines.push('', message);

    const subject = `Demande de devis — ${data.get('nom')}`;
    return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;
  }

  /* ---------- Année du copyright ---------- */

  function initYear() {
    const year = String(new Date().getFullYear());
    $$('[data-year]').forEach((el) => { el.textContent = year; });
  }

  /* ---------- Informations clés : surlignage et chiffres animés ---------- */

  function initHighlights() {
    const marks = $$('.hl');
    if (reduceMotion) {
      marks.forEach((mark) => mark.classList.add('is-lit'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        // Dans le hero, le surlignage attend la fin de l'animation d'entrée
        const delay = entry.target.closest('.hero') ? 1500 : 0;
        setTimeout(() => entry.target.classList.add('is-lit'), delay);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.6 });
    marks.forEach((mark) => observer.observe(mark));
  }

  function initCounters() {
    if (reduceMotion) return;
    const format = (value, decimals) => value.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const el = entry.target;
        const end = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals || 0);
        let start = 0;
        const tick = (now) => {
          if (!start) start = now;
          const progress = Math.min(1, (now - start) / 1600);
          el.textContent = format(end * (1 - Math.pow(1 - progress, 4)), decimals);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.8 });
    $$('[data-count]').forEach((el) => {
      el.textContent = format(0, Number(el.dataset.decimals || 0));
      observer.observe(el);
    });

    // Étoiles de la note moyenne qui s'allument une à une
    const rating = $('.rating');
    if (rating) {
      const starObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        rating.classList.add('is-lit');
        starObserver.disconnect();
      }, { threshold: 1 });
      starObserver.observe(rating);
    }
  }

  /* ---------- Méthode : la frise se remplit au défilement ---------- */

  function initSteps() {
    const steps = $$('.step');
    if (!steps.length) return;
    if (reduceMotion) {
      steps.forEach((step) => {
        step.style.setProperty('--p', '1');
        step.classList.add('is-lit');
      });
      return;
    }
    let layout = [];
    onMeasure(() => {
      const tops = steps.map((step) => pageTop(step));
      // Colonne de chaque étape dans sa rangée, pour un remplissage de gauche à droite
      layout = steps.map((step, i) => ({
        step,
        top: tops[i],
        column: tops.slice(0, i).filter((top) => Math.abs(top - tops[i]) < 4).length,
      }));
    });
    onScroll((y, vh) => layout.forEach(({ step, top, column }) => {
      const progress = clamp((y + vh * 0.82 - top - column * vh * 0.09) / (vh * 0.2), 0, 1);
      step.style.setProperty('--p', progress.toFixed(3));
      step.classList.toggle('is-lit', progress > 0.04);
    }));
  }

  /* ---------- Animations d'entrée, apparitions et parallaxe ---------- */

  function initMotion() {
    if (reduceMotion) return;
    const introPending = root.classList.contains('motion-intro');
    const heroTitle = $('.hero__title');

    // Entrée du hero : navigation, titre mot à mot, textes puis cartes
    if (introPending) {
      const heroWords = heroTitle ? splitWords(heroTitle) : [];
      let delay = 80;
      $$('[data-intro]').forEach((el) => {
        const kind = el.dataset.intro;
        if (el === heroTitle && heroWords.length) {
          heroWords.forEach((word, i) => word.animate(
            [{ opacity: 0, transform: 'translateY(.4em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
            { duration: 1000, delay: delay + i * 60, easing: EASE, fill: 'backwards' },
          ));
          delay += heroWords.length * 60;
          return;
        }
        const keyframes = kind === 'card'
          ? [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }]
          : kind === 'nav'
            ? [{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }]
            : [{ opacity: 0, transform: 'translateY(22px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }];
        el.animate(keyframes, {
          duration: kind === 'card' ? 1200 : 1000,
          delay: delay + (kind === 'card' ? 150 : 0),
          easing: EASE,
          fill: 'backwards',
        });
        delay += 80;
      });
      // La lumière monte du bas du hero et se pose
      $('.hero__glow')?.animate(
        [{ opacity: 0, transform: 'translateY(14%)' }, { opacity: 1, transform: 'none' }],
        { duration: 2200, delay: 100, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' },
      );
      root.classList.remove('motion-intro');
    }

    initReveal();

    // Parallaxe du hero : la lumière défile plus lentement que le texte, lui-même un peu moins
    // vite que la page
    const heroGlow = $('.hero__glow');
    const heroInner = $('.hero__inner');
    const narrow = window.matchMedia('(max-width: 760px)');
    onScroll((y) => {
      if (y > 1800) return;
      if (heroGlow) heroGlow.style.translate = `0 ${(y * (narrow.matches ? 0.06 : 0.18)).toFixed(1)}px`;
      if (heroInner) heroInner.style.transform = `translate3d(0, ${(y * 0.1).toFixed(1)}px, 0)`;
    });

    // Parallaxe des lueurs orange des sections sombres
    const glows = $$('.section-dark__glow').map((el) => ({ el, box: el.parentElement, top: 0, height: 0 }));
    onMeasure(() => glows.forEach((glow) => {
      glow.top = pageTop(glow.box);
      glow.height = glow.box.offsetHeight;
    }));
    onScroll((y, vh) => glows.forEach((glow) => {
      if (y + vh < glow.top || y > glow.top + glow.height) return;
      const progress = (y + vh - glow.top) / (vh + glow.height);
      glow.el.style.translate = `0 ${((0.5 - progress) * 180).toFixed(1)}px`;
    }));

    // Les sections sombres et l'appel à l'action « se posent » en entrant dans l'écran, comme des
    // cartes qu'on empile. Une fois posées, elles perdent toute transformation : le texte reste net.
    const wide = window.matchMedia('(min-width: 900px)');
    const cards = $$('.section-dark, .cta').map((el) => ({ el, top: 0, scale: 1 }));
    onMeasure(() => cards.forEach((card) => { card.top = pageTop(card.el); }));
    onScroll((y, vh) => cards.forEach((card) => {
      const progress = wide.matches ? clamp((y + vh - card.top) / (vh * 0.6), 0, 1) : 1;
      const scale = 1 - 0.04 * (1 - progress) ** 2;
      if (Math.abs(scale - card.scale) < 0.0001) return;
      card.scale = scale;
      card.el.style.transform = scale < 0.9999 ? `scale(${scale.toFixed(4)})` : '';
    }));

    // Notes épinglées de l'appel à l'action : elles dérivent à des vitesses différentes au défilement
    const cta = $('.cta');
    const notes = $$('.cta__note').map((el) => ({ el, depth: Number(el.dataset.depth) || 1 }));
    let ctaTop = 0;
    let ctaHeight = 0;
    if (cta && notes.length) {
      onMeasure(() => {
        ctaTop = pageTop(cta);
        ctaHeight = cta.offsetHeight;
      });
      onScroll((y, vh) => {
        if (y + vh < ctaTop || y > ctaTop + ctaHeight) return;
        const progress = (y + vh - ctaTop) / (vh + ctaHeight);
        notes.forEach(({ el, depth }) => {
          el.style.translate = `0 ${((0.5 - progress) * 44 * depth).toFixed(1)}px`;
        });
      });
    }
  }

  // Apparition des blocs et des titres au défilement. Les éléments qui entrent ensemble dans
  // l'écran se suivent dans l'ordre de lecture ; ceux déjà visibles au chargement ne bougent pas.
  function initReveal() {
    const limit = window.innerHeight * 0.9;
    const pending = new Map();
    const prepare = (el, steps) => {
      steps.forEach(({ animation }) => {
        animation.pause();
        animation.onfinish = () => animation.cancel();
      });
      pending.set(el, steps);
    };

    $$('[data-reveal], [data-split]').forEach((el) => {
      if (el.classList.contains('hero__title')) return;
      const words = 'split' in el.dataset ? splitWords(el) : null;
      if (el.getBoundingClientRect().top < limit) return;
      if (words) {
        prepare(el, words.map((word, i) => ({
          delay: 60 + i * 45,
          animation: word.animate(
            [{ transform: 'translateY(130%)' }, { transform: 'none' }],
            { duration: 1000, easing: EASE, fill: 'both' },
          ),
        })));
        return;
      }
      // Le carrousel monte un peu plus et se pose, comme un écran qu'on présente ; les notes
      // épinglées arrivent depuis leur coin
      const kind = el.dataset.reveal;
      let from = 'translateY(28px)';
      if (kind === 'frame') from = 'translateY(56px) scale(.96)';
      if (kind === 'note') {
        const box = el.getBoundingClientRect();
        const area = el.offsetParent.getBoundingClientRect();
        const dx = Math.sign(box.left + box.width / 2 - (area.left + area.width / 2)) * 70;
        const dy = Math.sign(box.top + box.height / 2 - (area.top + area.height / 2)) * 60;
        from = `translate(${dx}px, ${dy}px) scale(.92)`;
      }
      prepare(el, [{
        delay: kind === 'note' ? 150 : 0,
        animation: el.animate(
          [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
          { duration: kind === 'frame' || kind === 'note' ? 1200 : 900, easing: EASE, fill: 'both' },
        ),
      }]);
    });

    if (!pending.size) return;
    const inReadingOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const observer = new IntersectionObserver((entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort(inReadingOrder)
        .forEach((el, i) => {
          observer.unobserve(el);
          const offset = Math.min(i, 4) * 90;
          pending.get(el)?.forEach(({ animation, delay }) => {
            animation.effect.updateTiming({ delay: offset + delay });
            animation.play();
          });
          pending.delete(el);
        });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    pending.forEach((_, el) => observer.observe(el));

    window.addEventListener('beforeprint', () => {
      pending.forEach((steps) => steps.forEach(({ animation }) => animation.finish()));
      pending.clear();
    });
  }

  // Découpe un titre en mots animables ; le texte complet reste lisible par les lecteurs d'écran
  function splitWords(title) {
    const label = title.textContent.replace(/\s+/g, ' ').trim();
    const fragment = document.createDocumentFragment();
    const words = [];
    const addWord = (content) => {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'split-w';
      outer.setAttribute('aria-hidden', 'true');
      inner.className = 'split-i';
      inner.append(content);
      outer.append(inner);
      fragment.append(outer);
      words.push(inner);
    };
    [...title.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) {
        addWord(node);
        return;
      }
      node.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) fragment.append(' ');
        else addWord(part);
      });
    });
    title.replaceChildren(fragment);
    title.setAttribute('aria-label', label);
    return words;
  }

  /* ---------- Réalisations : carrousel des sites clients ---------- */

  function initShowcase() {
    const showcase = $('.showcase');
    if (!showcase) return;
    const viewport = $('.showcase__viewport', showcase);
    const slides = $$('.showcase__slide', showcase);
    const tabs = $$('.showcase__tab', showcase);
    const details = $$('.showcase__detail', showcase);
    const bars = tabs.map((tab) => $('.showcase__tab-bar span', tab));
    const urlText = $('.showcase__url-text', showcase);
    const counter = $('.showcase__count', showcase);
    const toggle = $('[data-toggle]', showcase);
    const total = slides.length;
    const DURATION = 6500;
    const pad = (n) => String(n).padStart(2, '0');

    let index = 0;
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    let paused = reduceMotion;
    let focused = false;
    let visible = false;
    let introduced = false;

    // Chaque site est dessiné en 1440 × 900 (ou 390 × 760 sur petit écran) puis réduit à la taille du cadre
    const fit = () => {
      const width = viewport.clientWidth;
      if (!width) return;
      const mobile = width < 560;
      const designWidth = mobile ? 390 : 1440;
      viewport.style.setProperty('--dw', designWidth);
      viewport.style.setProperty('--dh', mobile ? 760 : 900);
      viewport.style.setProperty('--ds', (width / designWidth).toFixed(5));
    };
    fit();
    new ResizeObserver(fit).observe(viewport);

    // Polices des sites clients : chargées dans un temps mort après l'arrivée sur la page (leur mise
    // en place ne vient pas saccader le défilement), ou plus tôt si l'on approche déjà du carrousel
    const fontsUrl = showcase.dataset.fonts;
    if (fontsUrl) {
      let fontsRequested = false;
      const loadFonts = () => {
        if (fontsRequested) return;
        fontsRequested = true;
        fontObserver.disconnect();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontsUrl;
        document.head.append(link);
      };
      const fontObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadFonts();
      }, { rootMargin: '1200px 0px' });
      fontObserver.observe(showcase);
      const whenIdle = window.requestIdleCallback
        ? () => requestIdleCallback(loadFonts, { timeout: 3000 })
        : () => setTimeout(loadFonts, 1500);
      if (document.readyState === 'complete') whenIdle();
      else window.addEventListener('load', whenIdle, { once: true });
    }

    // Le site qui arrive « se charge » : titres qui montent, photo qui se pose
    const animateSite = (slide) => {
      if (reduceMotion) return;
      $$('[data-rise]', slide).forEach((el, i) => el.animate(
        [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: 380 + i * 80, easing: EASE, fill: 'backwards' },
      ));
      $$('[data-zoom]', slide).forEach((el) => el.animate(
        [{ transform: 'scale(1.1)' }, { transform: 'none' }],
        { duration: 2000, easing: 'cubic-bezier(.16, 1, .3, 1)' },
      ));
    };

    const setProgress = (value) => {
      bars.forEach((bar, i) => bar.style.setProperty('--progress', i === index ? value.toFixed(4) : '0'));
    };

    const select = (next, direction = 0) => {
      next = (next + total) % total;
      if (next === index) return;
      const from = slides[index];
      const to = slides[next];
      const dir = direction || (next > index ? 1 : -1);

      slides.forEach((slide) => {
        slide.getAnimations().forEach((animation) => animation.finish());
        slide.classList.remove('is-leaving');
      });
      from.classList.remove('is-active');
      to.classList.add('is-active');

      if (!reduceMotion) {
        from.classList.add('is-leaving');
        to.animate(
          [{ clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
          { duration: 1000, easing: 'cubic-bezier(.77, 0, .18, 1)' },
        );
        from.animate(
          [{ transform: 'none', filter: 'brightness(1)' }, { transform: `translateX(${-dir * 8}%) scale(.96)`, filter: 'brightness(.6)' }],
          { duration: 1000, easing: 'cubic-bezier(.77, 0, .18, 1)' },
        ).onfinish = () => from.classList.remove('is-leaving');
        animateSite(to);
        urlText.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' });
      }

      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === next));
        tab.tabIndex = i === next ? 0 : -1;
      });
      details.forEach((detail, i) => detail.classList.toggle('is-active', i === next));
      urlText.textContent = to.dataset.url;
      counter.textContent = `${pad(next + 1)} / ${pad(total)}`;
      index = next;
      elapsed = 0;
      setProgress(paused ? 1 : 0);
    };

    // Défilement automatique, suspendu pendant la navigation au clavier, hors écran ou sur demande
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const delta = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (paused || focused || document.hidden) return;
      elapsed += delta;
      setProgress(Math.min(1, elapsed / DURATION));
      if (elapsed >= DURATION) select(index + 1, 1);
    };

    const setPaused = (value) => {
      paused = value;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Relancer le défilement automatique' : 'Mettre en pause le défilement automatique');
      setProgress(paused ? 1 : Math.min(1, elapsed / DURATION));
    };
    setPaused(paused);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      last = 0;
      if (!visible) return;
      if (!introduced) {
        introduced = true;
        animateSite(slides[index]);
      }
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 }).observe(showcase);

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (event) => {
        const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: total - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        select(moves[event.key], event.key === 'ArrowLeft' ? -1 : 1);
        tabs[index].focus();
      });
    });
    $('[data-prev]', showcase).addEventListener('click', () => select(index - 1, -1));
    $('[data-next]', showcase).addEventListener('click', () => select(index + 1, 1));
    toggle.addEventListener('click', () => setPaused(!paused));

    showcase.addEventListener('focusin', () => { focused = Boolean($(':focus-visible', showcase)); });
    showcase.addEventListener('focusout', (event) => {
      if (!showcase.contains(event.relatedTarget)) focused = false;
    });

    // Balayage horizontal au doigt sur écran tactile ; à la souris, les sites défilent seuls
    let startX = null;
    let startY = 0;
    viewport.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      startX = event.clientX;
      startY = event.clientY;
    });
    viewport.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) select(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    viewport.addEventListener('pointercancel', () => { startX = null; });
  }

  /* ---------- Défilé des références ---------- */

  // Au survol, le défilé ralentit jusqu'à l'arrêt plutôt que de se figer net : on peut lire les noms
  function initMarquee() {
    const marquee = $('.marquee');
    if (!marquee || reduceMotion || !finePointer) return;
    const animations = $$('.marquee__track', marquee).flatMap((track) => track.getAnimations());
    if (!animations.length) return;
    marquee.classList.add('is-enhanced');

    let rate = 1;
    let target = 1;
    let frame = 0;
    const step = () => {
      rate += (target - rate) * 0.1;
      if (Math.abs(target - rate) < 0.01) rate = target;
      animations.forEach((animation) => animation.updatePlaybackRate(rate));
      frame = rate === target ? 0 : requestAnimationFrame(step);
    };
    const slideTo = (value) => {
      target = value;
      if (!frame) frame = requestAnimationFrame(step);
    };
    marquee.addEventListener('pointerenter', () => slideTo(0));
    marquee.addEventListener('pointerleave', () => slideTo(1));
  }

  /* ---------- Cartes éclairées par le pointeur (souris uniquement) ---------- */

  function initSpotlight() {
    let last = null;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const { target, clientX, clientY } = last;
      if (!(target instanceof Element)) return;
      const card = target.closest('.spotlight');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--sx', `${Math.round(clientX - rect.left)}px`);
      card.style.setProperty('--sy', `${Math.round(clientY - rect.top)}px`);
    };
    document.addEventListener('pointermove', (event) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    }, { passive: true });
  }
})();
