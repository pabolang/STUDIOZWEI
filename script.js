(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = doc.querySelector('.intro');
  const introCount = doc.querySelector('.intro-count');
  const progressBar = doc.querySelector('.scroll-progress span');
  const story = doc.querySelector('.identity-story');
  const storyProgress = doc.querySelector('.story-progress');
  const dataField = doc.querySelector('.data-points');
  const dataSection = doc.querySelector('.capability--data');
  const dataSticky = doc.querySelector('.pca-card-sticky');
  const processScroll = doc.querySelector('.process-scroll');
  const processSticky = doc.querySelector('.process-sticky');
  const processSteps = Array.from(doc.querySelectorAll('.process-step'));
  const processCounter = doc.querySelector('.process-counter');
  const chartScrolls = Array.from(doc.querySelectorAll('.chart-scroll')).map((wrap) => {
    const step = wrap.closest('.analysis-step');
    return {
      wrap,
      sticky: wrap.querySelector('.chart-scroll-sticky'),
      figs: Array.from(wrap.querySelectorAll('.chart-figure')),
      counter: wrap.querySelector('.chart-scroll-counter b'),
      questions: step ? Array.from(step.querySelectorAll('.chart-question')) : []
    };
  });
  const pcaScene = doc.querySelector('.pca-scene');
  const gridGroup = doc.querySelector('.pca-grid');
  const linksGroup = doc.querySelector('.pca-links');
  const centroidEls = [doc.querySelector('.pca-centroid--1'), doc.querySelector('.pca-centroid--2')];
  const headerEl = doc.querySelector('.nav-trigger');
  const navHandle = doc.querySelector('.nav-handle');
  const axisEls = {
    x: { line: doc.querySelector('.pca-axis-line--x'), label: doc.querySelector('.pca-axis-label--x') },
    y: { line: doc.querySelector('.pca-axis-line--y'), label: doc.querySelector('.pca-axis-label--y') },
    z: { line: doc.querySelector('.pca-axis-line--z'), label: doc.querySelector('.pca-axis-label--z') }
  };

  // Only the homepage ships the loading splash — other pages (e.g. cv.html)
  // reuse this same script but simply have no `.intro` element to animate.
  if (intro) {
    body.classList.add('is-loading');

    const finishIntro = () => {
      intro.classList.add('is-done');
      body.classList.remove('is-loading');
    };

    if (reducedMotion) {
      finishIntro();
    } else {
      let count = 0;
      const counter = window.setInterval(() => {
        count = Math.min(100, count + 4);
        if (introCount) introCount.textContent = String(count).padStart(2, '0');
        if (count === 100) window.clearInterval(counter);
      }, 35);
      window.setTimeout(finishIntro, 1350);
    }
  }

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
  const easeInOut = (value) => {
    const v = clamp(value);
    return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
  doc.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));

  // --- Adaptive header ----------------------------------------------------
  // The header is fairly transparent, so instead of a fixed light/dark
  // style we sample whatever is actually sitting behind it and flip a
  // data-theme attribute, so its text/border stay legible over every
  // section (paper, blue, ink) without hand-listing section names.
  const parseRgb = (str) => {
    const m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return null;
    const parts = m[1].split(',').map(Number);
    if (parts.length < 3 || parts[3] === 0) return null;
    return parts;
  };
  const relLuminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const updateHeaderTheme = () => {
    if (!headerEl || typeof doc.elementFromPoint !== 'function') return;
    const sampleX = clamp(window.innerWidth / 2, 4, window.innerWidth - 4);
    const sampleY = headerEl.getBoundingClientRect().bottom + 6;
    let el = doc.elementFromPoint(sampleX, sampleY);
    let rgb = null;
    while (el && el !== doc.body && el !== doc.documentElement) {
      rgb = parseRgb(window.getComputedStyle(el).backgroundColor);
      if (rgb) break;
      el = el.parentElement;
    }
    const theme = rgb && relLuminance(rgb) < 0.5 ? 'dark' : 'light';
    if (headerEl.dataset.theme !== theme) headerEl.dataset.theme = theme;
  };

  // --- PCA 3D → 2D scene -------------------------------------------------
  // One shared "camera": every point, axis and grid line is rotated by the
  // same angleY/angleX and pushed through the same perspective divide, so
  // the coordinate axes genuinely turn with the cloud instead of sitting on
  // top of it as static decoration. As projectProgress -> 1 the camera has
  // rotated to look straight at the PC1/PC2 plane, so the axis pointing out
  // of that plane (PC3) naturally foreshortens down to a single point —
  // exactly the "walking the camera onto a flat surface" feeling.
  const project = (x, y, z, angleY, angleX, projectProgress) => {
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const rotatedX = x * cosY + z * sinY;
    const rotatedZ = z * cosY - x * sinY;
    const rotatedY = y * cosX - rotatedZ * sinX;
    const depth = rotatedZ * cosX + y * sinX;
    const perspective = 1 / (1 + (depth + 2.8) * 0.11);
    const px = 50 + rotatedX * 17.5 * perspective;
    const py = 55 + rotatedY * 17.5 * perspective - depth * 5.2 * (1 - projectProgress);
    return { x: px, y: py, depth, perspective };
  };

  const points = [];
  const pointCount = 52;
  const clusterCenters2d = [
    { x: 24, y: 26 },
    { x: 78, y: 76 }
  ];
  if (dataField) {
    for (let i = 0; i < pointCount; i += 1) {
      const point = doc.createElement('span');
      point.className = 'data-point';
      const cluster = i < pointCount / 2 ? 0 : 1;
      point.dataset.cluster = String(cluster + 1);
      const center2d = clusterCenters2d[cluster];
      const angle = i * 2.399963;
      const radius = 1.05 + (i % 5) * 0.32;
      const x3 = Math.cos(angle) * radius + Math.sin(i * 0.71) * 0.5;
      const y3 = ((i % 6) - 2.5) * 0.5 + Math.cos(i * 0.43) * 0.24;
      const z3 = Math.sin(angle) * radius + Math.cos(i * 0.61) * 0.58;
      const local = i % (pointCount / 2);
      const targetAngle = local * 1.71 + cluster * 0.52;
      const targetRadius = 7 + (local % 5) * 2.8;
      const targetX = center2d.x + Math.cos(targetAngle) * targetRadius;
      const targetY = center2d.y + Math.sin(targetAngle * 1.13) * targetRadius;
      point.style.left = '50%';
      point.style.top = '50%';
      dataField.appendChild(point);
      let link = null;
      if (linksGroup) {
        link = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        linksGroup.appendChild(link);
      }
      points.push({ element: point, link, cluster, x3, y3, z3, targetX, targetY });
    }
  }
  if (centroidEls.every(Boolean)) {
    centroidEls.forEach((el, i) => {
      el.setAttribute('r', '4.4');
      el.setAttribute('cx', clusterCenters2d[i].x.toFixed(2));
      el.setAttribute('cy', clusterCenters2d[i].y.toFixed(2));
    });
  }

  // Reference grid spanning the PC1/PC2 plane (z = 0 in local space). Its
  // corners run through the exact same rotation as the point cloud, so it
  // visibly tilts in 3D and settles flat, face-on, right as the points land
  // on their 2D projection.
  const gridExtent = 1.7;
  const gridSteps = [-gridExtent, 0, gridExtent];
  const gridLines = [];
  if (gridGroup) {
    gridSteps.forEach((s) => {
      gridLines.push({ el: null, a: [s, -gridExtent, 0], b: [s, gridExtent, 0] });
      gridLines.push({ el: null, a: [-gridExtent, s, 0], b: [gridExtent, s, 0] });
    });
    gridLines.forEach((entry) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridGroup.appendChild(line);
      entry.el = line;
    });
  }

  const axisSpecs = [
    { key: 'x', tip: [gridExtent, 0, 0] },
    { key: 'y', tip: [0, gridExtent, 0] },
    { key: 'z', tip: [0, 0, gridExtent] }
  ];

  // Static end-state for reduced-motion users: no scroll-jacked camera move,
  // just the resolved 2D scatter with axes/grid hidden.
  const renderStaticPCA = () => {
    if (!dataSection || !points.length) return;
    dataSection.style.setProperty('--pca-progress', '1');
    dataSection.style.setProperty('--pca-project', '1');
    dataSection.style.setProperty('--pca-cluster', '1');
    points.forEach(({ element, cluster, targetX, targetY }) => {
      const clusterRgb = cluster === 0 ? [255, 255, 255] : [16, 17, 15];
      element.style.left = `${targetX}%`;
      element.style.top = `${targetY}%`;
      element.style.transform = 'translate(-50%,-50%) scale(1.2)';
      element.style.opacity = '0.95';
      element.style.backgroundColor = `rgb(${clusterRgb.join(',')})`;
    });
    Object.values(axisEls).forEach(({ line, label }) => {
      if (line) line.style.opacity = '0';
      if (label) label.style.opacity = '0';
    });
    if (gridGroup) gridGroup.style.opacity = '0';
    points.forEach(({ link }) => { if (link) link.style.opacity = '0'; });
    centroidEls.forEach((el) => { if (el) el.style.opacity = '0.85'; });
  };

  // Gentle continuous drift while the PCA scene is on screen but the user
  // isn't actively scrolling — makes the cloud feel alive rather than an
  // inert image, and fades itself out once the camera has flattened onto
  // the 2D projection (idleFactor below), so the final chart stays still.
  let idleActive = false;
  let idleRafId = null;
  const idleTick = (ts) => {
    if (!idleActive) { idleRafId = null; return; }
    updateScroll(ts);
    idleRafId = requestAnimationFrame(idleTick);
  };
  if (dataSection && !reducedMotion) {
    const idleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        idleActive = entry.isIntersecting;
        if (idleActive && idleRafId === null) idleRafId = requestAnimationFrame(idleTick);
      });
    }, { threshold: 0 });
    idleObserver.observe(dataSection);
  }

  let ticking = false;
  const updateScroll = (ts) => {
    const now = typeof ts === 'number' ? ts : performance.now();
    const scrollTop = window.scrollY;
    const total = doc.documentElement.scrollHeight - window.innerHeight;
    const pageProgress = total > 0 ? scrollTop / total : 0;
    progressBar.style.transform = `scaleX(${pageProgress})`;
    updateHeaderTheme();

    if (story) {
      const rect = story.getBoundingClientRect();
      const range = Math.max(1, story.offsetHeight - window.innerHeight);
      const p = clamp(-rect.top / range);
      const drawDot = easeOut(p / 0.06);
      const drawTop = easeOut((p - 0.04) / 0.12);
      const drawRight = easeOut((p - 0.12) / 0.12);
      const drawBottom = easeOut((p - 0.2) / 0.12);
      const drawLeft = easeOut((p - 0.28) / 0.12);
      const drawCurve = easeOut((p - 0.34) / 0.18);
      const word = easeOut((p - 0.44) / 0.18);
      const settle = easeInOut((p - 0.42) / 0.34);
      const equation = easeOut((p - 0.56) / 0.28);
      const logoScale = 1.1 - settle * 0.2;
      const logoY = -settle * 9;
      const iconLift = (1 - word) * 8;
      root.style.setProperty('--story-p', p.toFixed(3));
      root.style.setProperty('--story-word', word.toFixed(3));
      root.style.setProperty('--story-logo-scale', logoScale.toFixed(3));
      root.style.setProperty('--story-logo-y', `${logoY.toFixed(2)}vh`);
      root.style.setProperty('--story-icon-lift', `${iconLift.toFixed(2)}px`);
      root.style.setProperty('--story-draw-dot', drawDot.toFixed(3));
      root.style.setProperty('--story-draw-top', drawTop.toFixed(3));
      root.style.setProperty('--story-draw-right', drawRight.toFixed(3));
      root.style.setProperty('--story-draw-bottom', drawBottom.toFixed(3));
      root.style.setProperty('--story-draw-left', drawLeft.toFixed(3));
      root.style.setProperty('--story-draw-curve', drawCurve.toFixed(3));
      root.style.setProperty('--story-equation', equation.toFixed(3));
      root.style.setProperty('--story-equation-y', `${((1 - equation) * 18).toFixed(2)}vh`);
      storyProgress.textContent = String(Math.round(p * 100)).padStart(2, '0');

      story.classList.remove('phase-one', 'phase-two', 'phase-three', 'phase-blue', 'phase-dark');
      if (p < 0.3) story.classList.add('phase-one');
      else if (p < 0.67) story.classList.add('phase-two', 'phase-blue');
      else story.classList.add('phase-three', 'phase-dark');
    }

    if (!reducedMotion && processScroll && processSticky && processSteps.length) {
      const rect = processScroll.getBoundingClientRect();
      const range = Math.max(1, processScroll.offsetHeight - window.innerHeight);
      const pp = clamp(-rect.top / range);
      processSticky.style.setProperty('--process-p', pp.toFixed(3));
      const activeIndex = Math.min(processSteps.length - 1, Math.floor(pp * processSteps.length));
      processSteps.forEach((step, i) => {
        step.classList.toggle('is-active', i === activeIndex);
        step.classList.toggle('is-done', i < activeIndex);
      });
      if (processCounter) {
        processCounter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(processSteps.length).padStart(2, '0')}`;
      }
    }

    // Multi-chart columns inside an .analysis-step: same pinned-sticky +
    // scroll-progress math as the PCA scatter below, just scoped to one
    // short local wrapper instead of a whole page section. Instead of
    // cross-fading, each chart is continuously translated (1:1 with scroll,
    // no CSS transition — that would just lag behind the finger/wheel) so
    // the next one slides up from below and displaces the current one.
    // Offset is (index - raw): positive while a chart is still waiting
    // below (hasn't arrived yet), zero when it's the active/centered one,
    // negative once it has been pushed up and out. Pixel-based (not %) so
    // the small height gap baked into .chart-figure reads as a real visual
    // gap between consecutive slides instead of them touching edge-to-edge.
    if (!reducedMotion && chartScrolls.length) {
      chartScrolls.forEach(({ wrap, sticky, figs, counter, questions }) => {
        if (!sticky || !figs.length) return;
        const rect = wrap.getBoundingClientRect();
        const stickyTop = parseFloat(window.getComputedStyle(sticky).top) || 0;
        const range = Math.max(1, wrap.offsetHeight - sticky.offsetHeight);
        const progress = clamp((stickyTop - rect.top) / range);
        const raw = progress * Math.max(1, figs.length - 1);
        const stepPx = sticky.offsetHeight;
        figs.forEach((fig, i) => {
          fig.style.transform = `translateY(${((i - raw) * stepPx).toFixed(1)}px)`;
        });
        const activeIndex = Math.min(figs.length - 1, Math.round(raw));
        if (counter) {
          counter.textContent = String(activeIndex + 1).padStart(2, '0');
        }
        if (questions.length) {
          questions.forEach((q, i) => q.classList.toggle('is-active', i === activeIndex));
        }
      });
    }

    if (!reducedMotion && dataSection && dataSticky && points.length) {
      const rect = dataSection.getBoundingClientRect();
      const stickyTop = parseFloat(window.getComputedStyle(dataSticky).top) || 0;
      const range = Math.max(1, dataSection.offsetHeight - dataSticky.offsetHeight);
      const pcaProgress = clamp((stickyTop - rect.top) / range);
      const projectProgress = easeInOut((pcaProgress - 0.28) / 0.38);
      const clusterProgress = easeInOut((pcaProgress - 0.72) / 0.2);
      dataSection.style.setProperty('--pca-progress', pcaProgress.toFixed(3));
      dataSection.style.setProperty('--pca-project', projectProgress.toFixed(3));
      dataSection.style.setProperty('--pca-cluster', clusterProgress.toFixed(3));
      const idleOrbit = (1 - projectProgress) * pcaProgress * 0.55;
      // A slow, self-running sway layered on top of the scroll-driven angle —
      // fades out via (1 - projectProgress) so the resolved 2D chart at the
      // end always sits perfectly still.
      const wobbleFactor = idleActive ? (1 - projectProgress) : 0;
      const wobbleY = Math.sin(now * 0.00055) * 0.14 * wobbleFactor;
      const wobbleX = Math.cos(now * 0.00041) * 0.08 * wobbleFactor;
      const angleY = 1.08 - projectProgress * 1.08 + idleOrbit + wobbleY;
      const angleX = -0.55 + projectProgress * 0.55 + wobbleX;

      points.forEach(({ element, link, cluster, x3, y3, z3, targetX, targetY }, index) => {
        const delayed = easeInOut((pcaProgress - 0.3 - index * 0.0025) / 0.36);
        const proj = project(x3, y3, z3, angleY, angleX, projectProgress);
        const rawX = proj.x;
        const rawY = proj.y;
        const x = rawX + (targetX - rawX) * delayed;
        const y = rawY + (targetY - rawY) * delayed;
        const depthScale = 0.72 + (proj.depth + 2.1) * 0.075;
        const scale = (depthScale * (1 - delayed)) + (1.05 + clusterProgress * 0.18) * delayed;
        const opacity = 0.7 + delayed * 0.25;
        const clusterRgb = cluster === 0 ? [255, 255, 255] : [16, 17, 15];
        const baseRgb = [255, 255, 255];
        const rgb = baseRgb.map((value, channel) => Math.round(value + (clusterRgb[channel] - value) * clusterProgress));
        element.style.left = `${x}%`;
        element.style.top = `${y}%`;
        element.style.transform = `translate(-50%,-50%) scale(${scale})`;
        element.style.opacity = opacity.toFixed(3);
        element.style.backgroundColor = `rgb(${rgb.join(',')})`;
        element.style.zIndex = String(Math.round((proj.depth + 3) * 10));

        if (link) {
          const center2d = clusterCenters2d[cluster];
          const linkOpacity = clamp((clusterProgress - 0.1) * 1.2) * 0.2;
          link.setAttribute('x1', center2d.x.toFixed(2));
          link.setAttribute('y1', center2d.y.toFixed(2));
          link.setAttribute('x2', x.toFixed(2));
          link.setAttribute('y2', y.toFixed(2));
          link.setAttribute('stroke', `rgb(${rgb.join(',')})`);
          link.style.opacity = linkOpacity.toFixed(3);
        }
      });

      if (centroidEls.every(Boolean)) {
        const centroidOpacity = clamp((clusterProgress - 0.35) * 1.8);
        centroidEls.forEach((el) => { el.style.opacity = centroidOpacity.toFixed(3); });
      }

      if (pcaScene) {
        const origin = project(0, 0, 0, angleY, angleX, projectProgress);
        const axisFade = clamp(pcaProgress / 0.12) * (1 - clusterProgress);
        axisSpecs.forEach(({ key, tip }) => {
          const { line, label } = axisEls[key];
          const p = project(tip[0], tip[1], tip[2], angleY, angleX, projectProgress);
          if (line) {
            line.setAttribute('x1', origin.x.toFixed(2));
            line.setAttribute('y1', origin.y.toFixed(2));
            line.setAttribute('x2', p.x.toFixed(2));
            line.setAttribute('y2', p.y.toFixed(2));
            line.style.opacity = axisFade.toFixed(3);
          }
          if (label) {
            const dx = p.x - origin.x;
            const dy = p.y - origin.y;
            label.setAttribute('x', (p.x + dx * 0.16).toFixed(2));
            label.setAttribute('y', (p.y + dy * 0.16).toFixed(2));
            label.style.opacity = axisFade.toFixed(3);
          }
        });

        gridLines.forEach(({ el, a, b }) => {
          const pa = project(a[0], a[1], a[2], angleY, angleX, projectProgress);
          const pb = project(b[0], b[1], b[2], angleY, angleX, projectProgress);
          el.setAttribute('x1', pa.x.toFixed(2));
          el.setAttribute('y1', pa.y.toFixed(2));
          el.setAttribute('x2', pb.x.toFixed(2));
          el.setAttribute('y2', pb.y.toFixed(2));
        });
        if (gridGroup) gridGroup.style.opacity = (0.1 + pcaProgress * 0.09).toFixed(3);
      }
    }

    ticking = false;
  };

  const requestUpdate = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateScroll);
    }
  };

  if (reducedMotion) {
    renderStaticPCA();
  }

  window.addEventListener('scroll', requestUpdate, { passive:true });
  window.addEventListener('resize', requestUpdate);
  updateScroll();

  // Tap-to-open for touch devices (no hover): the handle toggles the bar,
  // outside taps / Escape / picking a link close it again.
  if (headerEl && navHandle) {
    const setOpen = (open) => {
      headerEl.classList.toggle('is-open', open);
      navHandle.setAttribute('aria-expanded', String(open));
    };
    navHandle.addEventListener('click', () => {
      setOpen(!headerEl.classList.contains('is-open'));
    });
    doc.addEventListener('click', (event) => {
      if (headerEl.classList.contains('is-open') && !headerEl.contains(event.target)) setOpen(false);
    });
    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    doc.querySelectorAll('.site-header a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });
  }

  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches) {
    doc.querySelectorAll('.magnetic').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.035;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
        element.style.transform = `translate(${x}px,${y}px)`;
      });
      element.addEventListener('pointerleave', () => { element.style.transform = ''; });
    });
  }
})();
