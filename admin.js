// =============================================================================
// NewAge I.T. - CMS Admin Portal Core Script
// Salted SHA-256 Cryptographic Authentication, Brute-Force Lockout, Session Guard,
// Full CRUD for Repairs (Stages 1-8), Customer Inquiries & Catalogue
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. Security & Cryptographic Auth Configuration
    // =========================================================================
    const SALT = 'NEWAGE_CMS_SALT_2069';
    const DEFAULT_HASH = 'cce69fc648225462ea1f5efad3f8642de9309d55dbde59c28d130a0a614b236d'; // NewAge@2069#Secure!
    const STORAGE_KEY_PASS_HASH = 'NEWAGE_CMS_PASS_HASH';
    const STORAGE_KEY_AUTH_SESSION = 'NEWAGE_CMS_SESSION_TOKEN';
    const STORAGE_KEY_FAIL_ATTEMPTS = 'NEWAGE_CMS_FAIL_COUNT';
    const STORAGE_KEY_LOCKOUT_UNTIL = 'NEWAGE_CMS_LOCKOUT_UNTIL';
    const STORAGE_KEY_REPAIRS = 'NEWAGE_REPAIRS_DB';
    const STORAGE_KEY_INQUIRIES = 'NEWAGE_INQUIRIES_DB';
    const STORAGE_KEY_PRODUCTS = 'NEWAGE_PRODUCTS_DB';
    const STORAGE_KEY_VIDEOS = 'NEWAGE_TIKTOK_VIDEOS_DB';
    const STORAGE_KEY_SHEET_URL = 'NEWAGE_SHEET_API_URL';

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

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

    // Converts a Google Drive "share" link (file/d/ID/view or open?id=ID) into a
    // directly-hotlinkable image URL. Any other URL (Google Photos direct links,
    // Imgur, self-hosted, etc.) is returned unchanged.
    function resolveImageUrl(rawUrl) {
        const url = (rawUrl || '').trim();
        if (!url) return '';

        let driveId = '';
        const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        const openMatch = url.match(/drive\.google\.com\/open\?.*[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

        if (fileMatch) driveId = fileMatch[1];
        else if (url.includes('drive.google.com') && openMatch) driveId = openMatch[1];

        if (driveId) {
            return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
        }
        return url;
    }

    function extractTikTokId(url) {
        const match = (url || '').match(/video\/(\d+)/) || (url || '').match(/player\/v1\/(\d+)/);
        return match ? match[1] : '';
    }

    // Wires an <input type="url"> to a live thumbnail preview box, converting
    // Google Drive links automatically and falling back to an icon on error/empty.
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
        update.run = update;
        inputEl._previewUpdate = update;
    }

    // Compute SHA-256 Hash using browser Web Crypto API
    async function sha256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function getStoredHash() {
        return localStorage.getItem(STORAGE_KEY_PASS_HASH) || DEFAULT_HASH;
    }

    function setStoredHash(hash) {
        localStorage.setItem(STORAGE_KEY_PASS_HASH, hash);
    }

    // =========================================================================
    // 2. Session Guard & Rate-Limiting Protection
    // =========================================================================
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const loginForm = document.getElementById('loginForm');
    const loginFeedback = document.getElementById('loginFeedback');
    const logoutBtn = document.getElementById('logoutBtn');
    const togglePwBtn = document.getElementById('togglePwBtn');
    const adminPassword = document.getElementById('adminPassword');

    // Toggle password visibility
    if (togglePwBtn && adminPassword) {
        togglePwBtn.addEventListener('click', () => {
            const isPassword = adminPassword.type === 'password';
            adminPassword.type = isPassword ? 'text' : 'password';
            togglePwBtn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        });
    }

    function isLockedOut() {
        const lockoutTime = Number(localStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL)) || 0;
        return Date.now() < lockoutTime;
    }

    function getLockoutRemainingSeconds() {
        const lockoutTime = Number(localStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL)) || 0;
        return Math.max(0, Math.ceil((lockoutTime - Date.now()) / 1000));
    }

    function recordFailedAttempt() {
        const currentFails = (Number(localStorage.getItem(STORAGE_KEY_FAIL_ATTEMPTS)) || 0) + 1;
        localStorage.setItem(STORAGE_KEY_FAIL_ATTEMPTS, currentFails);

        if (currentFails >= MAX_ATTEMPTS) {
            localStorage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, Date.now() + LOCKOUT_DURATION_MS);
            localStorage.removeItem(STORAGE_KEY_FAIL_ATTEMPTS);
        }
    }

    function resetFailedAttempts() {
        localStorage.removeItem(STORAGE_KEY_FAIL_ATTEMPTS);
        localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
    }

    function isAuthenticated() {
        try {
            const sessionRaw = sessionStorage.getItem(STORAGE_KEY_AUTH_SESSION);
            if (!sessionRaw) return false;
            const session = JSON.parse(sessionRaw);
            if (!session || !session.token || !session.expiresAt) return false;
            if (Date.now() > session.expiresAt) {
                sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function createSession(username) {
        const session = {
            username: username || 'admin',
            token: 'tkn_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
            expiresAt: Date.now() + 2 * 3600 * 1000 // 2 hours session expiry
        };
        sessionStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(session));
    }

    function checkAuthUI() {
        if (isAuthenticated()) {
            if (loginView) loginView.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'flex';
            initDashboard();
        } else {
            if (loginView) loginView.style.display = 'flex';
            if (dashboardView) dashboardView.style.display = 'none';
            checkLockoutState();
        }
    }

    function checkLockoutState() {
        if (isLockedOut()) {
            const sec = getLockoutRemainingSeconds();
            showLoginFeedback(`Too many failed login attempts. System locked for security. Try again in ${sec}s.`, 'error');
            const submitBtn = document.getElementById('loginSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            const timer = setInterval(() => {
                const remain = getLockoutRemainingSeconds();
                if (remain <= 0) {
                    clearInterval(timer);
                    if (submitBtn) submitBtn.disabled = false;
                    hideLoginFeedback();
                } else {
                    showLoginFeedback(`Too many failed login attempts. System locked for security. Try again in ${remain}s.`, 'error');
                }
            }, 1000);
        }
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

    // Handle Login Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (isLockedOut()) {
                checkLockoutState();
                return;
            }

            const username = document.getElementById('adminUsername')?.value?.trim();
            const password = document.getElementById('adminPassword')?.value || '';

            if (!username || !password) {
                showLoginFeedback('Please enter both username and password.', 'error');
                return;
            }

            // Verify Username (Accepts "admin" or "indra.newage")
            if (username.toLowerCase() !== 'admin' && username.toLowerCase() !== 'indra.newage') {
                recordFailedAttempt();
                showLoginFeedback('Invalid admin credentials. Access denied.', 'error');
                return;
            }

            // Hash input password with salt and verify
            const inputHash = await sha256(SALT + password);
            const targetHash = getStoredHash();

            if (inputHash === targetHash) {
                resetFailedAttempts();
                createSession(username);
                showLoginFeedback('Authentication successful! Loading CMS workspace...', 'success');
                setTimeout(() => {
                    hideLoginFeedback();
                    checkAuthUI();
                }, 400);
            } else {
                recordFailedAttempt();
                const fails = Number(localStorage.getItem(STORAGE_KEY_FAIL_ATTEMPTS)) || 1;
                const remaining = MAX_ATTEMPTS - fails;
                if (remaining > 0) {
                    showLoginFeedback(`Invalid password. Access denied (${remaining} attempts remaining before lockout).`, 'error');
                } else {
                    checkLockoutState();
                }
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
            checkAuthUI();
        });
    }

    // =========================================================================
    // 3. Navigation & Tab Switching
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
        menuItems.forEach(item => {
            const isActive = item.getAttribute('data-tab') === tabId;
            item.classList.toggle('active', isActive);
        });

        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });

        if (pageTitle && TAB_TITLES[tabId]) {
            pageTitle.textContent = TAB_TITLES[tabId];
        }

        if (dashboardSidebar) {
            dashboardSidebar.classList.remove('active');
        }

        // Re-render specific tab contents
        if (tabId === 'overviewTab') renderOverviewStats();
        if (tabId === 'repairsTab') renderRepairsTable();
        if (tabId === 'inquiriesTab') renderInquiriesTable();
        if (tabId === 'productsTab') renderProductsTable();
        if (tabId === 'videosTab') renderVideosTable();
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    if (mobileSidebarToggle && dashboardSidebar) {
        mobileSidebarToggle.addEventListener('click', () => {
            dashboardSidebar.classList.add('active');
        });
    }

    if (mobileCloseSidebarBtn && dashboardSidebar) {
        mobileCloseSidebarBtn.addEventListener('click', () => {
            dashboardSidebar.classList.remove('active');
        });
    }

    // Quick action buttons on overview tab
    document.getElementById('quickNewJobBtn')?.addEventListener('click', () => {
        switchTab('repairsTab');
        openRepairModal();
    });
    document.getElementById('quickViewInqBtn')?.addEventListener('click', () => {
        switchTab('inquiriesTab');
    });
    document.getElementById('quickAddProductBtn')?.addEventListener('click', () => {
        switchTab('productsTab');
        openProductModal();
    });
    document.getElementById('quickSyncSheetBtn')?.addEventListener('click', () => {
        switchTab('settingsTab');
    });

    // =========================================================================
    // 4. Data Stores & Seed Data
    // =========================================================================
    const DEFAULT_REPAIRS = {
        'NA-1001': {
            ticketId: 'NA-1001',
            customerName: 'Bikash Sharma',
            phone: '9841301930',
            device: 'Dell Inspiron 15 Gaming Laptop',
            issue: 'Power on failure / Motherboard short circuit',
            stage: 5,
            statusLabel: 'Repairing',
            dateReceived: '2026-09-06',
            estimatedDelivery: '2026-09-10',
            cost: 'NPR 3,500',
            technicianNotes: 'Replacing power management IC and charging capacitors. Cleaned fans and applied Arctic MX-4.'
        },
        'NA-1002': {
            ticketId: 'NA-1002',
            customerName: 'Pooja Shrestha',
            phone: '9801234567',
            device: 'Apple MacBook Air M1',
            issue: 'Cracked display panel / Screen lines',
            stage: 7,
            statusLabel: 'Ready for Pickup',
            dateReceived: '2026-09-05',
            estimatedDelivery: '2026-09-08',
            cost: 'NPR 18,000',
            technicianNotes: 'Original Retina display replaced and calibrated. 90-day NewAge warranty slip ready for collection.'
        },
        'NA-1003': {
            ticketId: 'NA-1003',
            customerName: 'Aayush Thapa',
            phone: '9812345678',
            device: 'HP LaserJet Pro MFP Printer',
            issue: 'Paper jam error & faded toner printouts',
            stage: 2,
            statusLabel: 'Diagnosis',
            dateReceived: '2026-09-07',
            estimatedDelivery: '2026-09-11',
            cost: 'NPR 1,800',
            technicianNotes: 'Inspecting pickup roller and optical laser scanner unit. Cleaning toner residue and sensors.'
        },
        'NA-1004': {
            ticketId: 'NA-1004',
            customerName: 'Suman Adhikari',
            phone: '9841000000',
            device: 'Sony Bravia 55" 4K Smart TV',
            issue: 'Sound working but black screen',
            stage: 3,
            statusLabel: 'Quotation',
            dateReceived: '2026-09-08',
            estimatedDelivery: '2026-09-12',
            cost: 'NPR 4,200',
            technicianNotes: 'LED backlight strip open-circuit. Quotation prepared for customer approval.'
        }
    };

    const DEFAULT_INQUIRIES = [
        {
            id: 'inq_1',
            ticketId: 'NA-8421',
            date: '2026-09-08',
            customerName: 'Rabin Maharjan',
            phone: '9841234890',
            email: 'rabin.m@gmail.com',
            service: 'custom-build',
            message: 'Need a quotation for Intel Core i7 14th Gen RTX 4070 gaming rig with liquid cooling.',
            status: 'New'
        },
        {
            id: 'inq_2',
            ticketId: 'NA-9312',
            date: '2026-09-07',
            customerName: 'Sunita Basnet',
            phone: '9803112233',
            email: 'sunita.b@yahoo.com',
            service: 'hardware-repair',
            message: 'Lenovo ThinkPad spilled tea on keyboard. Keys are sticky and some not working.',
            status: 'Contacted'
        }
    ];

    const DEFAULT_PRODUCTS = [
        {
            id: 'prod_1',
            category: 'Storage',
            title: 'NVMe M.2 1TB PCIe 4.0 SSD',
            spec: 'Speeds up to 7,000 MB/s. Perfect for high-speed boot, gaming, and 4K editing.',
            mrp: 'NPR 15,500',
            price: 'NPR 13,200',
            stock: 'in-stock'
        },
        {
            id: 'prod_2',
            category: 'Memory',
            title: '16GB DDR4 / DDR5 High-Speed RAM',
            spec: 'Heat-spreader module, low latency, tested for flawless stability and multitasking.',
            mrp: 'NPR 6,800',
            price: 'NPR 5,600',
            stock: 'in-stock'
        },
        {
            id: 'prod_3',
            category: 'Peripherals',
            title: 'RGB Mechanical Gaming Keyboard',
            spec: 'Blue/Red mechanical switches, tactile feedback, customizable backlit modes.',
            mrp: 'NPR 5,200',
            price: 'NPR 4,200',
            stock: 'in-stock'
        },
        {
            id: 'prod_4',
            category: 'Printing',
            title: 'HP & Canon Laser Toner Cartridges',
            spec: 'High-yield crisp black toner cartridges with original chip for laser printers.',
            mrp: 'NPR 2,800',
            price: 'NPR 2,200',
            stock: 'in-stock'
        },
        {
            id: 'prod_5',
            category: 'Laptop Hardware',
            title: 'Genuine Replacement Laptop Screens',
            spec: 'IPS FHD & 4K display panels for Dell, HP, Lenovo, Acer, and MacBook.',
            mrp: 'NPR 9,500',
            price: 'NPR 7,800+',
            stock: 'pre-order'
        },
        {
            id: 'prod_6',
            category: 'Power & Cases',
            title: '650W 80+ Bronze Gaming PSU',
            spec: 'Reliable active PFC power supply with Japanese capacitors and silent cooling fan.',
            mrp: 'NPR 7,200',
            price: 'NPR 5,900',
            stock: 'in-stock'
        }
    ];

    const DEFAULT_VIDEOS = [
        {
            id: 'vid_1',
            title: 'Laptop Water Damage? What to do immediately to save your motherboard',
            topic: 'Laptop Emergency Tip',
            views: '24.5K views',
            url: 'https://www.tiktok.com/@newageit2069'
        },
        {
            id: 'vid_2',
            title: 'Motherboard Short Circuit Diagnostic with Thermal Camera & Multimeter',
            topic: 'Chip-Level Engineering',
            views: '41.2K views',
            url: 'https://www.tiktok.com/@newageit2069'
        },
        {
            id: 'vid_3',
            title: 'Why NVMe M.2 SSD Upgrade makes your old computer 10x faster',
            topic: 'Speed & Hardware Upgrade',
            views: '18.9K views',
            url: 'https://www.tiktok.com/@newageit2069'
        },
        {
            id: 'vid_4',
            title: 'Building a High-Performance RTX 4070 Gaming Workstation in Kathmandu',
            topic: 'Custom PC Rig Build',
            views: '35.4K views',
            url: 'https://www.tiktok.com/@newageit2069'
        }
    ];

    function getRepairs() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_REPAIRS);
            return data ? { ...DEFAULT_REPAIRS, ...JSON.parse(data) } : DEFAULT_REPAIRS;
        } catch (e) {
            return DEFAULT_REPAIRS;
        }
    }

    function saveRepairs(repairs) {
        localStorage.setItem(STORAGE_KEY_REPAIRS, JSON.stringify(repairs));
    }

    function getInquiries() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_INQUIRIES);
            return data ? JSON.parse(data) : DEFAULT_INQUIRIES;
        } catch (e) {
            return DEFAULT_INQUIRIES;
        }
    }

    function saveInquiries(inquiries) {
        localStorage.setItem(STORAGE_KEY_INQUIRIES, JSON.stringify(inquiries));
    }

    function getProducts() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_PRODUCTS);
            return data ? JSON.parse(data) : DEFAULT_PRODUCTS;
        } catch (e) {
            return DEFAULT_PRODUCTS;
        }
    }

    function saveProducts(products) {
        localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    }

    function getVideos() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_VIDEOS);
            return data ? JSON.parse(data) : DEFAULT_VIDEOS;
        } catch (e) {
            return DEFAULT_VIDEOS;
        }
    }

    function saveVideos(videos) {
        localStorage.setItem(STORAGE_KEY_VIDEOS, JSON.stringify(videos));
    }

    // =========================================================================
    // 5. Dashboard Overview Tab
    // =========================================================================
    function renderOverviewStats() {
        const repairs = getRepairs();
        const inquiries = getInquiries();
        const products = getProducts();

        const repairsList = Object.values(repairs);
        const totalRepairs = repairsList.length;
        const pendingRepairs = repairsList.filter(r => Number(r.stage) < 8).length;
        const totalInquiries = inquiries.length;
        const newInquiries = inquiries.filter(i => i.status === 'New').length;

        document.getElementById('statTotalRepairs').textContent = totalRepairs;
        document.getElementById('statPendingRepairs').textContent = `${pendingRepairs} actively in progress`;
        document.getElementById('statTotalInquiries').textContent = totalInquiries;
        document.getElementById('statNewInquiries').textContent = `${newInquiries} pending review`;
        document.getElementById('statTotalProducts').textContent = products.length;

        document.getElementById('repairsCountBadge').textContent = pendingRepairs;
        document.getElementById('inquiriesCountBadge').textContent = newInquiries;
    }

    // =========================================================================
    // 6. Repair Jobs Management Tab (8 Stages)
    // =========================================================================
    const STAGE_NAMES = {
        1: '1. Received',
        2: '2. Diagnosis',
        3: '3. Quotation',
        4: '4. Approval',
        5: '5. Repairing',
        6: '6. Testing',
        7: '7. Ready for Pickup',
        8: '8. Delivered'
    };

    const repairSearchInput = document.getElementById('repairSearchInput');
    const repairStageFilter = document.getElementById('repairStageFilter');
    const repairsTableBody = document.getElementById('repairsTableBody');

    function renderRepairsTable() {
        if (!repairsTableBody) return;
        const repairs = getRepairs();
        let list = Object.values(repairs);

        // Filter search query
        const q = (repairSearchInput?.value || '').trim().toLowerCase();
        if (q) {
            list = list.filter(r => 
                (r.ticketId || '').toLowerCase().includes(q) ||
                (r.customerName || '').toLowerCase().includes(q) ||
                (r.phone || '').includes(q) ||
                (r.device || '').toLowerCase().includes(q)
            );
        }

        // Filter stage
        const stageF = repairStageFilter?.value;
        if (stageF) {
            list = list.filter(r => String(r.stage) === stageF);
        }

        if (list.length === 0) {
            repairsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                        No repair jobs match your current search or filter.
                    </td>
                </tr>
            `;
            return;
        }

        repairsTableBody.innerHTML = list.map(item => {
            const stage = Number(item.stage) || 1;
            const waMsg = encodeURIComponent(`Hello ${item.customerName}, update on your repair ticket ${item.ticketId} (${item.device}) at NewAge I.T. Solution Center: Current Status is Stage ${stage}/8 - ${STAGE_NAMES[stage]}. Estimated cost: ${item.cost}. Remarks: ${item.technicianNotes}`);
            const waUrl = `https://wa.me/977${(item.phone || '').replace(/\D/g, '')}?text=${waMsg}`;

            return `
                <tr>
                    <td><strong style="color: var(--primary);">${escapeHtml(item.ticketId)}</strong></td>
                    <td>
                        <div><strong>${escapeHtml(item.customerName)}</strong></div>
                        <small style="color: var(--text-muted);">${escapeHtml(item.phone)}</small>
                    </td>
                    <td>${escapeHtml(item.device)}</td>
                    <td><span style="font-size: 0.85rem; color: #cbd5e1;">${escapeHtml(item.issue)}</span></td>
                    <td>
                        <select class="table-stage-select" data-ticket="${escapeHtml(item.ticketId)}">
                            ${Object.keys(STAGE_NAMES).map(num => `
                                <option value="${num}" ${Number(num) === stage ? 'selected' : ''}>${STAGE_NAMES[num]}</option>
                            `).join('')}
                        </select>
                    </td>
                    <td><strong style="color: #4ade80;">${escapeHtml(item.cost || 'Pending')}</strong></td>
                    <td>
                        <div class="action-btn-group">
                            <a href="${waUrl}" target="_blank" class="btn-icon btn-icon-wa" title="Notify Customer on WhatsApp">
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>
                            <button type="button" class="btn-icon btn-edit-repair" data-ticket="${escapeHtml(item.ticketId)}" title="Edit Repair Details">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="btn-icon btn-icon-del btn-del-repair" data-ticket="${escapeHtml(item.ticketId)}" title="Delete Ticket">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach stage change event listeners
        repairsTableBody.querySelectorAll('.table-stage-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const ticketId = sel.getAttribute('data-ticket');
                const newStage = Number(e.target.value);
                updateRepairStage(ticketId, newStage);
            });
        });

        // Attach edit & delete listeners
        repairsTableBody.querySelectorAll('.btn-edit-repair').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = btn.getAttribute('data-ticket');
                editRepairJob(ticketId);
            });
        });

        repairsTableBody.querySelectorAll('.btn-del-repair').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = btn.getAttribute('data-ticket');
                deleteRepairJob(ticketId);
            });
        });
    }

    function updateRepairStage(ticketId, newStage) {
        const repairs = getRepairs();
        if (repairs[ticketId]) {
            repairs[ticketId].stage = newStage;
            repairs[ticketId].statusLabel = STAGE_NAMES[newStage]?.replace(/^\d+\.\s*/, '') || 'In Progress';
            saveRepairs(repairs);
            renderOverviewStats();
            renderRepairsTable();
        }
    }

    function deleteRepairJob(ticketId) {
        if (!confirm(`Are you sure you want to permanently delete repair ticket ${ticketId}?`)) return;
        const repairs = getRepairs();
        delete repairs[ticketId];
        saveRepairs(repairs);
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

    function openRepairModal(ticketData = null) {
        if (!repairModal) return;
        repairJobForm?.reset();

        const titleEl = document.getElementById('repairModalTitle');
        const idInput = document.getElementById('jobTicketId');

        if (ticketData) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Ticket ${escapeHtml(ticketData.ticketId)}`;
            if (idInput) {
                idInput.value = ticketData.ticketId;
                idInput.readOnly = true;
            }
            document.getElementById('jobCustomerName').value = ticketData.customerName || '';
            document.getElementById('jobPhone').value = ticketData.phone || '';
            document.getElementById('jobDevice').value = ticketData.device || '';
            document.getElementById('jobIssue').value = ticketData.issue || '';
            document.getElementById('jobStage').value = ticketData.stage || 1;
            document.getElementById('jobCost').value = ticketData.cost || '';
            document.getElementById('jobReceivedDate').value = ticketData.dateReceived || '';
            document.getElementById('jobDeliveryDate').value = ticketData.estimatedDelivery || '';
            document.getElementById('jobNotes').value = ticketData.technicianNotes || '';
        } else {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-screwdriver-wrench text-primary"></i> Add Repair Job`;
            if (idInput) {
                idInput.value = 'NA-' + Math.floor(1000 + Math.random() * 9000);
                idInput.readOnly = false;
            }
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('jobReceivedDate').value = today;
        }

        repairModal.style.display = 'flex';
    }

    function editRepairJob(ticketId) {
        const repairs = getRepairs();
        if (repairs[ticketId]) {
            openRepairModal(repairs[ticketId]);
        }
    }

    openNewJobModalBtn?.addEventListener('click', () => openRepairModal());
    closeRepairModalBtn?.addEventListener('click', () => { if (repairModal) repairModal.style.display = 'none'; });
    cancelRepairModalBtn?.addEventListener('click', () => { if (repairModal) repairModal.style.display = 'none'; });

    if (repairJobForm) {
        repairJobForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('jobTicketId')?.value?.trim().toUpperCase();
            if (!ticketId) return;

            const stage = Number(document.getElementById('jobStage')?.value) || 1;
            const repairData = {
                ticketId: ticketId,
                customerName: document.getElementById('jobCustomerName')?.value?.trim() || '',
                phone: document.getElementById('jobPhone')?.value?.trim() || '',
                device: document.getElementById('jobDevice')?.value?.trim() || '',
                issue: document.getElementById('jobIssue')?.value?.trim() || '',
                stage: stage,
                statusLabel: STAGE_NAMES[stage]?.replace(/^\d+\.\s*/, '') || 'In Progress',
                dateReceived: document.getElementById('jobReceivedDate')?.value || '',
                estimatedDelivery: document.getElementById('jobDeliveryDate')?.value || '',
                cost: document.getElementById('jobCost')?.value?.trim() || 'Pending Quote',
                technicianNotes: document.getElementById('jobNotes')?.value?.trim() || ''
            };

            const repairs = getRepairs();
            repairs[ticketId] = repairData;
            saveRepairs(repairs);

            repairModal.style.display = 'none';
            renderOverviewStats();
            renderRepairsTable();
        });
    }

    // =========================================================================
    // 7. Customer Inquiries Management Tab
    // =========================================================================
    const inquirySearchInput = document.getElementById('inquirySearchInput');
    const inquiriesTableBody = document.getElementById('inquiriesTableBody');

    function renderInquiriesTable() {
        if (!inquiriesTableBody) return;
        let list = getInquiries();

        const q = (inquirySearchInput?.value || '').trim().toLowerCase();
        if (q) {
            list = list.filter(i => 
                (i.customerName || '').toLowerCase().includes(q) ||
                (i.phone || '').includes(q) ||
                (i.message || '').toLowerCase().includes(q) ||
                (i.ticketId || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            inquiriesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        No customer inquiries found.
                    </td>
                </tr>
            `;
            return;
        }

        inquiriesTableBody.innerHTML = list.map(item => {
            const waMsg = encodeURIComponent(`Hello ${item.customerName}, this is Indra Kumar Shrestha from NewAge I.T. Solution Center responding to your website inquiry regarding "${item.service}". How can we help you today?`);
            const waUrl = `https://wa.me/977${(item.phone || '').replace(/\D/g, '')}?text=${waMsg}`;
            const statusClass = item.status === 'New' ? 'new' : (item.status === 'Contacted' ? 'contacted' : 'closed');

            return `
                <tr>
                    <td><small style="color: var(--text-muted);">${escapeHtml(item.date || 'Recent')}</small></td>
                    <td><strong style="color: var(--primary);">${escapeHtml(item.ticketId || 'N/A')}</strong></td>
                    <td>
                        <div><strong>${escapeHtml(item.customerName)}</strong></div>
                        <small style="color: var(--text-muted);">${escapeHtml(item.phone)} &bull; ${escapeHtml(item.email || '')}</small>
                    </td>
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
                            <a href="${waUrl}" target="_blank" class="btn-icon btn-icon-wa" title="Reply on WhatsApp">
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>
                            <a href="tel:${escapeHtml(item.phone)}" class="btn-icon" title="Call Customer">
                                <i class="fa-solid fa-phone"></i>
                            </a>
                            <button type="button" class="btn-icon btn-icon-del btn-del-inq" data-id="${escapeHtml(item.id)}" title="Delete Inquiry">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        inquiriesTableBody.querySelectorAll('.inq-status-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const id = sel.getAttribute('data-id');
                updateInquiryStatus(id, e.target.value);
            });
        });

        inquiriesTableBody.querySelectorAll('.btn-del-inq').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteInquiry(id);
            });
        });
    }

    function updateInquiryStatus(id, status) {
        let list = getInquiries();
        const item = list.find(i => i.id === id);
        if (item) {
            item.status = status;
            saveInquiries(list);
            renderOverviewStats();
        }
    }

    function deleteInquiry(id) {
        if (!confirm('Are you sure you want to delete this customer inquiry?')) return;
        let list = getInquiries().filter(i => i.id !== id);
        saveInquiries(list);
        renderOverviewStats();
        renderInquiriesTable();
    }

    inquirySearchInput?.addEventListener('input', renderInquiriesTable);

    document.getElementById('clearArchivedInquiriesBtn')?.addEventListener('click', () => {
        if (!confirm('Clear all closed inquiries from the list?')) return;
        let list = getInquiries().filter(i => i.status !== 'Closed');
        saveInquiries(list);
        renderOverviewStats();
        renderInquiriesTable();
    });

    // =========================================================================
    // 8. Product Catalogue Management Tab
    // =========================================================================
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
    let editingProductId = null;

    wireImagePreview(prodImageUrlInput, prodImagePreviewBox, '<i class="fa-solid fa-image"></i>', prodImageStatus);

    function renderProductsTable() {
        if (!productsTableBody) return;
        const products = getProducts();

        productsTableBody.innerHTML = products.map(item => {
            const resolvedImg = resolveImageUrl(item.image);
            const icon = PRODUCT_ICONS[item.category] || 'fa-box';
            const thumbHtml = resolvedImg
                ? `<img class="table-thumb" src="${escapeHtml(resolvedImg)}" alt="" onerror="this.outerHTML='&lt;div class=&quot;table-thumb-fallback&quot;&gt;&lt;i class=&quot;fa-solid ${icon}&quot;&gt;&lt;/i&gt;&lt;/div&gt;'">`
                : `<div class="table-thumb-fallback"><i class="fa-solid ${icon}"></i></div>`;

            return `
            <tr>
                <td>${thumbHtml}</td>
                <td><span class="badge" style="background: rgba(0, 210, 255, 0.1); color: var(--primary);">${escapeHtml(item.category)}</span></td>
                <td><strong>${escapeHtml(item.title)}</strong></td>
                <td><small style="color: var(--text-muted);">${escapeHtml(item.spec)}</small></td>
                <td><span style="text-decoration: line-through; color: #64748b;">${escapeHtml(item.mrp || '')}</span></td>
                <td><strong style="color: var(--primary);">${escapeHtml(item.price)}</strong></td>
                <td>
                    <span class="status-pill ${item.stock === 'in-stock' ? 'stock' : 'preorder'}">
                        ${item.stock === 'in-stock' ? 'In Stock' : 'Available on Order'}
                    </span>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button type="button" class="btn-icon btn-edit-prod" data-id="${escapeHtml(item.id)}" title="Edit Product">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-icon btn-icon-del btn-del-prod" data-id="${escapeHtml(item.id)}" title="Delete Product">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        productsTableBody.querySelectorAll('.btn-del-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteProduct(id);
            });
        });

        productsTableBody.querySelectorAll('.btn-edit-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = getProducts().find(p => p.id === id);
                if (item) openProductModal(item);
            });
        });
    }

    function deleteProduct(id) {
        if (!confirm('Remove this product from the website catalogue?')) return;
        let list = getProducts().filter(p => p.id !== id);
        saveProducts(list);
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
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const prodData = {
                title: document.getElementById('prodTitle')?.value?.trim() || '',
                category: document.getElementById('prodCategory')?.value || 'Storage',
                spec: document.getElementById('prodSpec')?.value?.trim() || '',
                mrp: document.getElementById('prodMrp')?.value?.trim() || '',
                price: document.getElementById('prodPrice')?.value?.trim() || '',
                stock: document.getElementById('prodStock')?.value || 'in-stock',
                image: prodImageUrlInput?.value?.trim() || ''
            };

            const list = getProducts();
            if (editingProductId) {
                const idx = list.findIndex(p => p.id === editingProductId);
                if (idx !== -1) list[idx] = { ...list[idx], ...prodData };
            } else {
                list.unshift({ id: 'prod_' + Date.now(), ...prodData });
            }
            saveProducts(list);

            editingProductId = null;
            productModal.style.display = 'none';
            renderOverviewStats();
            renderProductsTable();
        });
    }

    // =========================================================================
    // 9. TikTok Videos Management Tab
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
    const videoLivePreview = document.getElementById('videoLivePreview');
    const videoLivePreviewFrame = document.getElementById('videoLivePreviewFrame');
    let editingVideoId = null;

    wireImagePreview(vidThumbUrlInput, vidImagePreviewBox, '<i class="fa-brands fa-tiktok"></i>', null);

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
        const videos = getVideos();

        videosTableBody.innerHTML = videos.map(item => {
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
                        <button type="button" class="btn-icon btn-edit-vid" data-id="${escapeHtml(item.id)}" title="Edit Video">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-icon btn-icon-del btn-del-vid" data-id="${escapeHtml(item.id)}" title="Delete Video">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        videosTableBody.querySelectorAll('.btn-del-vid').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteVideo(id);
            });
        });

        videosTableBody.querySelectorAll('.btn-edit-vid').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = getVideos().find(v => v.id === id);
                if (item) openVideoModal(item);
            });
        });
    }

    function deleteVideo(id) {
        if (!confirm('Remove this video reel from the showcase?')) return;
        let list = getVideos().filter(v => v.id !== id);
        saveVideos(list);
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
        videoForm.addEventListener('submit', (e) => {
            e.preventDefault();
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

            const list = getVideos();
            if (editingVideoId) {
                const idx = list.findIndex(v => v.id === editingVideoId);
                if (idx !== -1) list[idx] = { ...list[idx], ...vidData };
            } else {
                list.unshift({ id: 'vid_' + Date.now(), ...vidData });
            }
            saveVideos(list);

            editingVideoId = null;
            videoModal.style.display = 'none';
            renderVideosTable();
        });
    }

    // =========================================================================
    // 10. Security & Settings Tab
    // =========================================================================
    const changePasswordForm = document.getElementById('changePasswordForm');
    const pwChangeFeedback = document.getElementById('pwChangeFeedback');
    const adminSheetUrlInput = document.getElementById('adminSheetUrlInput');
    const adminSaveSheetUrlBtn = document.getElementById('adminSaveSheetUrlBtn');
    const adminTestSheetUrlBtn = document.getElementById('adminTestSheetUrlBtn');
    const adminSheetStatus = document.getElementById('adminSheetStatus');
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const resetDemoDataBtn = document.getElementById('resetDemoDataBtn');

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const curr = document.getElementById('currentPassword')?.value || '';
            const newP = document.getElementById('newPassword')?.value || '';
            const conf = document.getElementById('confirmNewPassword')?.value || '';

            if (newP !== conf) {
                showPwFeedback('New passwords do not match.', 'error');
                return;
            }

            const currHash = await sha256(SALT + curr);
            if (currHash !== getStoredHash()) {
                showPwFeedback('Current master password verification failed.', 'error');
                return;
            }

            const newHash = await sha256(SALT + newP);
            setStoredHash(newHash);
            showPwFeedback('Master password updated and hashed with salted SHA-256 successfully!', 'success');
            changePasswordForm.reset();
        });
    }

    function showPwFeedback(msg, type) {
        if (!pwChangeFeedback) return;
        pwChangeFeedback.style.display = 'block';
        pwChangeFeedback.className = `login-feedback ${type}`;
        pwChangeFeedback.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${escapeHtml(msg)}`;
    }

    // Google Sheets API Settings in Admin
    if (adminSheetUrlInput) {
        adminSheetUrlInput.value = localStorage.getItem(STORAGE_KEY_SHEET_URL) || '';
    }

    adminSaveSheetUrlBtn?.addEventListener('click', () => {
        const url = adminSheetUrlInput?.value?.trim() || '';
        localStorage.setItem(STORAGE_KEY_SHEET_URL, url);
        if (adminSheetStatus) {
            adminSheetStatus.style.display = 'block';
            adminSheetStatus.className = 'login-feedback success';
            adminSheetStatus.innerHTML = '<i class="fa-solid fa-check"></i> Google Apps Script API URL saved!';
        }
    });

    adminTestSheetUrlBtn?.addEventListener('click', async () => {
        const url = adminSheetUrlInput?.value?.trim() || '';
        if (!url) {
            if (adminSheetStatus) {
                adminSheetStatus.style.display = 'block';
                adminSheetStatus.className = 'login-feedback error';
                adminSheetStatus.textContent = 'Please enter a Google Apps Script Web App URL first.';
            }
            return;
        }

        adminTestSheetUrlBtn.disabled = true;
        adminTestSheetUrlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';

        try {
            const res = await fetch(`${url}?action=track&query=NA-1001`);
            if (res.ok) {
                if (adminSheetStatus) {
                    adminSheetStatus.style.display = 'block';
                    adminSheetStatus.className = 'login-feedback success';
                    adminSheetStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected! Google Sheet database is active.';
                }
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            if (adminSheetStatus) {
                adminSheetStatus.style.display = 'block';
                adminSheetStatus.className = 'login-feedback error';
                adminSheetStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Connection test failed. Verify Web App is deployed with access "Anyone".';
            }
        } finally {
            adminTestSheetUrlBtn.disabled = false;
            adminTestSheetUrlBtn.innerHTML = 'Test Connection';
        }
    });

    // Export Backup JSON
    exportBackupBtn?.addEventListener('click', () => {
        const backup = {
            exportDate: new Date().toISOString(),
            business: 'NewAge I.T. Solution Center',
            repairs: getRepairs(),
            inquiries: getInquiries(),
            products: getProducts(),
            videos: getVideos()
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newage-it-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Reset to Default Demo
    resetDemoDataBtn?.addEventListener('click', () => {
        if (!confirm('Reset all repairs, inquiries, and catalogue to initial factory demo?')) return;
        localStorage.removeItem(STORAGE_KEY_REPAIRS);
        localStorage.removeItem(STORAGE_KEY_INQUIRIES);
        localStorage.removeItem(STORAGE_KEY_PRODUCTS);
        localStorage.removeItem(STORAGE_KEY_VIDEOS);
        renderOverviewStats();
        renderRepairsTable();
        renderInquiriesTable();
        renderProductsTable();
        renderVideosTable();
        alert('Database restored to default demonstration state.');
    });

    // Initialize Dashboard
    function initDashboard() {
        renderOverviewStats();
        renderRepairsTable();
        renderInquiriesTable();
        renderProductsTable();
        renderVideosTable();
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

    // Initial check
    checkAuthUI();
});
