// =============================================================================
// NewAge I.T. Solution Center - Master Script
// Repair lab motion system: hero canvas, custom cursor, animated counters,
// interactive diagnostic tool, repair tracking, contact form + CMS sync.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // =========================================================================
    // 0. Supabase client - anon key only (safe to expose; access is enforced
    //    by Row Level Security policies, see supabase/schema.sql)
    // =========================================================================
    const SUPABASE_URL = window.SUPABASE_CONFIG?.url || '';
    const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || '';
    const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;
    if (!sb) console.warn('Supabase not configured - config.js is missing or empty. See .env.example.');

    // Helper: Escapes HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================================================
    // 1. Navbar: scroll state + mobile menu
    // =========================================================================
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    const navItems = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    const handleScroll = () => {
        if (window.scrollY > 30) navbar?.classList.add('scrolled');
        else navbar?.classList.remove('scrolled');

        const scrollPos = window.scrollY + 160;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            if (scrollPos >= top && scrollPos < top + height) {
                navItems.forEach(link => {
                    const href = link.getAttribute('href');
                    link.classList.toggle('active', href === `#${id}`);
                });
            }
        });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('is-open');
            mobileMenuBtn.classList.toggle('is-open', isOpen);
            mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
        });
        navItems.forEach(link => link.addEventListener('click', () => {
            navLinks.classList.remove('is-open');
            mobileMenuBtn.classList.remove('is-open');
        }));
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                navLinks.classList.remove('is-open');
                mobileMenuBtn.classList.remove('is-open');
            }
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || !targetId) return;
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
            }
        });
    });

    // =========================================================================
    // 1b. Accent color theme (blue / orange) - persisted, no page reload
    // =========================================================================
    const ACCENT_STORAGE_KEY = 'NEWAGE_ACCENT_THEME';
    const ACCENT_RGB_BY_THEME = { blue: '47, 111, 237', orange: '255, 90, 31' };
    const accentToggleBtn = document.getElementById('accentToggleBtn');

    let accentTheme = 'blue';
    let accentRGB = ACCENT_RGB_BY_THEME.blue;
    try {
        if (localStorage.getItem(ACCENT_STORAGE_KEY) === 'orange') accentTheme = 'orange';
    } catch (e) { /* localStorage unavailable */ }

    function applyAccentTheme(theme) {
        accentTheme = theme;
        accentRGB = ACCENT_RGB_BY_THEME[theme];
        document.documentElement.setAttribute('data-accent', theme);
        accentToggleBtn?.querySelectorAll('.accent-toggle-dot').forEach(dot => {
            dot.classList.toggle('is-active', dot.getAttribute('data-accent-option') === theme);
        });
        try { localStorage.setItem(ACCENT_STORAGE_KEY, theme); } catch (e) { /* localStorage unavailable */ }
    }
    applyAccentTheme(accentTheme);

    accentToggleBtn?.addEventListener('click', () => {
        applyAccentTheme(accentTheme === 'blue' ? 'orange' : 'blue');
    });

    // =========================================================================
    // 2. Custom cursor (fine pointer only)
    // =========================================================================
    if (isFinePointer && !prefersReducedMotion) {
        const dot = document.getElementById('cursorDot');
        const ring = document.getElementById('cursorRing');
        const ringLabel = document.getElementById('cursorRingLabel');
        let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;
            document.body.classList.add('cursor-active');
            if (dot) { dot.style.left = mouseX + 'px'; dot.style.top = mouseY + 'px'; }
        });

        function ringLoop() {
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
            if (ring) { ring.style.left = ringX + 'px'; ring.style.top = ringY + 'px'; }
            requestAnimationFrame(ringLoop);
        }
        requestAnimationFrame(ringLoop);

        document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));

        document.querySelectorAll('[data-cursor="repair"]').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover-crosshair'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover-crosshair'));
        });

        document.querySelectorAll('.workshop-slide').forEach(el => {
            el.addEventListener('mouseenter', () => {
                document.body.classList.add('cursor-hover-view');
                if (ringLabel) ringLabel.textContent = 'VIEW';
            });
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover-view'));
        });

        // Magnetic buttons
        document.querySelectorAll('.btn-solid, .btn-ghost, .btn-track').forEach(btn => {
            btn.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover-btn'));
            btn.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-hover-btn');
                btn.style.transform = '';
            });
            btn.addEventListener('mousemove', (e) => {
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
    const heroCanvas = document.getElementById('heroCanvas');
    if (heroCanvas && !prefersReducedMotion) {
        const ctx = heroCanvas.getContext('2d');
        let w, h, nodes = [], particles = [];

        function resize() {
            w = heroCanvas.width = heroCanvas.offsetWidth * devicePixelRatio;
            h = heroCanvas.height = heroCanvas.offsetHeight * devicePixelRatio;
        }

        function buildNodes() {
            nodes = [];
            const cols = 6, rows = 4;
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    if (Math.random() > 0.55) {
                        nodes.push({
                            x: (w / cols) * i + (w / cols) * 0.5 + (Math.random() - 0.5) * 40,
                            y: (h / rows) * j + (h / rows) * 0.5 + (Math.random() - 0.5) * 40,
                            r: Math.random() * 1.5 + 0.8
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
                    a: Math.random() * 0.3 + 0.08
                });
            }
        }

        resize();
        buildNodes();
        buildParticles();
        window.addEventListener('resize', () => { resize(); buildNodes(); buildParticles(); });

        let scanY = 0;
        const scanSpeed = 0.35;

        function draw(t) {
            ctx.clearRect(0, 0, w, h);

            // connecting lines between nearby nodes
            ctx.strokeStyle = `rgba(${accentRGB}, 0.10)`;
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let k = i + 1; k < nodes.length; k++) {
                    const dx = nodes[i].x - nodes[k].x, dy = nodes[i].y - nodes[k].y;
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
            nodes.forEach(n => {
                const distToScan = Math.abs(n.y - scanY);
                const lit = Math.max(0, 1 - distToScan / (h * 0.12));
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r * devicePixelRatio * (1 + lit), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${accentRGB}, ${0.15 + lit * 0.65})`;
                ctx.fill();
            });

            // particles drifting upward
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(245, 245, 245, ${p.a})`;
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
        const dataLabels = document.querySelectorAll('.data-label');
        setInterval(() => {
            dataLabels.forEach(label => {
                if (Math.random() > 0.55) {
                    label.classList.add('is-visible');
                    setTimeout(() => label.classList.remove('is-visible'), 2200);
                }
            });
        }, 1800);
    } else {
        document.querySelectorAll('.data-label').forEach(l => l.classList.add('is-visible'));
    }

    // =========================================================================
    // 4. Animated stat counters
    // =========================================================================
    const statNumbers = document.querySelectorAll('.stat-number');
    function animateCount(el) {
        const target = Number(el.getAttribute('data-count')) || 0;
        const suffix = el.getAttribute('data-suffix') || '';
        const isStatic = el.getAttribute('data-static-suffix') === 'true';
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.floor(eased * target);
            el.textContent = isStatic ? `${value}${suffix}` : `${value.toLocaleString()}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = isStatic ? `${target}${suffix}` : `${target.toLocaleString()}${suffix}`;
        }
        requestAnimationFrame(tick);
    }

    if ('IntersectionObserver' in window && statNumbers.length) {
        const statObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCount(entry.target);
                    statObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        statNumbers.forEach(el => statObserver.observe(el));
    }

    // =========================================================================
    // 5. Scroll reveals ([data-reveal] elements)
    // =========================================================================
    const revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window && revealEls.length) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('is-in'), i * 60);
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        revealEls.forEach(el => revealObserver.observe(el));
    } else {
        revealEls.forEach(el => el.classList.add('is-in'));
    }

    // =========================================================================
    // 6. Interactive diagnostic tool
    // =========================================================================
    const ISSUES = {
        Laptop: ['Not turning on', 'Overheating', 'Slow performance', 'Broken display', 'Charging problem', 'Keyboard problem'],
        Desktop: ['Not turning on', 'No display output', 'Overheating', 'Random restarts', 'Slow performance', 'Strange noises'],
        Mobile: ['Cracked screen', 'Battery drains fast', 'Not charging', 'Water damage', 'Software / app issues', 'Speaker or mic problem'],
        Printer: ['Paper jam', 'Not printing', 'Faded print quality', 'Connectivity issue', 'Error code on display'],
        TV: ['No display / black screen', 'No sound', 'Backlight failure', 'Smart features not working', 'Physical / screen damage'],
        Other: ['Something not listed here']
    };

    const DIAGNOSES = {
        'Not turning on': 'Likely a power delivery or motherboard fault. Requires bench diagnostics.',
        'Overheating': 'Likely dust buildup or dried thermal paste. Requires a clean and re-paste inspection.',
        'Slow performance': 'Likely a storage, malware, or startup-load issue. Requires a full system inspection.',
        'Broken display': 'Requires panel or flex-cable replacement. We will confirm the exact part on inspection.',
        'Charging problem': 'Likely a charging port, cable, or power IC fault. Requires hardware inspection.',
        'Keyboard problem': 'Likely a key-switch or ribbon cable fault. Requires hardware inspection.',
        'No display output': 'Likely a GPU, RAM seating, or motherboard fault. Requires bench diagnostics.',
        'Random restarts': 'Likely a power supply or thermal fault. Requires hardware inspection.',
        'Strange noises': 'Likely a fan or drive bearing fault. Requires hardware inspection.',
        'Cracked screen': 'Requires display assembly replacement. We will quote after checking the digitizer.',
        'Battery drains fast': 'Likely a degraded battery or background software drain. Requires diagnostics.',
        'Not charging': 'Likely a charging port or battery fault. Requires hardware inspection.',
        'Water damage': 'Requires immediate corrosion cleaning. Do not power on again until inspected.',
        'Software / app issues': 'Likely resolved with a software-level fix. Requires a quick diagnostic.',
        'Speaker or mic problem': 'Likely a connector or component fault. Requires hardware inspection.',
        'Paper jam': 'Likely a roller or sensor fault. Requires a mechanical inspection.',
        'Not printing': 'Likely a driver, connectivity, or print-head fault. Requires diagnostics.',
        'Faded print quality': 'Likely a toner, ink, or print-head issue. Requires inspection.',
        'Connectivity issue': 'Likely a network or driver-level fault. Requires diagnostics.',
        'Error code on display': 'Requires inspection to read the exact fault code and part needed.',
        'No display / black screen': 'Likely a backlight or panel fault. Requires hardware inspection.',
        'No sound': 'Likely a speaker or audio board fault. Requires hardware inspection.',
        'Backlight failure': 'Requires backlight strip or driver board replacement.',
        'Smart features not working': 'Likely a software or motherboard fault. Requires diagnostics.',
        'Physical / screen damage': 'Requires panel replacement. We will quote after inspection.',
        'Something not listed here': 'Tell us more in the request below and our technicians will take it from there.'
    };

    const deviceChips = document.querySelectorAll('.device-chip');
    const issueStep = document.getElementById('issueStep');
    const issueList = document.getElementById('issueList');
    const diagnoseResult = document.getElementById('diagnoseResult');
    const diagnoseResultText = document.getElementById('diagnoseResultText');
    const requestDiagnosisBtn = document.getElementById('requestDiagnosisBtn');
    let selectedDevice = '', selectedIssue = '';

    deviceChips.forEach(chip => {
        chip.addEventListener('click', () => {
            deviceChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedDevice = chip.getAttribute('data-device');
            selectedIssue = '';
            if (diagnoseResult) diagnoseResult.hidden = true;

            const issues = ISSUES[selectedDevice] || [];
            if (issueList) {
                issueList.innerHTML = issues.map(issue => `
                    <button type="button" class="issue-option" data-issue="${escapeHtml(issue)}">
                        <span class="radio-dot"></span> ${escapeHtml(issue)}
                    </button>
                `).join('');

                issueList.querySelectorAll('.issue-option').forEach(opt => {
                    opt.addEventListener('click', () => {
                        issueList.querySelectorAll('.issue-option').forEach(o => o.classList.remove('active'));
                        opt.classList.add('active');
                        selectedIssue = opt.getAttribute('data-issue');
                        if (diagnoseResultText) {
                            diagnoseResultText.textContent = DIAGNOSES[selectedIssue] || 'Requires hardware inspection.';
                        }
                        if (diagnoseResult) {
                            diagnoseResult.hidden = false;
                            diagnoseResult.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
                        }
                    });
                });
            }
            if (issueStep) issueStep.hidden = false;
        });
    });

    requestDiagnosisBtn?.addEventListener('click', () => {
        const contactSection = document.getElementById('contact');
        const messageField = document.getElementById('messageText');
        const serviceField = document.getElementById('serviceType');
        if (messageField) {
            messageField.value = `Device: ${selectedDevice}\nIssue: ${selectedIssue}\nDiagnosis note: ${DIAGNOSES[selectedIssue] || ''}`;
        }
        if (serviceField && selectedDevice) {
            const map = { Laptop: 'hardware-repair', Desktop: 'hardware-repair', Mobile: 'hardware-repair', Printer: 'tv-printer-inverter', TV: 'tv-printer-inverter', Other: 'other' };
            serviceField.value = map[selectedDevice] || 'other';
        }
        contactSection?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        document.getElementById('senderName')?.focus({ preventScroll: true });
    });

    // =========================================================================
    // 7. Repair stage definitions
    // =========================================================================
    const STAGE_DEFINITIONS = [
        { num: 1, title: 'Device Received' },
        { num: 2, title: 'Diagnosing' },
        { num: 3, title: 'Awaiting Approval' },
        { num: 4, title: 'Awaiting Approval' },
        { num: 5, title: 'Repairing' },
        { num: 6, title: 'Quality Check' },
        { num: 7, title: 'Ready for Collection' },
        { num: 8, title: 'Ready for Collection' }
    ];
    // Collapsed 6-node display timeline (stage numbers 1-8 map onto 6 visual nodes)
    const TIMELINE_NODES = [
        { label: 'Received', stages: [1] },
        { label: 'Diagnosing', stages: [2] },
        { label: 'Awaiting Approval', stages: [3, 4] },
        { label: 'Repairing', stages: [5] },
        { label: 'Quality Check', stages: [6] },
        { label: 'Ready', stages: [7, 8] }
    ];

    // =========================================================================
    // 8. Track Repair
    // =========================================================================
    const trackForm = document.getElementById('trackForm');
    const trackInput = document.getElementById('trackInput');
    const trackBtn = document.getElementById('trackBtn');
    const trackResult = document.getElementById('trackResult');

    document.querySelectorAll('.sample-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const ticket = chip.getAttribute('data-ticket');
            if (ticket && trackInput) { trackInput.value = ticket; executeTrackSearch(ticket); }
        });
    });

    if (trackForm && trackInput) {
        trackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = trackInput.value.trim();
            if (query) executeTrackSearch(query);
        });
    }

    async function executeTrackSearch(query) {
        if (!trackResult || !trackBtn) return;
        const originalHtml = trackBtn.innerHTML;
        trackBtn.disabled = true;
        trackBtn.textContent = 'Searching...';

        trackResult.hidden = false;
        trackResult.innerHTML = `<div class="repair-card" style="text-align:center;"><p style="color:var(--muted);">Searching records for <strong style="color:#fff;">"${escapeHtml(query)}"</strong>...</p></div>`;

        let foundRecord = null;
        if (sb) {
            try {
                const { data, error } = await sb.rpc('track_repair', { p_query: query });
                if (error) throw error;
                if (Array.isArray(data) && data.length) foundRecord = data[0];
            } catch (err) { console.warn('Repair lookup error:', err); }
        }

        setTimeout(() => {
            trackBtn.disabled = false;
            trackBtn.innerHTML = originalHtml;
            if (foundRecord) renderRepairCard(foundRecord);
            else renderNotFound(query);
            trackResult.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
        }, 300);
    }

    function renderRepairCard(item) {
        const stage = Number(item.stage) || 1;
        const statusLabel = STAGE_DEFINITIONS[stage - 1]?.title || 'In Progress';
        const waMessage = encodeURIComponent(`Hello NewAge I.T. Solution Center, I am inquiring about my repair ticket ${item.ticket_id} for my ${item.device}. Could you please update me?`);
        const waLink = `https://wa.me/9779841301930?text=${waMessage}`;

        const timelineHtml = TIMELINE_NODES.map((node, idx) => {
            const isDone = node.stages[node.stages.length - 1] < stage;
            const isCurrent = node.stages.includes(stage);
            let cls = '';
            if (isDone) cls = 'done'; else if (isCurrent) cls = 'current';
            return `
                <div class="timeline-node ${cls}">
                    <div class="timeline-dot">${isDone ? '<i class="fa-solid fa-check"></i>' : idx + 1}</div>
                    <span class="node-label">${node.label}</span>
                </div>
            `;
        }).join('');

        const completedNodes = TIMELINE_NODES.filter(n => n.stages[n.stages.length - 1] < stage).length;
        const progressPct = Math.min(100, (completedNodes / (TIMELINE_NODES.length - 1)) * 100);

        trackResult.innerHTML = `
            <div class="repair-card">
                <div class="repair-header">
                    <div class="repair-title-group">
                        <h3><i class="fa-solid fa-screwdriver-wrench" style="color:var(--accent);"></i> ${escapeHtml(item.ticket_id)}</h3>
                        <p>${escapeHtml(item.customer_name || 'Valued Customer')} &bull; Received ${escapeHtml(item.date_received || 'recently')}</p>
                    </div>
                    <span class="status-badge stage-${stage}">Stage ${stage}/8 &middot; ${escapeHtml(statusLabel)}</span>
                </div>

                <div class="timeline-track" style="--progress:${progressPct}%">
                    <div class="timeline-progress" style="width:${progressPct}%"></div>
                    ${timelineHtml}
                </div>

                <div class="repair-grid">
                    <div class="repair-detail-box"><div class="detail-label">Device</div><div class="detail-val">${escapeHtml(item.device || 'N/A')}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Reported Issue</div><div class="detail-val">${escapeHtml(item.issue || 'Diagnostic required')}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Est. Completion</div><div class="detail-val">${escapeHtml(item.estimated_delivery || 'In Progress')}</div></div>
                    <div class="repair-detail-box"><div class="detail-label">Cost Quote</div><div class="detail-val" style="color:var(--accent);">${escapeHtml(item.cost || 'Quote upon diagnosis')}</div></div>
                </div>

                <div class="tech-note-box">
                    <h4>Technician Notes</h4>
                    <p>${escapeHtml(item.technician_notes || 'Device is currently being processed by our technicians.')}</p>
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
        const waLink = `https://wa.me/9779841301930?text=${encodeURIComponent('Hello NewAge I.T., I searched for repair ticket or phone: ' + query + ' but could not find it. Could you please assist me?')}`;
        trackResult.innerHTML = `
            <div class="track-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h4>No repair record found</h4>
                <p>We could not find an active repair matching "${escapeHtml(query)}". Verify the ticket ID on your receipt, or the phone number given at drop-off.</p>
                <div class="track-error-actions">
                    <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-solid"><i class="fa-brands fa-whatsapp"></i> Ask on WhatsApp</a>
                    <a href="tel:+9779841301930" class="btn-ghost"><i class="fa-solid fa-phone"></i> Call +977 9841301930</a>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 9. Contact form (honeypot + rate-limit + local ticket + Sheets sync)
    // =========================================================================
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formFeedback = document.getElementById('formFeedback');
    let lastSubmissionTimestamp = 0;

    if (contactForm && submitBtn) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const honeypotVal = document.getElementById('websiteHp')?.value || '';
            if (honeypotVal) {
                if (formFeedback) { formFeedback.className = 'form-feedback success'; formFeedback.textContent = 'Thank you for reaching out!'; }
                contactForm.reset();
                return;
            }

            const now = Date.now();
            if (now - lastSubmissionTimestamp < 5000) {
                if (formFeedback) { formFeedback.className = 'form-feedback error'; formFeedback.textContent = 'Please wait a few seconds before submitting another inquiry.'; }
                return;
            }
            lastSubmissionTimestamp = now;

            const name = document.getElementById('senderName')?.value?.trim() || '';
            const phone = document.getElementById('senderPhone')?.value?.trim() || '';
            const email = document.getElementById('senderEmail')?.value?.trim() || '';
            const service = document.getElementById('serviceType')?.value || '';
            const message = document.getElementById('messageText')?.value?.trim() || '';

            if (!name || !phone || !email || !message) {
                if (formFeedback) { formFeedback.className = 'form-feedback error'; formFeedback.textContent = 'Please fill out all required fields, including your phone number.'; }
                return;
            }

            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving &amp; Generating Ticket...';

            const ticketId = `NA-${Math.floor(1000 + Math.random() * 9000)}`;

            let submissionFailed = false;

            if (sb) {
                try {
                    const { error: inquiryErr } = await sb.rpc('submit_inquiry', {
                        p_ticket_id: ticketId, p_customer_name: name, p_phone: phone, p_email: email, p_service: service, p_message: message
                    });
                    if (inquiryErr) throw inquiryErr;
                } catch (err) { console.warn('Inquiry insert error:', err); submissionFailed = true; }

                try {
                    const { error: repairErr } = await sb.rpc('submit_repair', {
                        p_ticket_id: ticketId,
                        p_customer_name: name,
                        p_phone: phone,
                        p_device: service === 'hardware-repair' ? 'Device Repair Request' : (service === 'custom-build' ? 'Custom PC Build Order' : 'IT Service Inquiry'),
                        p_issue: message
                    });
                    if (repairErr) throw repairErr;
                } catch (err) { console.warn('Repair ticket insert error:', err); submissionFailed = true; }
            }

            if (submissionFailed) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                if (formFeedback) {
                    formFeedback.className = 'form-feedback error';
                    formFeedback.textContent = 'We could not log your inquiry right now. Please try again shortly or reach us directly on WhatsApp.';
                }
                return;
            }

            const waText = encodeURIComponent(`Hello NewAge I.T. Solution Center, I just submitted an inquiry on your website!\n\nTicket ID: ${ticketId}\nName: ${name}\nPhone: ${phone}\nService: ${service}\nMessage: ${message}`);
            const waUrl = `https://wa.me/9779841301930?text=${waText}`;

            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                if (formFeedback) {
                    formFeedback.className = 'form-feedback success';
                    formFeedback.innerHTML = `
                        <strong>Inquiry logged.</strong> Your tracking reference is
                        <strong style="font-family: var(--font-mono); color: var(--accent);">${ticketId}</strong>.
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                            <button type="button" id="quickTrackBtn" class="btn-solid" style="padding:8px 16px; font-size:0.85rem;">Track ${ticketId}</button>
                            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-ghost" style="padding:8px 16px; font-size:0.85rem;">Confirm on WhatsApp</a>
                        </div>
                    `;
                    document.getElementById('quickTrackBtn')?.addEventListener('click', () => {
                        const trackSection = document.getElementById('repairs');
                        if (trackInput && trackSection) {
                            trackInput.value = ticketId;
                            trackSection.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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
    const pcDiagram = document.getElementById('pcDiagram');
    if (pcDiagram && isFinePointer && !prefersReducedMotion) {
        const specLabels = pcDiagram.querySelectorAll('.pc-spec-label');
        pcDiagram.addEventListener('mousemove', (e) => {
            const rect = pcDiagram.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width - 0.5;
            const relY = (e.clientY - rect.top) / rect.height - 0.5;
            specLabels.forEach(label => {
                const depth = Number(label.getAttribute('data-depth')) || 20;
                label.style.transform = `translate(${relX * depth}px, ${relY * depth}px)`;
            });
        });
        pcDiagram.addEventListener('mouseleave', () => {
            specLabels.forEach(label => { label.style.transform = 'translate(0,0)'; });
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
        const url = (rawUrl || '').trim();
        if (!url) return '';
        let driveId = '';
        const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        const openMatch = url.match(/drive\.google\.com\/open\?.*[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileMatch) driveId = fileMatch[1];
        else if (url.includes('drive.google.com') && openMatch) driveId = openMatch[1];
        return driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000` : url;
    }

    async function loadDynamicProducts() {
        const grid = document.querySelector('.products-grid');
        if (!grid || !sb) return;
        try {
            const { data: products, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!Array.isArray(products) || !products.length) return;

            const ICONS = { Storage: 'fa-hard-drive', Memory: 'fa-memory', Peripherals: 'fa-keyboard', Printing: 'fa-print', 'Laptop Hardware': 'fa-tv', 'Power & Cases': 'fa-microchip' };
            grid.innerHTML = products.map(p => {
                const icon = ICONS[p.category] || 'fa-box';
                const waMsg = encodeURIComponent(`Hello NewAge IT, I am interested in buying the ${p.title} (${p.price}).`);
                const isStock = p.stock === 'in-stock';
                const resolvedImg = resolveImageUrl(p.image);
                const mediaHtml = resolvedImg
                    ? `<img src="${escapeHtml(resolvedImg)}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid ${icon}\\'></i>'">`
                    : `<i class="fa-solid ${icon}"></i>`;
                return `
                    <div class="product-card">
                        <div class="product-badge ${isStock ? 'in-stock' : 'pre-order'}"><i class="fa-solid ${isStock ? 'fa-check' : 'fa-clock'}"></i> ${isStock ? 'In Stock' : 'Fast Sourcing'}</div>
                        <div class="product-icon-wrap${resolvedImg ? ' has-photo' : ''}">${mediaHtml}</div>
                        <div class="product-info">
                            <span class="product-cat">${escapeHtml(p.category)}</span>
                            <h3>${escapeHtml(p.title)}</h3>
                            <p class="product-spec">${escapeHtml(p.spec)}</p>
                            <div class="product-price-row">
                                <div class="price-box">${p.mrp ? `<span class="mrp">${escapeHtml(p.mrp)}</span>` : ''}<span class="price">${escapeHtml(p.price)}</span></div>
                                <a href="https://wa.me/9779841301930?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="btn-buy-wa"><i class="fa-brands fa-whatsapp"></i> Order</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) { console.warn('Products load error:', e); }
    }

    async function loadDynamicVideos() {
        const grid = document.getElementById('videosGrid');
        if (!grid || !sb) return;
        try {
            const { data: videos, error } = await sb.from('videos').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!Array.isArray(videos) || !videos.length) return;

            grid.innerHTML = videos.map((v) => {
                const tiktokMatch = (v.url || '').match(/video\/(\d+)/) || (v.url || '').match(/player\/v1\/(\d+)/);
                if (!tiktokMatch) return '';
                return `
                    <div class="video-card" data-card-id="${escapeHtml(v.id || '')}">
                        <div class="video-player-wrap">
                            <iframe src="https://www.tiktok.com/player/v1/${tiktokMatch[1]}?autoplay=0" class="tiktok-iframe-player" allow="autoplay; encrypted-media" allowfullscreen title="${escapeHtml(v.title || 'TikTok video')}"></iframe>
                        </div>
                        <div class="video-card-body">
                            <span class="video-topic-badge"><i class="fa-brands fa-tiktok"></i> ${escapeHtml(v.topic || 'Tech Tip')}</span>
                            <h3>${escapeHtml(v.title || '')}</h3>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) { console.warn('Videos load error:', e); }
    }

    loadDynamicProducts();
    loadDynamicVideos();
});
