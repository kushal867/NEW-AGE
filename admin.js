// =============================================================================
// NewAge I.T. - CMS Admin Portal Core Script
// Backed by Supabase (Postgres + Auth + Row Level Security) instead of
// localStorage - admin edits now reach every visitor, not just this browser.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 0. Supabase client - anon key only (safe to expose; write access is
    //    enforced by Row Level Security requiring an authenticated session,
    //    see supabase/schema.sql). Shared credentials with the public site.
    // =========================================================================
    const SUPABASE_URL = window.SUPABASE_CONFIG?.url || '';
    const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || '';
    const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;
    if (!sb) console.warn('Supabase not configured - config.js is missing or empty. See .env.example.');

    // =========================================================================
    // Accent color theme (blue / orange) - same control and localStorage key
    // as the public site, so switching one switches the other too.
    // =========================================================================
    (function initAccentTheme() {
        const ACCENT_STORAGE_KEY = 'NEWAGE_ACCENT_THEME';
        const accentToggleBtn = document.getElementById('accentToggleBtn');
        let accentTheme = 'blue';
        try {
            if (localStorage.getItem(ACCENT_STORAGE_KEY) === 'orange') accentTheme = 'orange';
        } catch (e) { /* localStorage unavailable */ }

        function applyAccentTheme(theme) {
            accentTheme = theme;
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
    })();

    // =========================================================================
    // Image URL resolution (supports plain image URLs + Google Drive share links)
    // =========================================================================
    const PRODUCT_ICONS = {
        'Storage': 'fa-hard-drive',
        'Memory': 'fa-memory',
        'Peripherals': 'fa-keyboard',
        'Printing': 'fa-print',
        'Laptop Hardware': 'fa-tv',
        'Power & Cases': 'fa-microchip'
    };

    function resolveImageUrl(rawUrl) {
        const url = (rawUrl || '').trim();
        if (!url) return '';
        let driveId = '';
        const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        const openMatch = url.match(/drive\.google\.com\/open\?.*[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileMatch) driveId = fileMatch[1];
        else if (url.includes('drive.google.com') && openMatch) driveId = openMatch[1];
        if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
        return url;
    }

    function extractTikTokId(url) {
        const match = (url || '').match(/video\/(\d+)/) || (url || '').match(/player\/v1\/(\d+)/);
        return match ? match[1] : '';
    }

    function wireImagePreview(inputEl, boxEl, fallbackIconHtml, statusEl) {
        if (!inputEl || !boxEl) return;

        function update() {
            const resolved = resolveImageUrl(inputEl.value);
            boxEl.classList.remove('has-error');
            if (statusEl) { statusEl.textContent = ''; statusEl.className = 'field-status'; }

            if (!resolved) {
                boxEl.innerHTML = fallbackIconHtml;
                return;
            }

            const img = new Image();
            img.onload = () => {
                boxEl.innerHTML = '';
                boxEl.appendChild(img);
                if (statusEl) { statusEl.textContent = 'Image loaded.'; statusEl.className = 'field-status valid'; }
            };
            img.onerror = () => {
                boxEl.classList.add('has-error');
                boxEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                if (statusEl) { statusEl.textContent = "Couldn't load this image - check the link is shared publicly."; statusEl.className = 'field-status invalid'; }
            };
            img.src = resolved;
            img.alt = '';
        }

        inputEl.addEventListener('input', update);
        inputEl._previewUpdate = update;
    }

    // Wires a hidden <input type="file"> to upload straight to Supabase
    // Storage (the "media" bucket) and drop the resulting public URL into the
    // paired URL input, reusing that field's existing preview wiring.
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    function wireFileUpload(fileInputEl, urlInputEl, statusEl, folder) {
        if (!fileInputEl || !urlInputEl) return;

        fileInputEl.addEventListener('change', async () => {
            const file = fileInputEl.files?.[0];
            if (!file) return;

            const label = fileInputEl.previousElementSibling;
            const setStatus = (msg, type) => {
                if (!statusEl) return;
                statusEl.textContent = msg;
                statusEl.className = `field-status ${type || ''}`;
            };

            if (!sb) { setStatus('Database connection unavailable.', 'invalid'); fileInputEl.value = ''; return; }
            if (file.size > MAX_UPLOAD_BYTES) {
                setStatus('That file is over 5MB - choose a smaller image.', 'invalid');
                fileInputEl.value = '';
                return;
            }

            label?.classList.add('is-uploading');
            setStatus('Uploading...', '');

            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const path = `${folder}/${Date.now()}-${safeName}`;

            const { error: uploadError } = await sb.storage.from('media').upload(path, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });

            label?.classList.remove('is-uploading');
            fileInputEl.value = '';

            if (uploadError) {
                setStatus('Upload failed: ' + uploadError.message, 'invalid');
                return;
            }

            const { data } = sb.storage.from('media').getPublicUrl(path);
            urlInputEl.value = data.publicUrl;
            urlInputEl.dispatchEvent(new Event('input'));
            setStatus('Uploaded!', 'valid');
        });
    }

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
    // 1. Auth (real Supabase Auth session - server-verified, not a client-side
    //    hash comparison). Rate limiting on failed logins is handled by
    //    Supabase itself, not this script.
    // =========================================================================
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const loginForm = document.getElementById('loginForm');
    const loginFeedback = document.getElementById('loginFeedback');
    const logoutBtn = document.getElementById('logoutBtn');
    const togglePwBtn = document.getElementById('togglePwBtn');
    const adminPassword = document.getElementById('adminPassword');

    if (togglePwBtn && adminPassword) {
        togglePwBtn.addEventListener('click', () => {
            const isPassword = adminPassword.type === 'password';
            adminPassword.type = isPassword ? 'text' : 'password';
            togglePwBtn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        });
    }

    function showLoginFeedback(msg, type) {
        if (!loginFeedback) return;
        loginFeedback.style.display = 'block';
        loginFeedback.className = `login-feedback ${type}`;
        loginFeedback.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${escapeHtml(msg)}`;
    }

    function hideLoginFeedback() {
        if (loginFeedback) loginFeedback.style.display = 'none';
    }

    async function checkAuthUI() {
        const { data: { session } } = sb ? await sb.auth.getSession() : { data: { session: null } };
        if (session) {
            if (loginView) loginView.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'flex';
            const label = document.getElementById('sessionUserLabel');
            if (label) label.textContent = session.user?.email || 'Admin';
            initDashboard();
        } else {
            if (loginView) loginView.style.display = 'flex';
            if (dashboardView) dashboardView.style.display = 'none';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) { showLoginFeedback('Database connection unavailable. Please reload the page.', 'error'); return; }

            const email = document.getElementById('adminUsername')?.value?.trim();
            const password = document.getElementById('adminPassword')?.value || '';

            if (!email || !password) {
                showLoginFeedback('Please enter both your email and password.', 'error');
                return;
            }

            const submitBtn = document.getElementById('loginSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            const { error } = await sb.auth.signInWithPassword({ email, password });

            if (submitBtn) submitBtn.disabled = false;

            if (!error) {
                showLoginFeedback('Authentication successful! Loading CMS workspace...', 'success');
                setTimeout(() => { hideLoginFeedback(); checkAuthUI(); }, 400);
            } else {
                showLoginFeedback('Invalid email or password. Access denied.', 'error');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await sb?.auth.signOut();
            checkAuthUI();
        });
    }

    // =========================================================================
    // 2. Navigation & Tab Switching
    // =========================================================================
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('pageTitle');
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const mobileCloseSidebarBtn = document.getElementById('mobileCloseSidebarBtn');
    const dashboardSidebar = document.querySelector('.dashboard-sidebar');

    const TAB_TITLES = {
        overviewTab: 'System Overview',
        repairsTab: 'Repair Jobs Management',
        inquiriesTab: 'Customer Inquiries & Messages',
        productsTab: 'In-Store Product Catalogue',
        videosTab: 'Featured TikTok Tech Videos',
        settingsTab: 'System Security & Database Settings'
    };

    function switchTab(tabId) {
        menuItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === tabId));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
        if (pageTitle && TAB_TITLES[tabId]) pageTitle.textContent = TAB_TITLES[tabId];
        if (dashboardSidebar) dashboardSidebar.classList.remove('active');

        if (tabId === 'overviewTab') renderOverviewStats();
        if (tabId === 'repairsTab') { fetchRepairs().then(renderRepairsTable); }
        if (tabId === 'inquiriesTab') { fetchInquiries().then(renderInquiriesTable); }
        if (tabId === 'productsTab') { fetchProducts().then(renderProductsTable); }
        if (tabId === 'videosTab') { fetchVideos().then(renderVideosTable); }
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    mobileSidebarToggle?.addEventListener('click', () => dashboardSidebar?.classList.add('active'));
    mobileCloseSidebarBtn?.addEventListener('click', () => dashboardSidebar?.classList.remove('active'));

    document.getElementById('quickNewJobBtn')?.addEventListener('click', () => { switchTab('repairsTab'); openRepairModal(); });
    document.getElementById('quickViewInqBtn')?.addEventListener('click', () => switchTab('inquiriesTab'));
    document.getElementById('quickAddProductBtn')?.addEventListener('click', () => { switchTab('productsTab'); openProductModal(); });
    document.getElementById('quickSyncSheetBtn')?.addEventListener('click', () => switchTab('settingsTab'));

    // =========================================================================
    // 3. In-memory caches, refreshed from Supabase after every mutation so the
    //    UI (search/filter/pagination) stays instant without a round trip
    //    on every keystroke.
    // =========================================================================
    let repairsCache = [];
    let inquiriesCache = [];
    let productsCache = [];
    let videosCache = [];

    async function fetchRepairs() {
        if (!sb) return;
        const { data, error } = await sb.from('repairs').select('*').order('created_at', { ascending: false });
        if (error) { console.warn('Fetch repairs error:', error); return; }
        repairsCache = data || [];
    }

    async function fetchInquiries() {
        if (!sb) return;
        const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false });
        if (error) { console.warn('Fetch inquiries error:', error); return; }
        inquiriesCache = data || [];
    }

    async function fetchProducts() {
        if (!sb) return;
        const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
        if (error) { console.warn('Fetch products error:', error); return; }
        productsCache = data || [];
    }

    async function fetchVideos() {
        if (!sb) return;
        const { data, error } = await sb.from('videos').select('*').order('created_at', { ascending: false });
        if (error) { console.warn('Fetch videos error:', error); return; }
        videosCache = data || [];
    }

    // =========================================================================
    // 4. Dashboard Overview Tab
    // =========================================================================
    async function renderOverviewStats() {
        await Promise.all([fetchRepairs(), fetchInquiries(), fetchProducts()]);

        const totalRepairs = repairsCache.length;
        const pendingRepairs = repairsCache.filter(r => Number(r.stage) < 8).length;
        const totalInquiries = inquiriesCache.length;
        const newInquiries = inquiriesCache.filter(i => i.status === 'New').length;

        document.getElementById('statTotalRepairs').textContent = totalRepairs;
        document.getElementById('statPendingRepairs').textContent = `${pendingRepairs} actively in progress`;
        document.getElementById('statTotalInquiries').textContent = totalInquiries;
        document.getElementById('statNewInquiries').textContent = `${newInquiries} pending review`;
        document.getElementById('statTotalProducts').textContent = productsCache.length;

        document.getElementById('repairsCountBadge').textContent = pendingRepairs;
        document.getElementById('inquiriesCountBadge').textContent = newInquiries;
    }

    // =========================================================================
    // 5. Repair Jobs Management Tab (8 Stages)
    // =========================================================================
    const STAGE_NAMES = {
        1: '1. Received', 2: '2. Diagnosis', 3: '3. Quotation', 4: '4. Approval',
        5: '5. Repairing', 6: '6. Testing', 7: '7. Ready for Pickup', 8: '8. Delivered'
    };

    const repairSearchInput = document.getElementById('repairSearchInput');
    const repairStageFilter = document.getElementById('repairStageFilter');
    const repairsTableBody = document.getElementById('repairsTableBody');

    function renderRepairsTable() {
        if (!repairsTableBody) return;
        let list = repairsCache;

        const q = (repairSearchInput?.value || '').trim().toLowerCase();
        if (q) {
            list = list.filter(r =>
                (r.ticket_id || '').toLowerCase().includes(q) ||
                (r.customer_name || '').toLowerCase().includes(q) ||
                (r.phone || '').includes(q) ||
                (r.device || '').toLowerCase().includes(q)
            );
        }

        const stageF = repairStageFilter?.value;
        if (stageF) list = list.filter(r => String(r.stage) === stageF);

        if (list.length === 0) {
            repairsTableBody.innerHTML = `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No repair jobs match your current search or filter.
                </td></tr>`;
            return;
        }

        repairsTableBody.innerHTML = list.map(item => {
            const stage = Number(item.stage) || 1;
            const waMsg = encodeURIComponent(`Hello ${item.customer_name}, update on your repair ticket ${item.ticket_id} (${item.device}) at NewAge I.T. Solution Center: Current Status is Stage ${stage}/8 - ${STAGE_NAMES[stage]}. Estimated cost: ${item.cost}. Remarks: ${item.technician_notes}`);
            const waUrl = `https://wa.me/977${(item.phone || '').replace(/\D/g, '')}?text=${waMsg}`;

            return `
                <tr>
                    <td><strong style="color: var(--primary);">${escapeHtml(item.ticket_id)}</strong></td>
                    <td><div><strong>${escapeHtml(item.customer_name)}</strong></div><small style="color: var(--text-muted);">${escapeHtml(item.phone)}</small></td>
                    <td>${escapeHtml(item.device)}</td>
                    <td><span style="font-size: 0.85rem; color: #cbd5e1;">${escapeHtml(item.issue)}</span></td>
                    <td>
                        <select class="table-stage-select" data-ticket="${escapeHtml(item.ticket_id)}">
                            ${Object.keys(STAGE_NAMES).map(num => `<option value="${num}" ${Number(num) === stage ? 'selected' : ''}>${STAGE_NAMES[num]}</option>`).join('')}
                        </select>
                    </td>
                    <td><strong style="color: #4ade80;">${escapeHtml(item.cost || 'Pending')}</strong></td>
                    <td>
                        <div class="action-btn-group">
                            <a href="${waUrl}" target="_blank" class="btn-icon btn-icon-wa" title="Notify Customer on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                            <button type="button" class="btn-icon btn-edit-repair" data-ticket="${escapeHtml(item.ticket_id)}" title="Edit Repair Details"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button type="button" class="btn-icon btn-icon-del btn-del-repair" data-ticket="${escapeHtml(item.ticket_id)}" title="Delete Ticket"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        repairsTableBody.querySelectorAll('.table-stage-select').forEach(sel => {
            sel.addEventListener('change', (e) => updateRepairStage(sel.getAttribute('data-ticket'), Number(e.target.value)));
        });
        repairsTableBody.querySelectorAll('.btn-edit-repair').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = repairsCache.find(r => r.ticket_id === btn.getAttribute('data-ticket'));
                if (item) openRepairModal(item);
            });
        });
        repairsTableBody.querySelectorAll('.btn-del-repair').forEach(btn => {
            btn.addEventListener('click', () => deleteRepairJob(btn.getAttribute('data-ticket')));
        });
    }

    async function updateRepairStage(ticketId, newStage) {
        if (!sb) return;
        const { error } = await sb.from('repairs').update({ stage: newStage }).eq('ticket_id', ticketId);
        if (error) { alert('Could not update stage: ' + error.message); return; }
        await fetchRepairs();
        renderOverviewStats();
        renderRepairsTable();
    }

    async function deleteRepairJob(ticketId) {
        if (!confirm(`Are you sure you want to permanently delete repair ticket ${ticketId}?`)) return;
        const { error } = await sb.from('repairs').delete().eq('ticket_id', ticketId);
        if (error) { alert('Could not delete ticket: ' + error.message); return; }
        await fetchRepairs();
        renderOverviewStats();
        renderRepairsTable();
    }

    repairSearchInput?.addEventListener('input', renderRepairsTable);
    repairStageFilter?.addEventListener('change', renderRepairsTable);

    // Modal: New/Edit Repair Job
    const repairModal = document.getElementById('repairModal');
    const openNewJobModalBtn = document.getElementById('openNewJobModalBtn');
    const closeRepairModalBtn = document.getElementById('closeRepairModalBtn');
    const cancelRepairModalBtn = document.getElementById('cancelRepairModalBtn');
    const repairJobForm = document.getElementById('repairJobForm');
    let editingRepairTicketId = null;

    function openRepairModal(ticketData = null) {
        if (!repairModal) return;
        repairJobForm?.reset();
        editingRepairTicketId = ticketData ? ticketData.ticket_id : null;

        const titleEl = document.getElementById('repairModalTitle');
        const idInput = document.getElementById('jobTicketId');

        if (ticketData) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Ticket ${escapeHtml(ticketData.ticket_id)}`;
            if (idInput) { idInput.value = ticketData.ticket_id; idInput.readOnly = true; }
            document.getElementById('jobCustomerName').value = ticketData.customer_name || '';
            document.getElementById('jobPhone').value = ticketData.phone || '';
            document.getElementById('jobDevice').value = ticketData.device || '';
            document.getElementById('jobIssue').value = ticketData.issue || '';
            document.getElementById('jobStage').value = ticketData.stage || 1;
            document.getElementById('jobCost').value = ticketData.cost || '';
            document.getElementById('jobReceivedDate').value = ticketData.date_received || '';
            document.getElementById('jobDeliveryDate').value = ticketData.estimated_delivery || '';
            document.getElementById('jobNotes').value = ticketData.technician_notes || '';
        } else {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-screwdriver-wrench text-primary"></i> Add Repair Job`;
            if (idInput) { idInput.value = 'NA-' + Math.floor(1000 + Math.random() * 9000); idInput.readOnly = false; }
            document.getElementById('jobReceivedDate').value = new Date().toISOString().split('T')[0];
        }

        repairModal.style.display = 'flex';
    }

    openNewJobModalBtn?.addEventListener('click', () => openRepairModal());
    closeRepairModalBtn?.addEventListener('click', () => { if (repairModal) repairModal.style.display = 'none'; });
    cancelRepairModalBtn?.addEventListener('click', () => { if (repairModal) repairModal.style.display = 'none'; });

    if (repairJobForm) {
        repairJobForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('jobTicketId')?.value?.trim().toUpperCase();
            if (!ticketId || !sb) return;

            const stage = Number(document.getElementById('jobStage')?.value) || 1;
            const repairData = {
                customer_name: document.getElementById('jobCustomerName')?.value?.trim() || '',
                phone: document.getElementById('jobPhone')?.value?.trim() || '',
                device: document.getElementById('jobDevice')?.value?.trim() || '',
                issue: document.getElementById('jobIssue')?.value?.trim() || '',
                stage: stage,
                date_received: document.getElementById('jobReceivedDate')?.value || null,
                estimated_delivery: document.getElementById('jobDeliveryDate')?.value || '',
                cost: document.getElementById('jobCost')?.value?.trim() || 'Pending Quote',
                technician_notes: document.getElementById('jobNotes')?.value?.trim() || ''
            };

            const submitBtn = repairJobForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const { error } = editingRepairTicketId
                ? await sb.from('repairs').update(repairData).eq('ticket_id', ticketId)
                : await sb.from('repairs').insert({ ticket_id: ticketId, ...repairData });

            if (submitBtn) submitBtn.disabled = false;
            if (error) { alert('Could not save repair job: ' + error.message); return; }

            editingRepairTicketId = null;
            repairModal.style.display = 'none';
            await fetchRepairs();
            renderOverviewStats();
            renderRepairsTable();
        });
    }

    // =========================================================================
    // 6. Customer Inquiries Management Tab
    // =========================================================================
    const inquirySearchInput = document.getElementById('inquirySearchInput');
    const inquiriesTableBody = document.getElementById('inquiriesTableBody');

    function renderInquiriesTable() {
        if (!inquiriesTableBody) return;
        let list = inquiriesCache;

        const q = (inquirySearchInput?.value || '').trim().toLowerCase();
        if (q) {
            list = list.filter(i =>
                (i.customer_name || '').toLowerCase().includes(q) ||
                (i.phone || '').includes(q) ||
                (i.message || '').toLowerCase().includes(q) ||
                (i.ticket_id || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            inquiriesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No customer inquiries found.</td></tr>`;
            return;
        }

        inquiriesTableBody.innerHTML = list.map(item => {
            const waMsg = encodeURIComponent(`Hello ${item.customer_name}, this is Indra Kumar Shrestha from NewAge I.T. Solution Center responding to your website inquiry regarding "${item.service}". How can we help you today?`);
            const waUrl = `https://wa.me/977${(item.phone || '').replace(/\D/g, '')}?text=${waMsg}`;
            const dateStr = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'Recent';

            return `
                <tr>
                    <td><small style="color: var(--text-muted);">${escapeHtml(dateStr)}</small></td>
                    <td><strong style="color: var(--primary);">${escapeHtml(item.ticket_id || 'N/A')}</strong></td>
                    <td><div><strong>${escapeHtml(item.customer_name)}</strong></div><small style="color: var(--text-muted);">${escapeHtml(item.phone)} &bull; ${escapeHtml(item.email || '')}</small></td>
                    <td><span class="badge" style="background: rgba(255,255,255,0.06); color:#fff;">${escapeHtml(item.service)}</span></td>
                    <td style="max-width: 250px;"><p style="font-size: 0.85rem; color: #cbd5e1; margin: 0; line-height: 1.4;">${escapeHtml(item.message)}</p></td>
                    <td>
                        <select class="table-stage-select inq-status-select" data-id="${escapeHtml(item.id)}">
                            <option value="New" ${item.status === 'New' ? 'selected' : ''}>New</option>
                            <option value="Contacted" ${item.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                            <option value="In Repair" ${item.status === 'In Repair' ? 'selected' : ''}>Converted to Repair</option>
                            <option value="Closed" ${item.status === 'Closed' ? 'selected' : ''}>Closed / Archived</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <a href="${waUrl}" target="_blank" class="btn-icon btn-icon-wa" title="Reply on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                            <a href="tel:${escapeHtml(item.phone)}" class="btn-icon" title="Call Customer"><i class="fa-solid fa-phone"></i></a>
                            <button type="button" class="btn-icon btn-icon-del btn-del-inq" data-id="${escapeHtml(item.id)}" title="Delete Inquiry"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        inquiriesTableBody.querySelectorAll('.inq-status-select').forEach(sel => {
            sel.addEventListener('change', (e) => updateInquiryStatus(sel.getAttribute('data-id'), e.target.value));
        });
        inquiriesTableBody.querySelectorAll('.btn-del-inq').forEach(btn => {
            btn.addEventListener('click', () => deleteInquiry(btn.getAttribute('data-id')));
        });
    }

    async function updateInquiryStatus(id, status) {
        const { error } = await sb.from('inquiries').update({ status }).eq('id', id);
        if (error) { alert('Could not update status: ' + error.message); return; }
        await fetchInquiries();
        renderOverviewStats();
    }

    async function deleteInquiry(id) {
        if (!confirm('Are you sure you want to delete this customer inquiry?')) return;
        const { error } = await sb.from('inquiries').delete().eq('id', id);
        if (error) { alert('Could not delete inquiry: ' + error.message); return; }
        await fetchInquiries();
        renderOverviewStats();
        renderInquiriesTable();
    }

    inquirySearchInput?.addEventListener('input', renderInquiriesTable);

    document.getElementById('clearArchivedInquiriesBtn')?.addEventListener('click', async () => {
        if (!confirm('Clear all closed inquiries from the list?')) return;
        const closedIds = inquiriesCache.filter(i => i.status === 'Closed').map(i => i.id);
        if (!closedIds.length) return;
        const { error } = await sb.from('inquiries').delete().in('id', closedIds);
        if (error) { alert('Could not clear archived inquiries: ' + error.message); return; }
        await fetchInquiries();
        renderOverviewStats();
        renderInquiriesTable();
    });

    // =========================================================================
    // 7. Product Catalogue Management Tab (search, filter, pagination, bulk
    //    delete - built to stay usable with 100+ products)
    // =========================================================================
    const PRODUCTS_PAGE_SIZE = 20;
    const productsTableBody = document.getElementById('productsTableBody');
    const productModal = document.getElementById('productModal');
    const productModalTitleEl = document.querySelector('#productModal .cms-modal-header h3');
    const openAddProductModalBtn = document.getElementById('openAddProductModalBtn');
    const closeProductModalBtn = document.getElementById('closeProductModalBtn');
    const cancelProductModalBtn = document.getElementById('cancelProductModalBtn');
    const productForm = document.getElementById('productForm');
    const prodImageUrlInput = document.getElementById('prodImageUrl');
    const prodImagePreviewBox = document.getElementById('prodImagePreviewBox');
    const prodImageStatus = document.getElementById('prodImageStatus');
    const prodImageFile = document.getElementById('prodImageFile');
    const productSearchInput = document.getElementById('productSearchInput');
    const productCategoryFilter = document.getElementById('productCategoryFilter');
    const productStockFilter = document.getElementById('productStockFilter');
    const productSelectAllOnPage = document.getElementById('productSelectAllOnPage');
    const productBulkBar = document.getElementById('productBulkBar');
    const productBulkCount = document.getElementById('productBulkCount');
    const productBulkDeleteBtn = document.getElementById('productBulkDeleteBtn');
    const productBulkClearBtn = document.getElementById('productBulkClearBtn');
    const productPaginationSummary = document.getElementById('productPaginationSummary');
    const productPaginationLabel = document.getElementById('productPaginationLabel');
    const productPrevPageBtn = document.getElementById('productPrevPageBtn');
    const productNextPageBtn = document.getElementById('productNextPageBtn');

    let editingProductId = null;
    let currentProductPage = 1;
    let selectedProductIds = new Set();
    let currentPageProductIds = [];

    wireImagePreview(prodImageUrlInput, prodImagePreviewBox, '<i class="fa-solid fa-image"></i>', prodImageStatus);
    wireFileUpload(prodImageFile, prodImageUrlInput, prodImageStatus, 'products');

    function getFilteredProducts() {
        const q = (productSearchInput?.value || '').trim().toLowerCase();
        const cat = productCategoryFilter?.value || '';
        const stock = productStockFilter?.value || '';

        return productsCache.filter(item => {
            if (cat && item.category !== cat) return false;
            if (stock && item.stock !== stock) return false;
            if (q) {
                const haystack = `${item.title} ${item.spec} ${item.category}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }

    function updateProductBulkBar() {
        if (!productBulkBar) return;
        const count = selectedProductIds.size;
        productBulkBar.hidden = count === 0;
        if (productBulkCount) productBulkCount.textContent = `${count} selected`;

        if (productSelectAllOnPage) {
            const onPage = currentPageProductIds;
            const selectedOnPage = onPage.filter(id => selectedProductIds.has(id));
            productSelectAllOnPage.checked = onPage.length > 0 && selectedOnPage.length === onPage.length;
            productSelectAllOnPage.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < onPage.length;
        }
    }

    function renderProductsTable() {
        if (!productsTableBody) return;
        const filtered = getFilteredProducts();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));
        currentProductPage = Math.min(Math.max(1, currentProductPage), totalPages);

        const start = (currentProductPage - 1) * PRODUCTS_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PRODUCTS_PAGE_SIZE);
        currentPageProductIds = pageItems.map(item => item.id);

        if (pageItems.length === 0) {
            productsTableBody.innerHTML = `
                <tr><td colspan="9" style="text-align:center; color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-box-open" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No products match your search or filters.
                </td></tr>`;
        } else {
            productsTableBody.innerHTML = pageItems.map(item => {
                const resolvedImg = resolveImageUrl(item.image);
                const icon = PRODUCT_ICONS[item.category] || 'fa-box';
                const thumbHtml = resolvedImg
                    ? `<img class="table-thumb" src="${escapeHtml(resolvedImg)}" alt="" onerror="this.outerHTML='&lt;div class=&quot;table-thumb-fallback&quot;&gt;&lt;i class=&quot;fa-solid ${icon}&quot;&gt;&lt;/i&gt;&lt;/div&gt;'">`
                    : `<div class="table-thumb-fallback"><i class="fa-solid ${icon}"></i></div>`;
                const checked = selectedProductIds.has(item.id) ? 'checked' : '';

                return `
                <tr>
                    <td><input type="checkbox" class="product-row-check" data-id="${escapeHtml(item.id)}" ${checked}></td>
                    <td>${thumbHtml}</td>
                    <td><span class="badge" style="background: rgba(0, 210, 255, 0.1); color: var(--primary);">${escapeHtml(item.category)}</span></td>
                    <td><strong>${escapeHtml(item.title)}</strong></td>
                    <td><small style="color: var(--text-muted);">${escapeHtml(item.spec)}</small></td>
                    <td><span style="text-decoration: line-through; color: #64748b;">${escapeHtml(item.mrp || '')}</span></td>
                    <td><strong style="color: var(--primary);">${escapeHtml(item.price)}</strong></td>
                    <td><span class="status-pill ${item.stock === 'in-stock' ? 'stock' : 'preorder'}">${item.stock === 'in-stock' ? 'In Stock' : 'Available on Order'}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button type="button" class="btn-icon btn-edit-prod" data-id="${escapeHtml(item.id)}" title="Edit Product"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button type="button" class="btn-icon btn-icon-del btn-del-prod" data-id="${escapeHtml(item.id)}" title="Delete Product"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        productsTableBody.querySelectorAll('.btn-del-prod').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.getAttribute('data-id')));
        });
        productsTableBody.querySelectorAll('.btn-edit-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = productsCache.find(p => p.id === btn.getAttribute('data-id'));
                if (item) openProductModal(item);
            });
        });
        productsTableBody.querySelectorAll('.product-row-check').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.getAttribute('data-id');
                if (cb.checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
                updateProductBulkBar();
            });
        });

        if (productPaginationSummary) {
            productPaginationSummary.textContent = filtered.length === 0
                ? 'No products found'
                : `Showing ${start + 1}-${Math.min(start + PRODUCTS_PAGE_SIZE, filtered.length)} of ${filtered.length} products`;
        }
        if (productPaginationLabel) productPaginationLabel.textContent = `Page ${currentProductPage} of ${totalPages}`;
        if (productPrevPageBtn) productPrevPageBtn.disabled = currentProductPage <= 1;
        if (productNextPageBtn) productNextPageBtn.disabled = currentProductPage >= totalPages;

        updateProductBulkBar();
    }

    productSearchInput?.addEventListener('input', () => { currentProductPage = 1; renderProductsTable(); });
    productCategoryFilter?.addEventListener('change', () => { currentProductPage = 1; renderProductsTable(); });
    productStockFilter?.addEventListener('change', () => { currentProductPage = 1; renderProductsTable(); });
    productPrevPageBtn?.addEventListener('click', () => { currentProductPage -= 1; renderProductsTable(); });
    productNextPageBtn?.addEventListener('click', () => { currentProductPage += 1; renderProductsTable(); });

    productSelectAllOnPage?.addEventListener('change', () => {
        if (productSelectAllOnPage.checked) currentPageProductIds.forEach(id => selectedProductIds.add(id));
        else currentPageProductIds.forEach(id => selectedProductIds.delete(id));
        renderProductsTable();
    });

    productBulkClearBtn?.addEventListener('click', () => { selectedProductIds.clear(); renderProductsTable(); });

    productBulkDeleteBtn?.addEventListener('click', async () => {
        const ids = Array.from(selectedProductIds);
        if (!ids.length) return;
        if (!confirm(`Permanently remove ${ids.length} selected product${ids.length > 1 ? 's' : ''} from the website catalogue?`)) return;
        const { error } = await sb.from('products').delete().in('id', ids);
        if (error) { alert('Could not delete products: ' + error.message); return; }
        selectedProductIds.clear();
        await fetchProducts();
        renderOverviewStats();
        renderProductsTable();
    });

    async function deleteProduct(id) {
        if (!confirm('Remove this product from the website catalogue?')) return;
        const { error } = await sb.from('products').delete().eq('id', id);
        if (error) { alert('Could not delete product: ' + error.message); return; }
        selectedProductIds.delete(id);
        await fetchProducts();
        renderOverviewStats();
        renderProductsTable();
    }

    function openProductModal(productData = null) {
        if (!productModal) return;
        productForm?.reset();
        editingProductId = productData ? productData.id : null;

        if (productModalTitleEl) {
            productModalTitleEl.innerHTML = productData
                ? '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Product'
                : '<i class="fa-solid fa-box-open text-primary"></i> Add Catalogue Product';
        }

        if (productData) {
            document.getElementById('prodTitle').value = productData.title || '';
            document.getElementById('prodCategory').value = productData.category || 'Storage';
            document.getElementById('prodSpec').value = productData.spec || '';
            document.getElementById('prodMrp').value = productData.mrp || '';
            document.getElementById('prodPrice').value = productData.price || '';
            document.getElementById('prodStock').value = productData.stock || 'in-stock';
            if (prodImageUrlInput) prodImageUrlInput.value = productData.image || '';
        }
        prodImageUrlInput?._previewUpdate?.();
        productModal.style.display = 'flex';
    }

    openAddProductModalBtn?.addEventListener('click', () => openProductModal());
    closeProductModalBtn?.addEventListener('click', () => { if (productModal) productModal.style.display = 'none'; });
    cancelProductModalBtn?.addEventListener('click', () => { if (productModal) productModal.style.display = 'none'; });

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;
            const prodData = {
                title: document.getElementById('prodTitle')?.value?.trim() || '',
                category: document.getElementById('prodCategory')?.value || 'Storage',
                spec: document.getElementById('prodSpec')?.value?.trim() || '',
                mrp: document.getElementById('prodMrp')?.value?.trim() || '',
                price: document.getElementById('prodPrice')?.value?.trim() || '',
                stock: document.getElementById('prodStock')?.value || 'in-stock',
                image: prodImageUrlInput?.value?.trim() || ''
            };

            const submitBtn = productForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const { error } = editingProductId
                ? await sb.from('products').update(prodData).eq('id', editingProductId)
                : await sb.from('products').insert(prodData);

            if (submitBtn) submitBtn.disabled = false;
            if (error) { alert('Could not save product: ' + error.message); return; }

            editingProductId = null;
            productModal.style.display = 'none';
            await fetchProducts();
            renderOverviewStats();
            renderProductsTable();
        });
    }

    // =========================================================================
    // 8. TikTok Videos Management Tab
    // =========================================================================
    const videosTableBody = document.getElementById('videosTableBody');
    const videoModal = document.getElementById('videoModal');
    const videoModalTitleEl = document.querySelector('#videoModal .cms-modal-header h3');
    const openAddVideoModalBtn = document.getElementById('openAddVideoModalBtn');
    const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
    const cancelVideoModalBtn = document.getElementById('cancelVideoModalBtn');
    const videoForm = document.getElementById('videoForm');
    const vidUrlInput = document.getElementById('vidUrl');
    const vidUrlStatus = document.getElementById('vidUrlStatus');
    const vidThumbUrlInput = document.getElementById('vidThumbUrl');
    const vidImagePreviewBox = document.getElementById('vidImagePreviewBox');
    const vidImageStatus = document.getElementById('vidImageStatus');
    const vidImageFile = document.getElementById('vidImageFile');
    const videoLivePreview = document.getElementById('videoLivePreview');
    const videoLivePreviewFrame = document.getElementById('videoLivePreviewFrame');
    let editingVideoId = null;

    wireImagePreview(vidThumbUrlInput, vidImagePreviewBox, '<i class="fa-brands fa-tiktok"></i>', vidImageStatus);
    wireFileUpload(vidImageFile, vidThumbUrlInput, vidImageStatus, 'videos');

    function updateVideoUrlPreview() {
        const tiktokId = extractTikTokId(vidUrlInput?.value || '');
        if (!vidUrlInput?.value) {
            if (vidUrlStatus) { vidUrlStatus.textContent = ''; vidUrlStatus.className = 'field-status'; }
            if (videoLivePreview) videoLivePreview.hidden = true;
            return;
        }
        if (tiktokId) {
            if (vidUrlStatus) { vidUrlStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Valid TikTok video link.'; vidUrlStatus.className = 'field-status valid'; }
            if (videoLivePreview && videoLivePreviewFrame) {
                videoLivePreview.hidden = false;
                videoLivePreviewFrame.innerHTML = `<iframe src="https://www.tiktok.com/player/v1/${tiktokId}?autoplay=0" allow="autoplay; encrypted-media" allowfullscreen title="TikTok preview"></iframe>`;
            }
        } else {
            if (vidUrlStatus) { vidUrlStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Could not find a video ID in this link.'; vidUrlStatus.className = 'field-status invalid'; }
            if (videoLivePreview) videoLivePreview.hidden = true;
        }
    }
    vidUrlInput?.addEventListener('input', updateVideoUrlPreview);

    function renderVideosTable() {
        if (!videosTableBody) return;
        videosTableBody.innerHTML = videosCache.map(item => {
            const resolvedImg = resolveImageUrl(item.thumbnail);
            const thumbHtml = resolvedImg
                ? `<img class="table-thumb" src="${escapeHtml(resolvedImg)}" alt="" onerror="this.outerHTML='&lt;div class=&quot;table-thumb-fallback&quot;&gt;&lt;i class=&quot;fa-brands fa-tiktok&quot;&gt;&lt;/i&gt;&lt;/div&gt;'">`
                : `<div class="table-thumb-fallback"><i class="fa-brands fa-tiktok"></i></div>`;

            return `
                <tr>
                    <td>${thumbHtml}</td>
                    <td><strong>${escapeHtml(item.title)}</strong></td>
                    <td><span class="badge" style="background: rgba(255,0,80,0.15); color: #ff0050;">${escapeHtml(item.topic)}</span></td>
                    <td><a href="${escapeHtml(item.url)}" target="_blank" style="color: var(--primary); text-decoration: underline;">${escapeHtml(item.url)}</a></td>
                    <td><span style="color: #4ade80; font-weight: 600;"><i class="fa-solid fa-eye"></i> ${escapeHtml(item.views)}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button type="button" class="btn-icon btn-edit-vid" data-id="${escapeHtml(item.id)}" title="Edit Video"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button type="button" class="btn-icon btn-icon-del btn-del-vid" data-id="${escapeHtml(item.id)}" title="Delete Video"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        videosTableBody.querySelectorAll('.btn-del-vid').forEach(btn => {
            btn.addEventListener('click', () => deleteVideo(btn.getAttribute('data-id')));
        });
        videosTableBody.querySelectorAll('.btn-edit-vid').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = videosCache.find(v => v.id === btn.getAttribute('data-id'));
                if (item) openVideoModal(item);
            });
        });
    }

    async function deleteVideo(id) {
        if (!confirm('Remove this video reel from the showcase?')) return;
        const { error } = await sb.from('videos').delete().eq('id', id);
        if (error) { alert('Could not delete video: ' + error.message); return; }
        await fetchVideos();
        renderVideosTable();
    }

    function openVideoModal(videoData = null) {
        if (!videoModal) return;
        videoForm?.reset();
        editingVideoId = videoData ? videoData.id : null;

        if (videoModalTitleEl) {
            videoModalTitleEl.innerHTML = videoData
                ? '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit TikTok Video'
                : '<i class="fa-brands fa-tiktok text-primary"></i> Add TikTok Tech Video';
        }

        if (videoData) {
            document.getElementById('vidTitle').value = videoData.title || '';
            document.getElementById('vidTopic').value = videoData.topic || '';
            document.getElementById('vidViews').value = videoData.views || '';
            if (vidUrlInput) vidUrlInput.value = videoData.url || '';
            if (vidThumbUrlInput) vidThumbUrlInput.value = videoData.thumbnail || '';
        }
        updateVideoUrlPreview();
        vidThumbUrlInput?._previewUpdate?.();
        videoModal.style.display = 'flex';
    }

    openAddVideoModalBtn?.addEventListener('click', () => openVideoModal());
    closeVideoModalBtn?.addEventListener('click', () => { if (videoModal) videoModal.style.display = 'none'; });
    cancelVideoModalBtn?.addEventListener('click', () => { if (videoModal) videoModal.style.display = 'none'; });

    if (videoForm) {
        videoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;
            const tiktokId = extractTikTokId(vidUrlInput?.value || '');
            if (!tiktokId) {
                vidUrlInput?.focus();
                if (vidUrlStatus) { vidUrlStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Enter a valid TikTok video link before saving.'; vidUrlStatus.className = 'field-status invalid'; }
                return;
            }

            const vidData = {
                title: document.getElementById('vidTitle')?.value?.trim() || '',
                topic: document.getElementById('vidTopic')?.value?.trim() || 'Tech Tip',
                views: document.getElementById('vidViews')?.value?.trim() || '10K+ views',
                url: vidUrlInput?.value?.trim() || '',
                thumbnail: vidThumbUrlInput?.value?.trim() || ''
            };

            const submitBtn = videoForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const { error } = editingVideoId
                ? await sb.from('videos').update(vidData).eq('id', editingVideoId)
                : await sb.from('videos').insert(vidData);

            if (submitBtn) submitBtn.disabled = false;
            if (error) { alert('Could not save video: ' + error.message); return; }

            editingVideoId = null;
            videoModal.style.display = 'none';
            await fetchVideos();
            renderVideosTable();
        });
    }

    // =========================================================================
    // 9. Security & Settings Tab
    // =========================================================================
    const changePasswordForm = document.getElementById('changePasswordForm');
    const pwChangeFeedback = document.getElementById('pwChangeFeedback');
    const exportBackupBtn = document.getElementById('exportBackupBtn');

    function showPwFeedback(msg, type) {
        if (!pwChangeFeedback) return;
        pwChangeFeedback.style.display = 'block';
        pwChangeFeedback.className = `login-feedback ${type}`;
        pwChangeFeedback.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${escapeHtml(msg)}`;
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;
            const curr = document.getElementById('currentPassword')?.value || '';
            const newP = document.getElementById('newPassword')?.value || '';
            const conf = document.getElementById('confirmNewPassword')?.value || '';

            if (newP !== conf) { showPwFeedback('New passwords do not match.', 'error'); return; }
            if (newP.length < 8) { showPwFeedback('New password must be at least 8 characters.', 'error'); return; }

            const { data: { session } } = await sb.auth.getSession();
            const email = session?.user?.email;
            if (!email) { showPwFeedback('Session expired. Please log in again.', 'error'); return; }

            // Re-verify the current password before allowing a change
            const { error: verifyError } = await sb.auth.signInWithPassword({ email, password: curr });
            if (verifyError) { showPwFeedback('Current master password verification failed.', 'error'); return; }

            const { error: updateError } = await sb.auth.updateUser({ password: newP });
            if (updateError) { showPwFeedback('Could not update password: ' + updateError.message, 'error'); return; }

            showPwFeedback('Master password updated successfully!', 'success');
            changePasswordForm.reset();
        });
    }

    // Export Backup JSON (now sourced from Supabase instead of localStorage)
    exportBackupBtn?.addEventListener('click', async () => {
        await Promise.all([fetchRepairs(), fetchInquiries(), fetchProducts(), fetchVideos()]);
        const backup = {
            exportDate: new Date().toISOString(),
            business: 'NewAge I.T. Solution Center',
            repairs: repairsCache,
            inquiries: inquiriesCache,
            products: productsCache,
            videos: videosCache
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newage-it-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Initialize Dashboard
    async function initDashboard() {
        await Promise.all([fetchRepairs(), fetchInquiries(), fetchProducts(), fetchVideos()]);
        renderOverviewStats();
        renderRepairsTable();
        renderInquiriesTable();
        renderProductsTable();
        renderVideosTable();
    }

    // Initial check
    checkAuthUI();
});
