// =============================================================================
// NewAge I.T. Solution Center - Master Script
// Repair lab motion system: hero canvas, custom cursor, animated counters,
// interactive diagnostic tool, repair tracking, contact form + CMS sync.
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const isFinePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  // =========================================================================
  // 0. Supabase client - anon key only (safe to expose; access is enforced
  //    by Row Level Security policies, see supabase/schema.sql)
  // =========================================================================
  const SUPABASE_URL = window.SUPABASE_CONFIG?.url || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || "";
  const sb =
    window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;
  if (!sb)
    console.warn(
      "Supabase not configured - config.js is missing or empty. See .env.example.",
    );

  // Helper: Escapes HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // 0b. Site content (admin-editable text) - overrides the hardcoded
  //     defaults below only where the admin has actually saved a value, so
  //     the site behaves exactly as before until someone customizes it.
  // =========================================================================
  const SITE_CONTENT_DEFAULTS = {
    contact_phone: "+977 9841301930",
    contact_email: "cyberbhagwati@gmail.com",
  };
  const siteContent = {};

  function getContentPhone() {
    return siteContent.contact_phone || SITE_CONTENT_DEFAULTS.contact_phone;
  }
  function getContentPhoneDigits() {
    return getContentPhone().replace(/\D/g, "") || "9779841301930";
  }
  function getContentEmail() {
    return siteContent.contact_email || SITE_CONTENT_DEFAULTS.contact_email;
  }

  // Updates an element's text without wiping out an icon child
  // (e.g. <a><i class="fa-solid fa-phone"></i> +977 ...</a>).
  function applyContentValue(el, value) {
    const hasIconChild = Array.from(el.children).some((c) => c.tagName === "I");
    if (hasIconChild) {
      const textNode = Array.from(el.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
      );
      if (textNode) textNode.textContent = " " + value;
      else el.appendChild(document.createTextNode(" " + value));
    } else {
      el.textContent = value;
    }
  }

  async function loadSiteContent() {
    if (sb) {
      try {
        const { data, error } = await sb.from("site_content").select("key, value");
        if (error) throw error;
        (data || []).forEach((row) => { siteContent[row.key] = row.value; });
      } catch (e) {
        console.warn("Site content load error:", e);
      }
    }

    document.querySelectorAll("[data-content-key]").forEach((el) => {
      const value = siteContent[el.getAttribute("data-content-key")];
      if (value) applyContentValue(el, value);
    });

    const defaultDigits = "9779841301930";
    const phoneDigits = getContentPhoneDigits();
    if (phoneDigits !== defaultDigits) {
      document.querySelectorAll(`a[href*="${defaultDigits}"]`).forEach((a) => {
        a.setAttribute("href", a.getAttribute("href").split(defaultDigits).join(phoneDigits));
      });
    }

    const email = getContentEmail();
    if (email !== SITE_CONTENT_DEFAULTS.contact_email) {
      document.querySelectorAll(`a[href^="mailto:${SITE_CONTENT_DEFAULTS.contact_email}"]`).forEach((a) => {
        a.setAttribute("href", a.getAttribute("href").replace(SITE_CONTENT_DEFAULTS.contact_email, email));
      });
    }
  }
  loadSiteContent();

  // =========================================================================
  // 1. Navbar: scroll state + mobile menu
  // =========================================================================
  const navbar = document.getElementById("navbar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");
  const navItems = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");

  const handleScroll = () => {
    if (window.scrollY > 30) navbar?.classList.add("scrolled");
    else navbar?.classList.remove("scrolled");

    const scrollPos = window.scrollY + 160;
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute("id");
      if (scrollPos >= top && scrollPos < top + height) {
        navItems.forEach((link) => {
          const href = link.getAttribute("href");
          link.classList.toggle("active", href === `#${id}`);
        });
      }
    });
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle("is-open");
      mobileMenuBtn.classList.toggle("is-open", isOpen);
      mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
    });
    navItems.forEach((link) =>
      link.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        mobileMenuBtn.classList.remove("is-open");
      }),
    );
    document.addEventListener("click", (e) => {
      if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        navLinks.classList.remove("is-open");
        mobileMenuBtn.classList.remove("is-open");
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#" || !targetId) return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    });
  });

  // =========================================================================
  // 1b. Site theme (blue / orange / white) - persisted, no page reload
  // =========================================================================
  const ACCENT_STORAGE_KEY = "NEWAGE_ACCENT_THEME";
  const THEME_ORDER = ["blue", "orange", "white"];
  const ACCENT_RGB_BY_THEME = {
    blue: "47, 111, 237",
    orange: "255, 90, 31",
    white: "47, 111, 237",
  };
  const PARTICLE_RGB_BY_THEME = {
    blue: "245, 245, 245",
    orange: "245, 245, 245",
    white: "35, 38, 43",
  };
  // There are two toggle instances in the markup (top navbar for desktop/
  // tablet, plus one inside the mobile dropdown so the top bar stays narrow
  // enough to not overflow on small phones) - both share the same class and
  // stay in sync.
  const accentToggleBtns = document.querySelectorAll(".accent-toggle");

  let accentTheme = "blue";
  let accentRGB = ACCENT_RGB_BY_THEME.blue;
  let particleRGB = PARTICLE_RGB_BY_THEME.blue;
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (THEME_ORDER.includes(saved)) accentTheme = saved;
  } catch (e) {
    /* localStorage unavailable */
  }

  function applyAccentTheme(theme) {
    accentTheme = theme;
    accentRGB = ACCENT_RGB_BY_THEME[theme];
    particleRGB = PARTICLE_RGB_BY_THEME[theme];
    document.documentElement.setAttribute("data-accent", theme);
    accentToggleBtns.forEach((btn) => {
      btn.querySelectorAll(".accent-toggle-dot").forEach((dot) => {
        dot.classList.toggle(
          "is-active",
          dot.getAttribute("data-accent-option") === theme,
        );
      });
    });
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, theme);
    } catch (e) {
      /* localStorage unavailable */
    }
  }
  applyAccentTheme(accentTheme);

  accentToggleBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const dot = e.target.closest("[data-accent-option]");
      const next = dot
        ? dot.getAttribute("data-accent-option")
        : THEME_ORDER[
            (THEME_ORDER.indexOf(accentTheme) + 1) % THEME_ORDER.length
          ];
      applyAccentTheme(next);
    });
  });

  // =========================================================================
  // 2. Custom cursor (fine pointer only)
  // =========================================================================
  if (isFinePointer && !prefersReducedMotion) {
    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");
    const ringLabel = document.getElementById("cursorRingLabel");
    let ringX = 0,
      ringY = 0,
      mouseX = 0,
      mouseY = 0;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.body.classList.add("cursor-active");
      if (dot) {
        dot.style.left = mouseX + "px";
        dot.style.top = mouseY + "px";
      }
    });

    function ringLoop() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      if (ring) {
        ring.style.left = ringX + "px";
        ring.style.top = ringY + "px";
      }
      requestAnimationFrame(ringLoop);
    }
    requestAnimationFrame(ringLoop);

    document.addEventListener("mouseleave", () =>
      document.body.classList.remove("cursor-active"),
    );

    document.querySelectorAll('[data-cursor="repair"]').forEach((el) => {
      el.addEventListener("mouseenter", () =>
        document.body.classList.add("cursor-hover-crosshair"),
      );
      el.addEventListener("mouseleave", () =>
        document.body.classList.remove("cursor-hover-crosshair"),
      );
    });

    document.querySelectorAll(".workshop-slide").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        document.body.classList.add("cursor-hover-view");
        if (ringLabel) ringLabel.textContent = "VIEW";
      });
      el.addEventListener("mouseleave", () =>
        document.body.classList.remove("cursor-hover-view"),
      );
    });

    // Magnetic buttons
    document
      .querySelectorAll(".btn-solid, .btn-ghost, .btn-track")
      .forEach((btn) => {
        btn.addEventListener("mouseenter", () =>
          document.body.classList.add("cursor-hover-btn"),
        );
        btn.addEventListener("mouseleave", () => {
          document.body.classList.remove("cursor-hover-btn");
          btn.style.transform = "";
        });
        btn.addEventListener("mousemove", (e) => {
          const rect = btn.getBoundingClientRect();
          const relX = e.clientX - rect.left - rect.width / 2;
          const relY = e.clientY - rect.top - rect.height / 2;
          btn.style.transform = `translate(${relX * 0.12}px, ${relY * 0.25}px)`;
        });
      });
  }

  // =========================================================================
  // 3. Hero canvas motion (scan line + PCB nodes + particles)
  // =========================================================================
  const heroCanvas = document.getElementById("heroCanvas");
  if (heroCanvas && !prefersReducedMotion) {
    const ctx = heroCanvas.getContext("2d");
    let w,
      h,
      nodes = [],
      particles = [];

    function resize() {
      w = heroCanvas.width = heroCanvas.offsetWidth * devicePixelRatio;
      h = heroCanvas.height = heroCanvas.offsetHeight * devicePixelRatio;
    }

    function buildNodes() {
      nodes = [];
      const cols = 6,
        rows = 4;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (Math.random() > 0.55) {
            nodes.push({
              x: (w / cols) * i + (w / cols) * 0.5 + (Math.random() - 0.5) * 40,
              y: (h / rows) * j + (h / rows) * 0.5 + (Math.random() - 0.5) * 40,
              r: Math.random() * 1.5 + 0.8,
            });
          }
        }
      }
    }

    function buildParticles() {
      particles = [];
      const count = Math.min(60, Math.floor((w * h) / 90000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: -(Math.random() * 0.15 + 0.05),
          vx: (Math.random() - 0.5) * 0.06,
          r: Math.random() * 1.2 + 0.4,
          a: Math.random() * 0.3 + 0.08,
        });
      }
    }

    resize();
    buildNodes();
    buildParticles();
    window.addEventListener("resize", () => {
      resize();
      buildNodes();
      buildParticles();
    });

    let scanY = 0;
    const scanSpeed = 0.35;

    function draw(t) {
      ctx.clearRect(0, 0, w, h);

      // connecting lines between nearby nodes
      ctx.strokeStyle = `rgba(${accentRGB}, 0.10)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let k = i + 1; k < nodes.length; k++) {
          const dx = nodes[i].x - nodes[k].x,
            dy = nodes[i].y - nodes[k].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < w * 0.18) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[k].x, nodes[k].y);
            ctx.stroke();
          }
        }
      }

      // nodes, lit up near the scan line
      nodes.forEach((n) => {
        const distToScan = Math.abs(n.y - scanY);
        const lit = Math.max(0, 1 - distToScan / (h * 0.12));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * devicePixelRatio * (1 + lit), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentRGB}, ${0.15 + lit * 0.65})`;
        ctx.fill();
      });

      // particles drifting upward
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleRGB}, ${p.a})`;
        ctx.fill();
      });

      // horizontal scan line
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      grad.addColorStop(0, `rgba(${accentRGB}, 0)`);
      grad.addColorStop(0.5, `rgba(${accentRGB}, 0.35)`);
      grad.addColorStop(1, `rgba(${accentRGB}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 40, w, 80);
      ctx.fillStyle = `rgba(${accentRGB}, 0.55)`;
      ctx.fillRect(0, scanY - 0.75, w, 1.5);

      scanY += scanSpeed * devicePixelRatio;
      if (scanY > h + 40) scanY = -40;

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // Floating data labels fade in as the scan line passes near them
    const dataLabels = document.querySelectorAll(".data-label");
    setInterval(() => {
      dataLabels.forEach((label) => {
        if (Math.random() > 0.55) {
          label.classList.add("is-visible");
          setTimeout(() => label.classList.remove("is-visible"), 2200);
        }
      });
    }, 1800);
  } else {
    document
      .querySelectorAll(".data-label")
      .forEach((l) => l.classList.add("is-visible"));
  }

  // =========================================================================
  // 4. Animated stat counters
  // =========================================================================
  const statNumbers = document.querySelectorAll(".stat-number");
  function animateCount(el) {
    const target = Number(el.getAttribute("data-count")) || 0;
    const suffix = el.getAttribute("data-suffix") || "";
    const isStatic = el.getAttribute("data-static-suffix") === "true";
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = isStatic
        ? `${value}${suffix}`
        : `${value.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
      else
        el.textContent = isStatic
          ? `${target}${suffix}`
          : `${target.toLocaleString()}${suffix}`;
    }
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window && statNumbers.length) {
    const statObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            statObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    statNumbers.forEach((el) => statObserver.observe(el));
  }

  // =========================================================================
  // 5. Scroll reveals ([data-reveal] elements)
  // =========================================================================
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add("is-in"), i * 60);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  // =========================================================================
  // 6. Interactive diagnostic tool
  // =========================================================================
  const ISSUES = {
    Laptop: [
      "Not turning on",
      "Overheating",
      "Slow performance",
      "Broken display",
      "Charging problem",
      "Keyboard problem",
    ],
    Desktop: [
      "Not turning on",
      "No display output",
      "Overheating",
      "Random restarts",
      "Slow performance",
      "Strange noises",
    ],
    Mobile: [
      "Cracked screen",
      "Battery drains fast",
      "Not charging",
      "Water damage",
      "Software / app issues",
      "Speaker or mic problem",
    ],
    Printer: [
      "Paper jam",
      "Not printing",
      "Faded print quality",
      "Connectivity issue",
      "Error code on display",
    ],
    TV: [
      "No display / black screen",
      "No sound",
      "Backlight failure",
      "Smart features not working",
      "Physical / screen damage",
    ],
    Other: ["Something not listed here"],
  };

  const DIAGNOSES = {
    "Not turning on":
      "Likely a power delivery or motherboard fault. Requires bench diagnostics.",
    Overheating:
      "Likely dust buildup or dried thermal paste. Requires a clean and re-paste inspection.",
    "Slow performance":
      "Likely a storage, malware, or startup-load issue. Requires a full system inspection.",
    "Broken display":
      "Requires panel or flex-cable replacement. We will confirm the exact part on inspection.",
    "Charging problem":
      "Likely a charging port, cable, or power IC fault. Requires hardware inspection.",
    "Keyboard problem":
      "Likely a key-switch or ribbon cable fault. Requires hardware inspection.",
    "No display output":
      "Likely a GPU, RAM seating, or motherboard fault. Requires bench diagnostics.",
    "Random restarts":
      "Likely a power supply or thermal fault. Requires hardware inspection.",
    "Strange noises":
      "Likely a fan or drive bearing fault. Requires hardware inspection.",
    "Cracked screen":
      "Requires display assembly replacement. We will quote after checking the digitizer.",
    "Battery drains fast":
      "Likely a degraded battery or background software drain. Requires diagnostics.",
    "Not charging":
      "Likely a charging port or battery fault. Requires hardware inspection.",
    "Water damage":
      "Requires immediate corrosion cleaning. Do not power on again until inspected.",
    "Software / app issues":
      "Likely resolved with a software-level fix. Requires a quick diagnostic.",
    "Speaker or mic problem":
      "Likely a connector or component fault. Requires hardware inspection.",
    "Paper jam":
      "Likely a roller or sensor fault. Requires a mechanical inspection.",
    "Not printing":
      "Likely a driver, connectivity, or print-head fault. Requires diagnostics.",
    "Faded print quality":
      "Likely a toner, ink, or print-head issue. Requires inspection.",
    "Connectivity issue":
      "Likely a network or driver-level fault. Requires diagnostics.",
    "Error code on display":
      "Requires inspection to read the exact fault code and part needed.",
    "No display / black screen":
      "Likely a backlight or panel fault. Requires hardware inspection.",
    "No sound":
      "Likely a speaker or audio board fault. Requires hardware inspection.",
    "Backlight failure":
      "Requires backlight strip or driver board replacement.",
    "Smart features not working":
      "Likely a software or motherboard fault. Requires diagnostics.",
    "Physical / screen damage":
      "Requires panel replacement. We will quote after inspection.",
    "Something not listed here":
      "Tell us more in the request below and our technicians will take it from there.",
  };

  const deviceChips = document.querySelectorAll(".device-chip");
  const issueStep = document.getElementById("issueStep");
  const issueList = document.getElementById("issueList");
  const diagnoseResult = document.getElementById("diagnoseResult");
  const diagnoseResultText = document.getElementById("diagnoseResultText");
  const requestDiagnosisBtn = document.getElementById("requestDiagnosisBtn");
  let selectedDevice = "",
    selectedIssue = "";

  deviceChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      deviceChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedDevice = chip.getAttribute("data-device");
      selectedIssue = "";
      if (diagnoseResult) diagnoseResult.hidden = true;

      const issues = ISSUES[selectedDevice] || [];
      if (issueList) {
        issueList.innerHTML = issues
          .map(
            (issue) => `
                    <button type="button" class="issue-option" data-issue="${escapeHtml(issue)}">
                        <span class="radio-dot"></span> ${escapeHtml(issue)}
                    </button>
                `,
          )
          .join("");

        issueList.querySelectorAll(".issue-option").forEach((opt) => {
          opt.addEventListener("click", () => {
            issueList
              .querySelectorAll(".issue-option")
              .forEach((o) => o.classList.remove("active"));
            opt.classList.add("active");
            selectedIssue = opt.getAttribute("data-issue");
            if (diagnoseResultText) {
              diagnoseResultText.textContent =
                DIAGNOSES[selectedIssue] || "Requires hardware inspection.";
            }
            if (diagnoseResult) {
              diagnoseResult.hidden = false;
              diagnoseResult.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "nearest",
              });
            }
          });
        });
      }
      if (issueStep) issueStep.hidden = false;
    });
  });

  requestDiagnosisBtn?.addEventListener("click", () => {
    const contactSection = document.getElementById("contact");
    const messageField = document.getElementById("messageText");
    const serviceField = document.getElementById("serviceType");
    if (messageField) {
      messageField.value = `Device: ${selectedDevice}\nIssue: ${selectedIssue}\nDiagnosis note: ${DIAGNOSES[selectedIssue] || ""}`;
    }
    if (serviceField && selectedDevice) {
      const map = {
        Laptop: "hardware-repair",
        Desktop: "hardware-repair",
        Mobile: "hardware-repair",
        Printer: "tv-printer-inverter",
        TV: "tv-printer-inverter",
        Other: "other",
      };
      serviceField.value = map[selectedDevice] || "other";
    }
    contactSection?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    document.getElementById("senderName")?.focus({ preventScroll: true });
  });

  // =========================================================================
  // 7. Repair stage definitions
  // =========================================================================
  const STAGE_DEFINITIONS = [
    { num: 1, title: "Device Received" },
    { num: 2, title: "Diagnosing" },
    { num: 3, title: "Awaiting Approval" },
    { num: 4, title: "Awaiting Approval" },
    { num: 5, title: "Repairing" },
    { num: 6, title: "Quality Check" },
    { num: 7, title: "Ready for Collection" },
    { num: 8, title: "Ready for Collection" },
  ];
  // Collapsed 6-node display timeline (stage numbers 1-8 map onto 6 visual nodes)
  const TIMELINE_NODES = [
    { label: "Received", stages: [1] },
    { label: "Diagnosing", stages: [2] },
    { label: "Awaiting Approval", stages: [3, 4] },
    { label: "Repairing", stages: [5] },
    { label: "Quality Check", stages: [6] },
    { label: "Ready", stages: [7, 8] },
  ];

  // =========================================================================
  // 8. Track Repair
  // =========================================================================
  const trackForm = document.getElementById("trackForm");
  const trackInput = document.getElementById("trackInput");
  const trackBtn = document.getElementById("trackBtn");
  const trackResult = document.getElementById("trackResult");

  document.querySelectorAll(".sample-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const ticket = chip.getAttribute("data-ticket");
      if (ticket && trackInput) {
        trackInput.value = ticket;
        executeTrackSearch(ticket);
      }
    });
  });

  if (trackForm && trackInput) {
    trackForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = trackInput.value.trim();
      if (query) executeTrackSearch(query);
    });
  }

  async function executeTrackSearch(query) {
    if (!trackResult || !trackBtn) return;
    const originalHtml = trackBtn.innerHTML;
    trackBtn.disabled = true;
    trackBtn.textContent = "Searching...";

    trackResult.hidden = false;
    trackResult.innerHTML = `<div class="repair-card" style="text-align:center;"><p style="color:var(--muted);">Searching records for <strong style="color:#fff;">"${escapeHtml(query)}"</strong>...</p></div>`;

    let foundRecord = null;
    if (sb) {
      try {
        const { data, error } = await sb.rpc("track_repair", {
          p_query: query,
        });
        if (error) throw error;
        if (Array.isArray(data) && data.length) foundRecord = data[0];
      } catch (err) {
        console.warn("Repair lookup error:", err);
      }
    }

    setTimeout(() => {
      trackBtn.disabled = false;
      trackBtn.innerHTML = originalHtml;
      if (foundRecord) renderRepairCard(foundRecord);
      else renderNotFound(query);
      trackResult.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }, 300);
  }

  function renderRepairCard(item) {
    const stage = Number(item.stage) || 1;
    const statusLabel = STAGE_DEFINITIONS[stage - 1]?.title || "In Progress";
    const waMessage = encodeURIComponent(
      `Hello NewAge I.T. Solution Center, I am inquiring about my repair ticket ${item.ticket_id} for my ${item.device}. Could you please update me?`,
    );
    const waLink = `https://wa.me/${getContentPhoneDigits()}?text=${waMessage}`;

    const timelineHtml = TIMELINE_NODES.map((node, idx) => {
      const isDone = node.stages[node.stages.length - 1] < stage;
      const isCurrent = node.stages.includes(stage);
      let cls = "";
      if (isDone) cls = "done";
      else if (isCurrent) cls = "current";
      return `
                <div class="timeline-node ${cls}">
                    <div class="timeline-dot">${isDone ? '<i class="fa-solid fa-check"></i>' : idx + 1}</div>
                    <span class="node-label">${node.label}</span>
                </div>
            `;
    }).join("");

    const completedNodes = TIMELINE_NODES.filter(
      (n) => n.stages[n.stages.length - 1] < stage,
    ).length;
    const progressPct = Math.min(
      100,
      (completedNodes / (TIMELINE_NODES.length - 1)) * 100,
    );

    trackResult.innerHTML = `
            <div class="repair-card">
                <div class="repair-header">
                    <div class="repair-title-group">
                        <h3><i class="fa-solid fa-screwdriver-wrench" style="color:var(--accent);"></i> ${escapeHtml(item.ticket_id)}</h3>
                        <p>${escapeHtml(item.customer_name || "Valued Customer")} &bull; Received ${escapeHtml(item.date_received || "recently")}</p>
                    </div>
                    <span class="status-badge stage-${stage}">Stage ${stage}/8 &middot; ${escapeHtml(statusLabel)}</span>
                </div>

                <div class="timeline-track" style="--progress:${progressPct}%">
                    <div class="timeline-progress" style="width:${progressPct}%"></div>
                    ${timelineHtml}
                </div>

                <div class="repair-grid">
                    <div class="repair-detail-box"><div class="detail-label">Device</div><div class="detail-val">${escapeHtml(item.device || "N/A")}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Reported Issue</div><div class="detail-val">${escapeHtml(item.issue || "Diagnostic required")}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Est. Completion</div><div class="detail-val">${escapeHtml(item.estimated_delivery || "In Progress")}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Cost Quote</div><div class="detail-val" style="color:var(--accent);">${escapeHtml(item.cost || "Quote upon diagnosis")}</div></div>
                </div>

                <div class="tech-note-box">
                    <h4>Technician Notes</h4>
                    <p>${escapeHtml(item.technician_notes || "Device is currently being processed by our technicians.")}</p>
                </div>

                <div class="repair-actions">
                    <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="whatsapp-btn">
                        <i class="fa-brands fa-whatsapp"></i> Ask About This Ticket
                    </a>
                </div>
            </div>
        `;
  }

  function renderNotFound(query) {
    const waLink = `https://wa.me/${getContentPhoneDigits()}?text=${encodeURIComponent("Hello NewAge I.T., I searched for repair ticket or phone: " + query + " but could not find it. Could you please assist me?")}`;
    trackResult.innerHTML = `
            <div class="track-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h4>No repair record found</h4>
                <p>We could not find an active repair matching "${escapeHtml(query)}". Verify the ticket ID on your receipt, or the phone number given at drop-off.</p>
                <div class="track-error-actions">
                    <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-solid"><i class="fa-brands fa-whatsapp"></i> Ask on WhatsApp</a>
                    <a href="tel:+${getContentPhoneDigits()}" class="btn-ghost"><i class="fa-solid fa-phone"></i> Call ${escapeHtml(getContentPhone())}</a>
                </div>
            </div>
        `;
  }

  // =========================================================================
  // 9. Contact form (honeypot + rate-limit + local ticket + Sheets sync)
  // =========================================================================
  const contactForm = document.getElementById("contactForm");
  const submitBtn = document.getElementById("submitBtn");
  const formFeedback = document.getElementById("formFeedback");
  let lastSubmissionTimestamp = 0;

  if (contactForm && submitBtn) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const honeypotVal = document.getElementById("websiteHp")?.value || "";
      if (honeypotVal) {
        if (formFeedback) {
          formFeedback.className = "form-feedback success";
          formFeedback.textContent = "Thank you for reaching out!";
        }
        contactForm.reset();
        return;
      }

      const now = Date.now();
      if (now - lastSubmissionTimestamp < 5000) {
        if (formFeedback) {
          formFeedback.className = "form-feedback error";
          formFeedback.textContent =
            "Please wait a few seconds before submitting another inquiry.";
        }
        return;
      }
      lastSubmissionTimestamp = now;

      const name = document.getElementById("senderName")?.value?.trim() || "";
      const phone = document.getElementById("senderPhone")?.value?.trim() || "";
      const email = document.getElementById("senderEmail")?.value?.trim() || "";
      const service = document.getElementById("serviceType")?.value || "";
      const message =
        document.getElementById("messageText")?.value?.trim() || "";

      if (!name || !phone || !email || !message) {
        if (formFeedback) {
          formFeedback.className = "form-feedback error";
          formFeedback.textContent =
            "Please fill out all required fields, including your phone number.";
        }
        return;
      }

      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Saving &amp; Generating Ticket...';

      const ticketId = `NA-${Math.floor(1000 + Math.random() * 9000)}`;

      let submissionFailed = false;

      if (sb) {
        try {
          const { error: inquiryErr } = await sb.rpc("submit_inquiry", {
            p_ticket_id: ticketId,
            p_customer_name: name,
            p_phone: phone,
            p_email: email,
            p_service: service,
            p_message: message,
          });
          if (inquiryErr) throw inquiryErr;
        } catch (err) {
          console.warn("Inquiry insert error:", err);
          submissionFailed = true;
        }

        try {
          const { error: repairErr } = await sb.rpc("submit_repair", {
            p_ticket_id: ticketId,
            p_customer_name: name,
            p_phone: phone,
            p_device:
              service === "hardware-repair"
                ? "Device Repair Request"
                : service === "custom-build"
                  ? "Custom PC Build Order"
                  : "IT Service Inquiry",
            p_issue: message,
          });
          if (repairErr) throw repairErr;
        } catch (err) {
          console.warn("Repair ticket insert error:", err);
          submissionFailed = true;
        }
      }

      if (submissionFailed) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        if (formFeedback) {
          formFeedback.className = "form-feedback error";
          formFeedback.textContent =
            "We could not log your inquiry right now. Please try again shortly or reach us directly on WhatsApp.";
        }
        return;
      }

      const waText = encodeURIComponent(
        `Hello NewAge I.T. Solution Center, I just submitted an inquiry on your website!\n\nTicket ID: ${ticketId}\nName: ${name}\nPhone: ${phone}\nService: ${service}\nMessage: ${message}`,
      );
      const waUrl = `https://wa.me/${getContentPhoneDigits()}?text=${waText}`;

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        if (formFeedback) {
          formFeedback.className = "form-feedback success";
          formFeedback.innerHTML = `
                        <strong>Inquiry logged.</strong> Your tracking reference is
                        <strong style="font-family: var(--font-mono); color: var(--accent);">${ticketId}</strong>.
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                            <button type="button" id="quickTrackBtn" class="btn-solid" style="padding:8px 16px; font-size:0.85rem;">Track ${ticketId}</button>
                            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-ghost" style="padding:8px 16px; font-size:0.85rem;">Confirm on WhatsApp</a>
                        </div>
                    `;
          document
            .getElementById("quickTrackBtn")
            ?.addEventListener("click", () => {
              const trackSection = document.getElementById("repairs");
              if (trackInput && trackSection) {
                trackInput.value = ticketId;
                trackSection.scrollIntoView({
                  behavior: prefersReducedMotion ? "auto" : "smooth",
                });
                executeTrackSearch(ticketId);
              }
            });
        }
        contactForm.reset();
      }, 350);
    });
  }

  // =========================================================================
  // 10. Custom PC parallax
  // =========================================================================
  const pcDiagram = document.getElementById("pcDiagram");
  if (pcDiagram && isFinePointer && !prefersReducedMotion) {
    const specLabels = pcDiagram.querySelectorAll(".pc-spec-label");
    pcDiagram.addEventListener("mousemove", (e) => {
      const rect = pcDiagram.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      specLabels.forEach((label) => {
        const depth = Number(label.getAttribute("data-depth")) || 20;
        label.style.transform = `translate(${relX * depth}px, ${relY * depth}px)`;
      });
    });
    pcDiagram.addEventListener("mouseleave", () => {
      specLabels.forEach((label) => {
        label.style.transform = "translate(0,0)";
      });
    });
  }

  // =========================================================================
  // 11. Products & videos - loaded live from Supabase (same database the
  //     admin panel writes to, so edits show up for every visitor)
  // =========================================================================

  // Converts a Google Drive "share" link into a directly-hotlinkable image URL.
  // Any other URL (Google Photos direct links, Imgur, self-hosted, etc.) is
  // returned unchanged. Mirrors the same helper in admin.js.
  function resolveImageUrl(rawUrl) {
    const url = (rawUrl || "").trim();
    if (!url) return "";
    let driveId = "";
    const fileMatch = url.match(
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    );
    const openMatch =
      url.match(/drive\.google\.com\/open\?.*[?&]id=([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileMatch) driveId = fileMatch[1];
    else if (url.includes("drive.google.com") && openMatch)
      driveId = openMatch[1];
    return driveId
      ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`
      : url;
  }

  async function loadDynamicProducts() {
    const grid = document.querySelector(".products-grid");
    if (!grid || !sb) return;
    try {
      const { data: products, error } = await sb
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!Array.isArray(products) || !products.length) return;

      const ICONS = {
        Storage: "fa-hard-drive",
        Memory: "fa-memory",
        Peripherals: "fa-keyboard",
        Printing: "fa-print",
        "Laptop Hardware": "fa-tv",
        "Power & Cases": "fa-microchip",
      };
      grid.innerHTML = products
        .map((p) => {
          const icon = ICONS[p.category] || "fa-box";
          const waMsg = encodeURIComponent(
            `Hello NewAge IT, I am interested in buying the ${p.title} (${p.price}).`,
          );
          const isStock = p.stock === "in-stock";
          const resolvedImg = resolveImageUrl(p.image);
          const mediaHtml = resolvedImg
            ? `<img src="${escapeHtml(resolvedImg)}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid ${icon}\\'></i>'">`
            : `<i class="fa-solid ${icon}"></i>`;
          return `
                    <div class="product-card">
                        <div class="product-badge ${isStock ? "in-stock" : "pre-order"}"><i class="fa-solid ${isStock ? "fa-check" : "fa-clock"}"></i> ${isStock ? "In Stock" : "Fast Sourcing"}</div>
                        <div class="product-icon-wrap${resolvedImg ? " has-photo" : ""}">${mediaHtml}</div>
                        <div class="product-info">
                            <span class="product-cat">${escapeHtml(p.category)}</span>
                            <h3>${escapeHtml(p.title)}</h3>
                            <p class="product-spec">${escapeHtml(p.spec)}</p>
                            <div class="product-price-row">
                                <div class="price-box">${p.mrp ? `<span class="mrp">${escapeHtml(p.mrp)}</span>` : ""}<span class="price">${escapeHtml(p.price)}</span></div>
                                <a href="https://wa.me/${getContentPhoneDigits()}?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="btn-buy-wa"><i class="fa-brands fa-whatsapp"></i> Order</a>
                            </div>
                        </div>
                    </div>
                `;
        })
        .join("");
    } catch (e) {
      console.warn("Products load error:", e);
    }
  }

  async function loadDynamicVideos() {
    const grid = document.getElementById("videosGrid");
    if (!grid || !sb) return;
    try {
      const { data: videos, error } = await sb
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!Array.isArray(videos) || !videos.length) return;

      grid.innerHTML = videos
        .map((v) => {
          const tiktokMatch =
            (v.url || "").match(/video\/(\d+)/) ||
            (v.url || "").match(/player\/v1\/(\d+)/);
          if (!tiktokMatch) return "";
          return `
                    <div class="video-card" data-card-id="${escapeHtml(v.id || "")}">
                        <div class="video-player-wrap">
                            <iframe src="https://www.tiktok.com/player/v1/${tiktokMatch[1]}?autoplay=0" class="tiktok-iframe-player" allow="autoplay; encrypted-media" allowfullscreen title="${escapeHtml(v.title || "TikTok video")}"></iframe>
                        </div>
                        <div class="video-card-body">
                            <span class="video-topic-badge"><i class="fa-brands fa-tiktok"></i> ${escapeHtml(v.topic || "Tech Tip")}</span>
                            <h3>${escapeHtml(v.title || "")}</h3>
                        </div>
                    </div>
                `;
        })
        .join("");
    } catch (e) {
      console.warn("Videos load error:", e);
    }
  }

  loadDynamicProducts();
  loadDynamicVideos();

  // =========================================================================
  // 12. Price Assistant - client-side lookup against the official service
  //     charge list (no external API, no cost, works instantly offline).
  //     Prices marked `from: true` are starting estimates ("... dekhi" on
  //     the printed chart) - final cost is confirmed after diagnosis.
  // =========================================================================
  let PRICE_LIST = [
    {
      cat: "Installation & Upgrades",
      item: "OS Installation (Only)",
      price: 500,
      from: false,
      kw: "windows format install os reinstall",
    },
    {
      cat: "Installation & Upgrades",
      item: "OS Tune Up, Startup Repair, Restore",
      price: 500,
      from: false,
      kw: "slow hang freeze startup boot tune up restore",
    },
    {
      cat: "Installation & Upgrades",
      item: "OS Installation - With All Programs",
      price: 1000,
      from: false,
      kw: "windows format install os reinstall with software",
    },
    {
      cat: "Installation & Upgrades",
      item: "Software Installation and Upgrade",
      price: 500,
      from: false,
      kw: "app program install update",
    },
    {
      cat: "Installation & Upgrades",
      item: "All Drivers Setup",
      price: 300,
      from: true,
      kw: "driver graphics audio setup",
    },
    {
      cat: "Installation & Upgrades",
      item: "Antivirus Setup (1 Year)",
      price: 850,
      from: false,
      kw: "antivirus protection security",
    },
    {
      cat: "Installation & Upgrades",
      item: "Virus Scanning, Healing & Updates",
      price: 800,
      from: false,
      kw: "virus malware scan clean",
    },
    {
      cat: "Installation & Upgrades",
      item: "Complete Setup Servicing",
      price: 1000,
      from: false,
      kw: "desktop pc full service",
    },
    {
      cat: "Installation & Upgrades",
      item: "Complete Laptop Servicing",
      price: 1000,
      from: true,
      kw: "laptop full service cleaning",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop's Keyboard Change",
      price: 2000,
      from: true,
      kw: "laptop keyboard replace change key",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop Battery Change (Internal)",
      price: 3000,
      from: true,
      kw: "laptop battery replace change not charging",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop Cooling Fan Change, Charging Port Repair",
      price: 2000,
      from: true,
      kw: "laptop fan noise heating charging port repair",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop's HDD Change",
      price: 4500,
      from: true,
      kw: "laptop hard disk hdd ssd change replace",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop's Screen Change",
      price: 5500,
      from: true,
      kw: "laptop screen display change broken cracked replace",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop's Speaker Change",
      price: 2000,
      from: true,
      kw: "laptop speaker sound change no audio",
    },
    {
      cat: "Installation & Upgrades",
      item: "Desktop RAM Upgrade",
      price: 1500,
      from: true,
      kw: "desktop ram memory upgrade",
    },
    {
      cat: "Installation & Upgrades",
      item: "Laptop/Desktop Faults Finding Diagnose Only",
      price: 300,
      from: true,
      kw: "diagnose diagnosis check up fault finding not turning on no power dead wont start",
    },
    {
      cat: "Installation & Upgrades",
      item: "Monitor/Printer/UPS/Projector Faults Finding",
      price: 500,
      from: true,
      kw: "monitor printer ups projector diagnose check",
    },
    {
      cat: "Installation & Upgrades",
      item: "Desktop's HDD Change",
      price: 4500,
      from: true,
      kw: "desktop hard disk hdd ssd change replace",
    },

    {
      cat: "Password Decrypt",
      item: "BIOS Password Remove (Laptop)",
      price: 1500,
      from: true,
      kw: "bios password remove laptop locked",
    },
    {
      cat: "Password Decrypt",
      item: "BIOS Password Remove (Desktop)",
      price: 500,
      from: true,
      kw: "bios password remove desktop locked",
    },
    {
      cat: "Password Decrypt",
      item: "OS Password Remove",
      price: 500,
      from: false,
      kw: "windows login password remove forgot locked",
    },

    {
      cat: "Device Setup",
      item: "Router Setup",
      price: 100,
      from: false,
      kw: "router wifi internet setup",
    },
    {
      cat: "Device Setup",
      item: "Thin Client Setup (Per Client)",
      price: 1500,
      from: false,
      kw: "thin client setup office",
    },

    {
      cat: "Data Backup & Recovery",
      item: "Data Copy/Backup",
      price: 800,
      from: false,
      kw: "data copy backup transfer",
    },
    {
      cat: "Data Backup & Recovery",
      item: "Data Recovery (Per GB)",
      price: 800,
      from: false,
      kw: "data recovery lost deleted recover files",
    },
    {
      cat: "Data Backup & Recovery",
      item: "Desktop's HDD Repair (Physical)",
      price: 600,
      from: true,
      kw: "desktop hard disk hdd physical repair bad sector",
    },
    {
      cat: "Data Backup & Recovery",
      item: "Laptop's HDD Repair (Physical)",
      price: 800,
      from: true,
      kw: "laptop hard disk hdd physical repair bad sector",
    },

    {
      cat: "Mobile & Smartphone Repair",
      item: "Tempered Glass",
      price: 100,
      from: true,
      kw: "mobile phone tempered glass screen guard",
    },
    {
      cat: "Mobile & Smartphone Repair",
      item: "Normal Repair",
      price: 500,
      from: true,
      kw: "mobile phone general repair",
    },
    {
      cat: "Mobile & Smartphone Repair",
      item: "Charging Port Repair",
      price: 200,
      from: true,
      kw: "mobile phone charging port not charging",
    },
    {
      cat: "Mobile & Smartphone Repair",
      item: "Display Change",
      price: 2000,
      from: true,
      kw: "mobile phone screen display change broken cracked",
    },

    {
      cat: "Printer & Photocopy",
      item: "Printer Driver Setup",
      price: 500,
      from: false,
      kw: "printer driver setup install",
    },
    {
      cat: "Printer & Photocopy",
      item: "Printer Servicing (Laser)",
      price: 1500,
      from: false,
      kw: "laser printer service",
    },
    {
      cat: "Printer & Photocopy",
      item: "Inkjet Servicing",
      price: 2000,
      from: false,
      kw: "inkjet printer service",
    },
    {
      cat: "Printer & Photocopy",
      item: "Printer Heavy Servicing",
      price: 2500,
      from: false,
      kw: "printer heavy service repair",
    },
    {
      cat: "Printer & Photocopy",
      item: "Photocopy Heavy Servicing",
      price: 3000,
      from: false,
      kw: "photocopy copier heavy service repair",
    },
    {
      cat: "Printer & Photocopy",
      item: "Cartridge Refilling",
      price: 500,
      from: false,
      kw: "toner cartridge refill ink",
    },

    {
      cat: "Power System",
      item: "Desktop SMPS Repair",
      price: 500,
      from: true,
      kw: "desktop smps power supply repair not turning on no power dead",
    },
    {
      cat: "Power System",
      item: "Laptop Adaptor Repair",
      price: 500,
      from: true,
      kw: "laptop adapter charger repair",
    },
    {
      cat: "Power System",
      item: "Laptop's Power D/C Cord Change",
      price: 500,
      from: true,
      kw: "laptop dc jack power cord change",
    },
    {
      cat: "Power System",
      item: "UPS Repair",
      price: 600,
      from: true,
      kw: "ups repair not working",
    },
    {
      cat: "Power System",
      item: "UPS Battery Change",
      price: 2000,
      from: true,
      kw: "ups battery replace change",
    },
    {
      cat: "Power System",
      item: "BIOS Battery Change",
      price: 100,
      from: false,
      kw: "bios battery cmos change",
    },
    {
      cat: "Power System",
      item: "Inverter Repairing Charge",
      price: 1500,
      from: true,
      kw: "inverter repair",
    },

    {
      cat: "Online/Offline Support",
      item: "Home Service (Per Visit)",
      price: 600,
      from: true,
      kw: "home visit service call",
    },
    {
      cat: "Online/Offline Support",
      item: "Office Service (Per Visit)",
      price: 1000,
      from: true,
      kw: "office visit service call",
    },
    {
      cat: "Online/Offline Support",
      item: "Any Device Repair Minimum Charge",
      price: 300,
      from: true,
      kw: "minimum charge repair",
    },
    {
      cat: "Online/Offline Support",
      item: "Distance Support (TeamViewer, AnyDesk, etc.)",
      price: 600,
      from: false,
      kw: "remote support teamviewer anydesk online",
    },

    {
      cat: "Chip Level Repair",
      item: "Laptop's Motherboard Power Problem",
      price: 2000,
      from: true,
      kw: "laptop motherboard mb power not turning on no power dead",
    },
    {
      cat: "Chip Level Repair",
      item: "ENE Chip, Power IC, LAN, Sound & Other IC",
      price: 2500,
      from: true,
      kw: "chip ic repair lan sound power",
    },
    {
      cat: "Chip Level Repair",
      item: "South/North Bridge Heating",
      price: 1500,
      from: true,
      kw: "motherboard bridge heating overheat",
    },
    {
      cat: "Chip Level Repair",
      item: "Green Chip Old Reballing",
      price: 3500,
      from: true,
      kw: "gpu chip reballing old",
    },
    {
      cat: "Chip Level Repair",
      item: "Green Chip New Installation & Reballing",
      price: 5000,
      from: true,
      kw: "gpu chip reballing new installation",
    },
    {
      cat: "Chip Level Repair",
      item: "Laptop's Motherboard Minimum Repair",
      price: 1500,
      from: false,
      kw: "laptop motherboard mb minimum repair",
    },
    {
      cat: "Chip Level Repair",
      item: "Desktop's Motherboard Repair",
      price: 1000,
      from: false,
      kw: "desktop motherboard mb repair",
    },
    {
      cat: "Chip Level Repair",
      item: "Laptop's BIOS Copy",
      price: 2000,
      from: false,
      kw: "laptop bios chip copy",
    },
    {
      cat: "Chip Level Repair",
      item: "Desktop's Motherboard BIOS Copy",
      price: 1000,
      from: false,
      kw: "desktop motherboard mb bios chip copy",
    },

    {
      cat: "TV Repair",
      item: "TV Board Problem",
      price: 3000,
      from: true,
      kw: "tv board repair not turning on",
    },
    {
      cat: "TV Repair",
      item: "TV Backlight Problem",
      price: 4500,
      from: true,
      kw: "tv backlight dark screen no display",
    },
    {
      cat: "TV Repair",
      item: "TV Panel Repair",
      price: 7000,
      from: true,
      kw: "tv panel repair screen",
    },
    {
      cat: "TV Repair",
      item: "TV Panel Change",
      price: 10000,
      from: true,
      kw: "tv panel change screen replace",
    },
  ];

  const PB_STOPWORDS = new Set([
    "the", "a", "an", "is", "my", "i", "to", "for", "of", "do", "you",
    "much", "how", "what", "price", "cost", "charge", "rate", "in", "on",
    "at", "it", "want", "need", "please", "and", "or", "me", "can", "will",
    "your", "there", "with", "have", "has", "any", "about",
  ]);

  // Common alternate phrasings mapped to the word the price list actually
  // uses, so "notebook"/"pc"/"cracked"/"won't start" etc. still hit the
  // right entry instead of only rewarding the exact chart wording.
  const PB_SYNONYMS = {
    notebook: "laptop", laptops: "laptop",
    pc: "desktop", computer: "desktop", computers: "desktop", cpu: "desktop",
    cell: "mobile", cellphone: "mobile", phone: "mobile", smartphone: "mobile", android: "mobile", iphone: "mobile",
    monitor: "screen", display: "screen", lcd: "screen", panel: "screen",
    broken: "change", cracked: "change", damaged: "change", damage: "change", spoiled: "change", smashed: "change",
    wont: "not", cant: "not", isnt: "not", doesnt: "not", dont: "not",
    hang: "tune", hanging: "tune", freeze: "tune", freezing: "tune", lag: "tune", lagging: "tune",
    virus: "scanning", malware: "scanning", hacked: "scanning",
    internet: "router", wifi: "router", network: "router",
    keys: "keyboard", key: "keyboard",
    charger: "adaptor", adapter: "adaptor",
    tv: "tv", television: "tv",
    battery: "battery", bettery: "battery",
    windows: "os", format: "os", formatting: "os", reinstall: "os",
    forgotten: "remove", forgot: "remove", locked: "remove", unlock: "remove",
    turning: "power", starting: "power", boot: "power", booting: "power", start: "power", turn: "power", dead: "power",
    fix: "repair", fixing: "repair", repairing: "repair", servicing: "service",
  };

  function pbNormalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Naive stemmer - just enough to fold plurals/gerunds onto the chart's
  // wording ("screens"/"batteries"/"repairing" -> "screen"/"battery"/"repair").
  function pbStem(word) {
    if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
    return word;
  }

  const PB_SYNONYM_KEYS = Object.keys(PB_SYNONYMS);

  // Lets a misspelled synonym ("moniter" for "monitor") still resolve to its
  // mapped word, instead of typo-tolerance and synonym-mapping only working
  // in isolation from each other.
  function pbFuzzySynonymLookup(word) {
    if (word.length < 5) return null;
    const tolerance = word.length >= 8 ? 2 : 1;
    for (const key of PB_SYNONYM_KEYS) {
      if (Math.abs(key.length - word.length) > tolerance) continue;
      if (pbLevenshtein(word, key) <= tolerance) return PB_SYNONYMS[key];
    }
    return null;
  }

  function pbCanonicalWord(word) {
    const stemmed = pbStem(word);
    if (PB_SYNONYMS[word]) return PB_SYNONYMS[word];
    if (PB_SYNONYMS[stemmed]) return PB_SYNONYMS[stemmed];
    return pbFuzzySynonymLookup(stemmed) || pbFuzzySynonymLookup(word) || stemmed;
  }

  function pbTokenize(str) {
    return pbNormalize(str)
      .split(" ")
      .filter((w) => w.length > 1)
      .map(pbCanonicalWord);
  }

  function pbLevenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function pbFuzzyTolerance(len) {
    if (len >= 9) return 3;
    if (len >= 6) return 2;
    if (len >= 4) return 1;
    return 0;
  }

  // A query word counts as present if it's an exact token match, a prefix
  // of/prefixed by a haystack token (plurals, "print"->"printer"), or within
  // a typo tolerance that scales with word length ("labtop", "chnage",
  // "scren" all still resolve). Prefix rather than plain substring, so a
  // short unrelated word ("board") can't hide inside a longer one
  // ("keyboard") and cause a false match.
  function pbTokenMatches(qWord, haystackTokens) {
    if (haystackTokens.includes(qWord)) return true;
    for (const t of haystackTokens) {
      if (t.length > 3 && qWord.length > 3 && (t.startsWith(qWord) || qWord.startsWith(t))) return true;
    }
    const tolerance = pbFuzzyTolerance(qWord.length);
    if (tolerance > 0) {
      for (const t of haystackTokens) {
        if (Math.abs(t.length - qWord.length) <= tolerance && pbLevenshtein(qWord, t) <= tolerance) return true;
      }
    }
    return false;
  }

  function pbFormatPrice(entry) {
    return `Rs. ${entry.price.toLocaleString("en-IN")}${entry.from ? " onwards" : ""}`;
  }

  // The admin-managed catalogue (Supabase table "chatbot_services") replaces
  // this hardcoded default once it loads successfully - see loadChatbotServices()
  // below. Kept as a fallback so the assistant still works if that table is
  // empty, unreachable, or not yet migrated.
  let PB_CANDIDATES = [];
  function rebuildPriceCandidates() {
    PB_CANDIDATES = PRICE_LIST.map((entry) => ({
      entry,
      tokens: pbTokenize(`${entry.item} ${entry.cat} ${entry.kw}`),
    }));
  }
  rebuildPriceCandidates();

  async function loadChatbotServices() {
    if (!sb) return;
    try {
      const { data, error } = await sb.from("chatbot_services").select("*").order("category").order("item");
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        PRICE_LIST = data.map((row) => ({
          cat: row.category,
          item: row.item,
          price: Number(row.price) || 0,
          from: !!row.price_from,
          kw: row.keywords || "",
        }));
        rebuildPriceCandidates();
      }
    } catch (e) {
      console.warn("Chatbot services load error (using built-in default price list):", e);
    }
  }
  loadChatbotServices();

  // Searches once for a single phrase. Tier 1 requires every query word to
  // match something in the entry (keeps a generic word like "repair" from
  // flooding results); Tier 2 falls back to partial-word overlap so an
  // odd phrasing still finds something rather than nothing.
  function pbSearchOnce(phrase) {
    const words = pbTokenize(phrase).filter((w) => !PB_STOPWORDS.has(w));
    if (!words.length) return [];

    let matches = PB_CANDIDATES.filter((c) =>
      words.every((w) => pbTokenMatches(w, c.tokens)),
    );

    if (!matches.length) {
      // Require at least 2 matching words (or all of them, for a 1-word
      // query) - otherwise a 3+ word question would fall back to showing
      // every entry that happens to share just one generic word.
      const minScore = Math.min(words.length, 2);
      matches = PB_CANDIDATES
        .map((c) => ({ ...c, score: words.filter((w) => pbTokenMatches(w, c.tokens)).length }))
        .filter((c) => c.score >= minScore)
        .sort((a, b) => b.score - a.score);
    }

    return matches.map((m) => m.entry);
  }

  // Splits on "and"/commas so a multi-item question ("laptop screen and
  // keyboard price") returns results for each part instead of one confused
  // all-words-required search across the whole sentence.
  function searchPriceList(query) {
    const parts = query
      .split(/\band\b|,|\+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    const segments = parts.length > 1 ? parts : [query];

    const seen = new Set();
    const combined = [];
    segments.forEach((segment) => {
      pbSearchOnce(segment).forEach((entry) => {
        if (!seen.has(entry.item)) {
          seen.add(entry.item);
          combined.push(entry);
        }
      });
    });

    return combined.slice(0, 8);
  }

  const PB_INTENT_PATTERNS = {
    greeting: /^(hi+|hello+|hey+|yo|namaste|namaskar|good\s?(morning|afternoon|evening))\b/,
    howareyou: /how\s*(are|r)\s*(you|u)|whats\s*up/,
    thanks: /\b(thank(s|you)?|thnx|thx|thanku)\b/,
    bye: /\b(bye|goodbye|see\s*ya|see\s*you|good\s*night)\b/,
    human: /\b(human|agent|real\s*person|talk\s*to\s*(someone|somebody|staff)|call\s*(you|someone))\b/,
  };

  function pbDetectIntent(normQuery) {
    for (const [intent, pattern] of Object.entries(PB_INTENT_PATTERNS)) {
      if (pattern.test(normQuery)) return intent;
    }
    return null;
  }

  const PB_INTENT_REPLIES = {
    greeting: "<p>Hey there! Ask me about any repair or service charge — e.g. \"laptop screen change price\" — or tap a category below.</p>",
    howareyou: "<p>Running perfectly, thanks for asking! What repair or service would you like a price for?</p>",
    thanks: "<p>You're welcome! Anything else I can look up for you?</p>",
    bye: "<p>Take care! We're here whenever you need us — come back any time.</p>",
    human: () => `<p>Sure — our team can help directly:</p><p><a href="https://wa.me/${getContentPhoneDigits()}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600;">Chat on WhatsApp <i class="fa-brands fa-whatsapp"></i></a> or call <a href="tel:+${getContentPhoneDigits()}" style="color:var(--accent); font-weight:600;">${escapeHtml(getContentPhone())}</a>.</p>`,
  };

  const priceBotToggle = document.getElementById("priceBotToggle");
  const priceBotPanel = document.getElementById("priceBotPanel");
  const priceBotMessages = document.getElementById("priceBotMessages");
  const priceBotChips = document.getElementById("priceBotChips");
  const priceBotForm = document.getElementById("priceBotForm");
  const priceBotInput = document.getElementById("priceBotInput");

  if (priceBotToggle && priceBotPanel) {
    let pbInitialized = false;

    function pbAppendUser(text) {
      const row = document.createElement("div");
      row.className = "pb-row pb-row-user";
      row.innerHTML = `<div class="pb-msg-user"></div>`;
      row.querySelector(".pb-msg-user").textContent = text;
      priceBotMessages.appendChild(row);
      priceBotMessages.scrollTop = priceBotMessages.scrollHeight;
    }

    function pbShowTyping() {
      const row = document.createElement("div");
      row.className = "pb-row pb-row-bot pb-row-typing";
      row.innerHTML = `<div class="pb-avatar">NA</div><div class="pb-msg-bot pb-typing"><span></span><span></span><span></span></div>`;
      priceBotMessages.appendChild(row);
      priceBotMessages.scrollTop = priceBotMessages.scrollHeight;
      return row;
    }

    function pbAppendBotHtml(html, replaceRow) {
      const row = replaceRow || document.createElement("div");
      row.className = "pb-row pb-row-bot";
      row.innerHTML = `<div class="pb-avatar">NA</div><div class="pb-msg-bot">${html}</div>`;
      if (!replaceRow) priceBotMessages.appendChild(row);
      priceBotMessages.scrollTop = priceBotMessages.scrollHeight;
    }

    // Small delay + typing indicator makes the bot feel alive without
    // being slow enough to annoy anyone who already knows what they want.
    function pbReplyWithDelay(html) {
      const typingRow = pbShowTyping();
      setTimeout(
        () => {
          pbAppendBotHtml(html, typingRow);
        },
        450 + Math.random() * 300,
      );
    }

    function pbRenderResults(entries) {
      const rows = entries
        .map(
          (e) => `
                <div class="pb-result-item">
                    <span class="pb-result-name">${escapeHtml(e.item)}</span>
                    <span class="pb-result-price">${escapeHtml(pbFormatPrice(e))}</span>
                </div>
            `,
        )
        .join("");
      return `<p>Here's what I found:</p><div class="pb-result-list">${rows}</div>`;
    }

    function pbHandleQuery(rawText) {
      const text = (rawText || "").trim();
      if (!text) return;
      pbAppendUser(text);

      const intent = pbDetectIntent(pbNormalize(text));
      if (intent) {
        const reply = PB_INTENT_REPLIES[intent];
        pbReplyWithDelay(typeof reply === "function" ? reply() : reply);
        return;
      }

      const results = searchPriceList(text);
      if (results.length) {
        pbReplyWithDelay(pbRenderResults(results));
      } else {
        pbReplyWithDelay(`
                    <p>I couldn't match that to a listed service. Try a shorter phrase (e.g. "laptop screen" or "printer service"), or ask our team directly:</p>
                    <p><a href="https://wa.me/${getContentPhoneDigits()}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600;">Ask on WhatsApp <i class="fa-brands fa-whatsapp"></i></a></p>
                `);
      }
    }

    function pbRenderCategoryChips() {
      const cats = [...new Set(PRICE_LIST.map((e) => e.cat))];
      priceBotChips.innerHTML = cats
        .map(
          (c) =>
            `<button type="button" class="pb-chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`,
        )
        .join("");
      priceBotChips.querySelectorAll(".pb-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const cat = chip.getAttribute("data-cat");
          pbAppendUser(cat);
          const entries = PRICE_LIST.filter((e) => e.cat === cat);
          pbReplyWithDelay(pbRenderResults(entries));
        });
      });
    }

    function pbInit() {
      if (pbInitialized) return;
      pbInitialized = true;
      pbAppendBotHtml(`
                <p><strong>Hi! I'm the NewAge Price Assistant.</strong> Ask about any repair or service charge, e.g. "laptop screen change price" or "BIOS password remove".</p>
                <p style="color:var(--muted); font-size:0.78rem;">Prices marked "onwards" are starting estimates - final cost is confirmed after diagnosis. Or browse a category below:</p>
            `);
      pbRenderCategoryChips();
    }

    function pbOpen() {
      priceBotPanel.classList.add("is-open");
      priceBotPanel.setAttribute("aria-hidden", "false");
      priceBotToggle.classList.add("is-active");
      priceBotToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      pbInit();
      priceBotInput?.focus();
    }

    function pbClose() {
      priceBotPanel.classList.remove("is-open");
      priceBotPanel.setAttribute("aria-hidden", "true");
      priceBotToggle.classList.remove("is-active");
      priceBotToggle.innerHTML = '<i class="fa-solid fa-comment-dots"></i>';
    }

    priceBotToggle.addEventListener("click", () => {
      if (!priceBotPanel.classList.contains("is-open")) pbOpen();
      else pbClose();
    });
    document
      .getElementById("priceBotClose")
      ?.addEventListener("click", pbClose);

    priceBotForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      pbHandleQuery(priceBotInput.value);
      priceBotInput.value = "";
    });
  }
});
