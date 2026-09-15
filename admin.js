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
    // Site theme (blue / orange / white) - same control and localStorage key
    // as the public site, so switching one switches the other too.
    // =========================================================================
    (function initAccentTheme() {
        const ACCENT_STORAGE_KEY = 'NEWAGE_ACCENT_THEME';
        const THEME_ORDER = ['blue', 'orange', 'white'];
        const accentToggleBtn = document.getElementById('accentToggleBtn');
        let accentTheme = 'blue';
        try {
            const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
            if (THEME_ORDER.includes(saved)) accentTheme = saved;
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

        accentToggleBtn?.addEventListener('click', (e) => {
            const dot = e.target.closest('[data-accent-option]');
            const next = dot ? dot.getAttribute('data-accent-option') : THEME_ORDER[(THEME_ORDER.indexOf(accentTheme) + 1) % THEME_ORDER.length];
            applyAccentTheme(next);
        });
    })();

    // =========================================================================
    // Admin panel language (English / Nepali) - static UI chrome only.
    // Real business data (product names, customer names, ticket details, and
    // anything typed into the Site Content tab) is left exactly as typed,
    // regardless of language. t() and applyLanguage() are used later on by
    // switchTab() and the modal-open functions, so they're declared here at
    // the top level rather than inside an IIFE.
    // =========================================================================
    const LANG_STORAGE_KEY = 'NEWAGE_LANG';
    const I18N = {
        login_h2: { en: 'CMS Administration', np: 'सीएमएस प्रशासन' },
        login_p: { en: 'Enter your authorized credentials to manage repairs, inquiries, and store catalogue.', np: 'मर्मत, सोधपुछ, र स्टोर क्याटलग व्यवस्थापन गर्न आफ्नो अधिकृत प्रमाणहरू प्रविष्ट गर्नुहोस्।' },
        login_email_label: { en: 'Admin Email', np: 'एडमिन इमेल' },
        login_password_label: { en: 'Master Password', np: 'मास्टर पासवर्ड' },
        login_password_placeholder: { en: 'Enter secure password', np: 'सुरक्षित पासवर्ड प्रविष्ट गर्नुहोस्' },
        login_submit_btn: { en: 'Authenticate & Enter CMS', np: 'प्रमाणित गर्नुहोस् र सीएमएस प्रवेश गर्नुहोस्' },
        login_back_link: { en: 'Return to Live Website', np: 'लाइभ वेबसाइटमा फर्कनुहोस्' },
        login_security_tag: { en: 'Supabase Auth Secured', np: 'सुपाबेस अथ सुरक्षित' },

        sidebar_brand_sub: { en: 'CMS Portal', np: 'सीएमएस पोर्टल' },
        nav_overview: { en: 'Overview', np: 'सिंहावलोकन' },
        nav_repairs: { en: 'Repair Jobs', np: 'मर्मत कामहरू' },
        nav_inquiries: { en: 'Inquiries', np: 'सोधपुछहरू' },
        nav_products: { en: 'Products', np: 'प्रोडक्टहरू' },
        nav_videos: { en: 'TikTok Videos', np: 'टिकटक भिडियोहरू' },
        nav_chatbot: { en: 'Price Assistant', np: 'मूल्य सहायक' },
        nav_sitecontent: { en: 'Site Content', np: 'साइट सामग्री' },
        nav_settings: { en: 'Security & Settings', np: 'सुरक्षा र सेटिङ' },
        sidebar_role: { en: 'Super Administrator', np: 'सुपर एडमिनिस्ट्रेटर' },

        topnav_view_live: { en: 'View Live Site', np: 'लाइभ साइट हेर्नुहोस्' },
        topnav_system_operational: { en: 'System Operational', np: 'प्रणाली सञ्चालनमा' },

        ov_stat_repairs_label: { en: 'Active Repair Jobs', np: 'सक्रिय मर्मत कामहरू' },
        ov_stat_inquiries_label: { en: 'Total Inquiries', np: 'कुल सोधपुछहरू' },
        ov_stat_products_label: { en: 'Product Catalogue', np: 'प्रोडक्ट क्याटलग' },
        ov_stat_products_sub: { en: 'Active in store', np: 'पसलमा सक्रिय' },
        ov_stat_lowstock_label: { en: 'Low Stock Alerts', np: 'न्यून स्टक चेतावनी' },
        ov_stat_security_label: { en: 'Security Posture', np: 'सुरक्षा स्थिति' },
        ov_stat_security_value: { en: 'Active', np: 'सक्रिय' },
        ov_stat_security_sub: { en: 'Session timeout: 2 hrs', np: 'सेसन समय सीमा: २ घण्टा' },
        ov_quick_actions_h3: { en: 'Quick Actions', np: 'द्रुत कार्यहरू' },
        ov_qa_newjob: { en: 'New Repair Job', np: 'नयाँ मर्मत काम' },
        ov_qa_reviewinq: { en: 'Review Inquiries', np: 'सोधपुछ समीक्षा गर्नुहोस्' },
        ov_qa_addproduct: { en: 'Add Product', np: 'प्रोडक्ट थप्नुहोस्' },
        ov_summary_h3: { en: 'System Summary', np: 'प्रणाली सारांश' },
        ov_sum_bizname: { en: 'Business Name:', np: 'व्यवसायको नाम:' },
        ov_sum_established: { en: 'Established:', np: 'स्थापना:' },
        ov_sum_proprietor: { en: 'Proprietor:', np: 'मालिक:' },
        ov_sum_lifecycle: { en: 'Repair Lifecycle:', np: 'मर्मत जीवनचक्र:' },

        repairs_search_ph: { en: 'Filter by Ticket ID, Customer, or Phone...', np: 'टिकट आईडी, ग्राहक, वा फोनद्वारा फिल्टर गर्नुहोस्...' },
        repairs_opt_all: { en: 'All 8 Stages', np: 'सबै ८ चरण' },
        repairs_opt_s1: { en: '1. Received', np: '१. प्राप्त भयो' },
        repairs_opt_s2: { en: '2. Diagnosis', np: '२. निदान' },
        repairs_opt_s3: { en: '3. Quotation', np: '३. कोटेसन' },
        repairs_opt_s4: { en: '4. Approval', np: '४. स्वीकृति' },
        repairs_opt_s5: { en: '5. Repairing', np: '५. मर्मत हुँदैछ' },
        repairs_opt_s6: { en: '6. Testing', np: '६. परीक्षण' },
        repairs_opt_s7: { en: '7. Ready for Pickup', np: '७. लिन तयार' },
        repairs_opt_s8: { en: '8. Delivered', np: '८. डेलिभर भयो' },
        btn_export_excel: { en: 'Export to Excel', np: 'एक्सेलमा निर्यात गर्नुहोस्' },
        repairs_new_job_btn: { en: 'New Repair Job', np: 'नयाँ मर्मत काम' },
        th_ticket_id: { en: 'Ticket ID', np: 'टिकट आईडी' },
        th_customer: { en: 'Customer', np: 'ग्राहक' },
        th_device: { en: 'Device', np: 'डिभाइस' },
        th_reported_issue: { en: 'Reported Issue', np: 'रिपोर्ट गरिएको समस्या' },
        th_stage_1_8: { en: 'Current Stage (1-8)', np: 'हालको चरण (१-८)' },
        th_est_cost: { en: 'Est. Cost', np: 'अनुमानित लागत' },
        th_actions: { en: 'Actions', np: 'कार्यहरू' },

        inq_search_ph: { en: 'Search inquiries by name, phone, message...', np: 'नाम, फोन, सन्देशद्वारा सोधपुछ खोज्नुहोस्...' },
        inq_clear_btn: { en: 'Clear Closed', np: 'बन्द गरिएका हटाउनुहोस्' },
        th_date: { en: 'Date', np: 'मिति' },
        th_ticket_ref: { en: 'Ticket Ref', np: 'टिकट सन्दर्भ' },
        th_service: { en: 'Service', np: 'सेवा' },
        th_message: { en: 'Message', np: 'सन्देश' },
        th_status: { en: 'Status', np: 'स्थिति' },

        prod_search_ph: { en: 'Search by product name, spec, or category...', np: 'प्रोडक्टको नाम, स्पेक, वा श्रेणीद्वारा खोज्नुहोस्...' },
        opt_all_categories: { en: 'All Categories', np: 'सबै श्रेणी' },
        cat_storage: { en: 'Storage', np: 'स्टोरेज' },
        cat_memory: { en: 'Memory', np: 'मेमोरी' },
        cat_peripherals: { en: 'Peripherals', np: 'पेरिफेरल्स' },
        cat_laptop_hw: { en: 'Laptop Hardware', np: 'ल्यापटप हार्डवेयर' },
        cat_printing: { en: 'Printing', np: 'प्रिन्टिङ' },
        cat_power_cases: { en: 'Power & Cases', np: 'पावर र केस' },
        stockf_all: { en: 'In Stock & On Order', np: 'स्टकमा र अर्डरमा' },
        stockf_instock: { en: 'In Stock Only', np: 'स्टकमा मात्र' },
        stockf_onorder: { en: 'Available on Order Only', np: 'अर्डरमा मात्र उपलब्ध' },
        stockf_outofstock: { en: 'Out of Stock Only', np: 'स्टक सकिएका मात्र' },
        products_add_btn: { en: 'Add Product', np: 'प्रोडक्ट थप्नुहोस्' },
        bulk_delete_btn: { en: 'Delete Selected', np: 'छानिएका मेटाउनुहोस्' },
        bulk_clear_btn: { en: 'Clear selection', np: 'छनोट हटाउनुहोस्' },
        th_image: { en: 'Image', np: 'तस्बिर' },
        th_category: { en: 'Category', np: 'श्रेणी' },
        th_product_name: { en: 'Product Name', np: 'प्रोडक्टको नाम' },
        th_specifications: { en: 'Specifications', np: 'स्पेसिफिकेसन' },
        th_mrp: { en: 'MRP', np: 'एमआरपी' },
        th_selling_price: { en: 'Selling Price', np: 'बिक्री मूल्य' },
        th_qty: { en: 'Qty', np: 'परिमाण' },

        vid_h3: { en: 'Featured TikTok Tech Repair Reels (@newageit2069)', np: 'प्रमुख टिकटक टेक मर्मत रिलहरू (@newageit2069)' },
        vid_add_btn: { en: 'Add TikTok Reel', np: 'टिकटक रिल थप्नुहोस्' },
        th_thumbnail: { en: 'Thumbnail', np: 'थम्बनेल' },
        th_title: { en: 'Title', np: 'शीर्षक' },
        th_topic_category: { en: 'Topic / Category', np: 'विषय / श्रेणी' },
        th_tiktok_url: { en: 'TikTok Video URL', np: 'टिकटक भिडियो URL' },
        th_views_badge: { en: 'Views Badge', np: 'भ्युज ब्याज' },

        cb_search_ph: { en: 'Search by service name or category...', np: 'सेवाको नाम वा श्रेणीद्वारा खोज्नुहोस्...' },
        cb_add_btn: { en: 'Add Service', np: 'सेवा थप्नुहोस्' },
        cb_hint_p: { en: 'These are the services the website\'s "Price Assistant" chatbot answers questions from. Add a service, its price, and it\'s live on the site immediately - no code changes needed.', np: 'यी वेबसाइटको "मूल्य सहायक" च्याटबोटले जवाफ दिने सेवाहरू हुन्। सेवा र यसको मूल्य थप्नुहोस्, यो तुरुन्तै साइटमा लाइभ हुन्छ - कोड परिवर्तन आवश्यक पर्दैन।' },
        th_service_name: { en: 'Service Name', np: 'सेवाको नाम' },
        th_price: { en: 'Price', np: 'मूल्य' },

        sc_h3: { en: 'Edit Website Text', np: 'वेबसाइट टेक्स्ट सम्पादन गर्नुहोस्' },
        sc_p: { en: 'Leave a field blank and save to revert it to the site\'s normal default text. Product/video photos are already editable from their own tabs.', np: 'कुनै फिल्ड खाली छोडेर सेभ गर्दा यो साइटको सामान्य डिफल्ट टेक्स्टमा फर्किन्छ। प्रोडक्ट/भिडियो तस्बिरहरू पहिले नै आ-आफ्नो ट्याबबाट सम्पादन योग्य छन्।' },
        sc_heading_hero: { en: 'Homepage Hero', np: 'होमपेज हिरो' },
        sc_label_title1: { en: 'Title - Line 1', np: 'शीर्षक - लाइन १' },
        sc_label_title2: { en: 'Title - Line 2 (accent color)', np: 'शीर्षक - लाइन २ (एक्सेन्ट रङ)' },
        sc_label_tagline: { en: 'Tagline', np: 'ट्यागलाइन' },
        sc_label_desc: { en: 'Description', np: 'विवरण' },
        sc_heading_contact: { en: 'Contact Details', np: 'सम्पर्क विवरण' },
        sc_hint_contact: { en: 'These update everywhere on the site at once - navbar, contact section, footer, and every WhatsApp/call button.', np: 'यी एकैचोटि साइटभर अपडेट हुन्छन् - नेभबार, सम्पर्क सेक्सन, फुटर, र हरेक ह्वाट्सएप/कल बटन।' },
        sc_label_phone: { en: 'Phone / WhatsApp Number', np: 'फोन / ह्वाट्सएप नम्बर' },
        sc_label_email: { en: 'Email', np: 'इमेल' },
        sc_label_address: { en: 'Address (Contact section)', np: 'ठेगाना (सम्पर्क सेक्सन)' },
        sc_label_hours: { en: 'Operating Hours (Contact section)', np: 'सञ्चालन समय (सम्पर्क सेक्सन)' },
        sc_heading_footer: { en: 'Footer', np: 'फुटर' },
        sc_label_footer_blurb: { en: 'Footer Tagline (under the logo)', np: 'फुटर ट्यागलाइन (लोगो मुनि)' },
        sc_save_btn: { en: 'Save Website Text', np: 'वेबसाइट टेक्स्ट सेभ गर्नुहोस्' },

        settings_pw_h3: { en: 'Change Master Password', np: 'मास्टर पासवर्ड परिवर्तन गर्नुहोस्' },
        settings_pw_p: { en: 'Updates your real Supabase Auth account password (server-verified, not stored in this browser).', np: 'तपाईंको वास्तविक सुपाबेस अथ खाता पासवर्ड अपडेट गर्छ (सर्भर-प्रमाणित, यो ब्राउजरमा भण्डारण हुँदैन)।' },
        settings_pw_current_label: { en: 'Current Password', np: 'हालको पासवर्ड' },
        settings_pw_new_label: { en: 'New Secure Password', np: 'नयाँ सुरक्षित पासवर्ड' },
        settings_pw_new_ph: { en: 'Minimum 8 characters with numbers & symbols', np: 'कम्तिमा ८ अक्षर, अंक र संकेतहरू सहित' },
        settings_pw_confirm_label: { en: 'Confirm New Password', np: 'नयाँ पासवर्ड पुष्टि गर्नुहोस्' },
        settings_pw_submit: { en: 'Update Master Password', np: 'मास्टर पासवर्ड अपडेट गर्नुहोस्' },
        settings_backup_h3: { en: 'Data Backup & Recovery', np: 'डाटा ब्याकअप र रिकभरी' },
        settings_backup_p: { en: 'Export all repairs, inquiries, and catalogue data (live from the database) into an offline JSON backup.', np: 'सबै मर्मत, सोधपुछ, र क्याटलग डाटा (डाटाबेसबाट लाइभ) अफलाइन JSON ब्याकअपमा निर्यात गर्नुहोस्।' },
        settings_backup_btn: { en: 'Export JSON Backup', np: 'JSON ब्याकअप निर्यात गर्नुहोस्' },

        rm_label_ticketid: { en: 'Ticket ID *', np: 'टिकट आईडी *' },
        rm_label_customer: { en: 'Customer Name *', np: 'ग्राहकको नाम *' },
        rm_ph_customer: { en: 'Full name', np: 'पूरा नाम' },
        rm_label_phone: { en: 'Phone / WhatsApp Number *', np: 'फोन / ह्वाट्सएप नम्बर *' },
        rm_label_device: { en: 'Device & Model *', np: 'डिभाइस र मोडेल *' },
        rm_label_issue: { en: 'Reported Issue *', np: 'रिपोर्ट गरिएको समस्या *' },
        rm_ph_issue: { en: 'Describe hardware or software fault...', np: 'हार्डवेयर वा सफ्टवेयर समस्या वर्णन गर्नुहोस्...' },
        rm_label_stage: { en: 'Lifecycle Stage (1 to 8) *', np: 'जीवनचक्र चरण (१ देखि ८) *' },
        rm_opt_stage1: { en: '1. Received (Device logged into center)', np: '१. प्राप्त भयो (डिभाइस सेन्टरमा लग गरियो)' },
        rm_opt_stage2: { en: '2. Diagnosis (Inspecting circuits & diagnostic test)', np: '२. निदान (सर्किट जाँच र डायग्नोस्टिक परीक्षण)' },
        rm_opt_stage3: { en: '3. Quotation (Cost estimate drafted)', np: '३. कोटेसन (लागत अनुमान तयार)' },
        rm_opt_stage4: { en: '4. Approval (Customer confirmed & approved)', np: '४. स्वीकृति (ग्राहकले पुष्टि र स्वीकृत गर्यो)' },
        rm_opt_stage5: { en: '5. Repairing (Active hardware / IC repair)', np: '५. मर्मत हुँदैछ (सक्रिय हार्डवेयर / IC मर्मत)' },
        rm_opt_stage6: { en: '6. Testing (Stress test & QA verification)', np: '६. परीक्षण (स्ट्रेस टेस्ट र QA प्रमाणीकरण)' },
        rm_opt_stage7: { en: '7. Ready (Ready for customer pickup)', np: '७. तयार (ग्राहक लिन तयार)' },
        rm_opt_stage8: { en: '8. Delivered (Collected / Delivered with warranty)', np: '८. डेलिभर भयो (वारेन्टीसहित संकलन / डेलिभर)' },
        rm_label_cost: { en: 'Estimated Cost Quote', np: 'अनुमानित लागत कोटेसन' },
        rm_label_received_date: { en: 'Date Received', np: 'प्राप्त मिति' },
        rm_label_delivery_date: { en: 'Estimated Completion Date', np: 'अनुमानित सम्पन्न मिति' },
        rm_label_notes: { en: 'Technician Diagnostic Remarks', np: 'प्राविधिक निदान टिप्पणी' },
        rm_ph_notes: { en: 'Technical diagnostic notes, parts replaced, thermal paste...', np: 'प्राविधिक निदान नोट, बदलिएका पार्ट्स, थर्मल पेस्ट...' },
        btn_cancel: { en: 'Cancel', np: 'रद्द गर्नुहोस्' },
        rm_save_btn: { en: 'Save Repair Ticket', np: 'मर्मत टिकट सेभ गर्नुहोस्' },
        rm_title_add: { en: 'Add Repair Job', np: 'मर्मत काम थप्नुहोस्' },
        rm_title_edit_prefix: { en: 'Edit Ticket', np: 'टिकट सम्पादन गर्नुहोस्' },

        label_category: { en: 'Category *', np: 'श्रेणी *' },
        pm_label_name: { en: 'Product Name *', np: 'प्रोडक्टको नाम *' },
        pm_opt_storage: { en: 'Storage (SSD / HDD)', np: 'स्टोरेज (SSD / HDD)' },
        pm_opt_memory: { en: 'Memory (RAM)', np: 'मेमोरी (RAM)' },
        pm_opt_peripherals: { en: 'Peripherals (Keyboards/Mice)', np: 'पेरिफेरल्स (किबोर्ड/माउस)' },
        pm_opt_laptophw: { en: 'Laptop Hardware (Screens/Batteries)', np: 'ल्यापटप हार्डवेयर (स्क्रिन/ब्याट्री)' },
        pm_opt_printing: { en: 'Printing & Toners', np: 'प्रिन्टिङ र टोनर' },
        pm_opt_addnew: { en: '+ Add New Category…', np: '+ नयाँ श्रेणी थप्नुहोस्…' },
        opt_type_new_category: { en: 'Type the new category name', np: 'नयाँ श्रेणीको नाम टाइप गर्नुहोस्' },
        pm_label_spec: { en: 'Specifications / Description *', np: 'स्पेसिफिकेसन / विवरण *' },
        pm_ph_spec: { en: 'Key technical specifications, speed, warranty...', np: 'मुख्य प्राविधिक स्पेसिफिकेसन, स्पिड, वारेन्टी...' },
        pm_label_mrp: { en: 'MRP (NPR)', np: 'एमआरपी (रु)' },
        pm_label_price: { en: 'Selling Price (NPR) *', np: 'बिक्री मूल्य (रु) *' },
        pm_label_stock: { en: 'Stock Availability', np: 'स्टक उपलब्धता' },
        stockf_instock_opt: { en: 'In Stock', np: 'स्टकमा छ' },
        stockf_onorder_opt: { en: 'Available on Order', np: 'अर्डरमा उपलब्ध' },
        stockf_outofstock_opt: { en: 'Out of Stock', np: 'स्टक सकियो' },
        pm_label_qty: { en: 'Stock Quantity', np: 'स्टक परिमाण' },
        pm_hint_qty: { en: 'For your own tracking - not shown to website visitors.', np: 'तपाईंको आफ्नै ट्र्याकिङका लागि - वेबसाइट भ्रमणकर्तालाई देखाइँदैन।' },
        pm_label_photo: { en: 'Product Photo URL (optional)', np: 'प्रोडक्ट फोटो URL (वैकल्पिक)' },
        img_url_ph: { en: 'Paste an image URL, or a Google Drive share link', np: 'तस्बिर URL पेस्ट गर्नुहोस्, वा गुगल ड्राइभ सेयर लिंक' },
        pm_hint_gdrive: { en: 'Google Drive links are converted automatically — just set the file to "Anyone with the link can view" and paste the normal share link here. Leave blank to show the category icon instead.', np: 'गुगल ड्राइभ लिंकहरू स्वचालित रूपमा रूपान्तरण हुन्छन् — फाइललाई "लिंक भएका जो कोहीले हेर्न सक्छन्" मा सेट गरेर सामान्य सेयर लिंक यहाँ पेस्ट गर्नुहोस्। श्रेणी आइकन देखाउन खाली छोड्नुहोस्।' },
        upload_photo_label: { en: 'Or upload a photo', np: 'वा फोटो अपलोड गर्नुहोस्' },
        img_filetypes_hint: { en: 'JPG, PNG, WebP or GIF, up to 5MB.', np: 'JPG, PNG, WebP वा GIF, ५MB सम्म।' },
        pm_save_btn: { en: 'Save Product', np: 'प्रोडक्ट सेभ गर्नुहोस्' },
        pm_title_add: { en: 'Add Catalogue Product', np: 'क्याटलग प्रोडक्ट थप्नुहोस्' },
        pm_title_edit: { en: 'Edit Product', np: 'प्रोडक्ट सम्पादन गर्नुहोस्' },

        vm_label_title: { en: 'Video Title / Caption *', np: 'भिडियो शीर्षक / क्याप्सन *' },
        vm_label_topic: { en: 'Topic Tag *', np: 'विषय ट्याग *' },
        vm_label_views: { en: 'Views Count', np: 'भ्युज गणना' },
        vm_label_url: { en: 'TikTok Video URL *', np: 'टिकटक भिडियो URL *' },
        vm_live_preview_label: { en: 'Live preview:', np: 'लाइभ पूर्वावलोकन:' },
        vm_label_cover: { en: 'Cover Photo URL (optional, for this admin table only)', np: 'कभर फोटो URL (वैकल्पिक, यो एडमिन तालिकाका लागि मात्र)' },
        vm_hint_gdrive: { en: 'Google Drive links are converted automatically. This is only a quick-reference thumbnail here in the CMS — visitors always see the live TikTok embed.', np: 'गुगल ड्राइभ लिंकहरू स्वचालित रूपमा रूपान्तरण हुन्छन्। यो सीएमएसमा छिटो-सन्दर्भ थम्बनेल मात्र हो — भ्रमणकर्ताहरूले सधैं लाइभ टिकटक इम्बेड देख्छन्।' },
        vm_save_btn: { en: 'Add Video', np: 'भिडियो थप्नुहोस्' },
        vm_title_add: { en: 'Add TikTok Tech Video', np: 'टिकटक टेक भिडियो थप्नुहोस्' },
        vm_title_edit: { en: 'Edit TikTok Video', np: 'टिकटक भिडियो सम्पादन गर्नुहोस्' },

        cm_label_service: { en: 'Service Name *', np: 'सेवाको नाम *' },
        cm_label_price: { en: 'Price (NPR) *', np: 'मूल्य (रु) *' },
        cm_label_pricefrom: { en: '"Starting from" price (may vary after diagnosis)', np: '"यहाँदेखि सुरु" मूल्य (निदान पछि फरक हुन सक्छ)' },
        cm_label_keywords: { en: 'Extra Search Keywords (optional)', np: 'अतिरिक्त खोज किवर्ड (वैकल्पिक)' },
        cm_hint_keywords: { en: 'Helps the chatbot match related words customers might type. Not shown to visitors.', np: 'ग्राहकले टाइप गर्न सक्ने सम्बन्धित शब्दहरू मिलाउन च्याटबोटलाई मद्दत गर्छ। भ्रमणकर्तालाई देखाइँदैन।' },
        cm_save_btn: { en: 'Save Service', np: 'सेवा सेभ गर्नुहोस्' },
        cm_title_add: { en: 'Add Chatbot Service', np: 'च्याटबोट सेवा थप्नुहोस्' },
        cm_title_edit: { en: 'Edit Chatbot Service', np: 'च्याटबोट सेवा सम्पादन गर्नुहोस्' },

        tab_overviewTab: { en: 'System Overview', np: 'प्रणाली सिंहावलोकन' },
        tab_repairsTab: { en: 'Repair Jobs Management', np: 'मर्मत काम व्यवस्थापन' },
        tab_inquiriesTab: { en: 'Customer Inquiries & Messages', np: 'ग्राहक सोधपुछ र सन्देश' },
        tab_productsTab: { en: 'In-Store Product Catalogue', np: 'पसल प्रोडक्ट क्याटलग' },
        tab_videosTab: { en: 'Featured TikTok Tech Videos', np: 'प्रमुख टिकटक टेक भिडियोहरू' },
        tab_chatbotTab: { en: 'Price Assistant Chatbot Catalogue', np: 'मूल्य सहायक च्याटबोट क्याटलग' },
        tab_siteContentTab: { en: 'Website Text & Content', np: 'वेबसाइट टेक्स्ट र सामग्री' },
        tab_settingsTab: { en: 'System Security & Database Settings', np: 'प्रणाली सुरक्षा र डाटाबेस सेटिङ' }
    };

    let currentLang = 'en';
    try {
        const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
        if (savedLang === 'en' || savedLang === 'np') currentLang = savedLang;
    } catch (e) { /* localStorage unavailable */ }

    function t(key) {
        const entry = I18N[key];
        if (!entry) return '';
        return entry[currentLang] || entry.en || '';
    }

    // Preserves any sibling elements (icons, checkboxes) inside el - only the
    // element's own text node is swapped, never el.innerHTML wholesale.
    function applyI18nText(el, value) {
        if (el.children.length > 0) {
            const textNode = Array.from(el.childNodes).find(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
            );
            if (textNode) textNode.textContent = ' ' + value;
            else el.appendChild(document.createTextNode(' ' + value));
        } else {
            el.textContent = value;
        }
    }

    const langToggleBtn = document.getElementById('langToggleBtn');
    const pageTitleEl = document.getElementById('pageTitle');

    function refreshPageTitle() {
        const activePane = document.querySelector('.tab-pane.active');
        if (pageTitleEl && activePane && I18N['tab_' + activePane.id]) {
            pageTitleEl.textContent = t('tab_' + activePane.id);
        }
    }

    function applyLanguage(lang) {
        currentLang = lang;
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const value = t(el.getAttribute('data-i18n'));
            if (value) applyI18nText(el, value);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const value = t(el.getAttribute('data-i18n-placeholder'));
            if (value) el.setAttribute('placeholder', value);
        });
        langToggleBtn?.querySelectorAll('.lang-toggle-opt').forEach((opt) => {
            opt.classList.toggle('is-active', opt.getAttribute('data-lang-option') === lang);
        });
        refreshPageTitle();
        try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* localStorage unavailable */ }
    }
    applyLanguage(currentLang);

    langToggleBtn?.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-lang-option]');
        const next = opt ? opt.getAttribute('data-lang-option') : (currentLang === 'en' ? 'np' : 'en');
        applyLanguage(next);
    });

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

    const DEFAULT_PRODUCT_CATEGORIES = ['Storage', 'Memory', 'Peripherals', 'Laptop Hardware', 'Printing', 'Power & Cases'];

    // Keeps the "Category" dropdowns (add/edit form + table filter) in sync
    // with whatever categories actually exist, so a custom category typed in
    // via "+ Add New Category..." shows up as a normal option everywhere
    // from then on - not just for the product that introduced it.
    function populateCategoryOptions() {
        const fromProducts = productsCache.map(p => p.category).filter(Boolean);
        const allCategories = [...new Set([...DEFAULT_PRODUCT_CATEGORIES, ...fromProducts])];

        const filterSelect = document.getElementById('productCategoryFilter');
        if (filterSelect) {
            const current = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Categories</option>' +
                allCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
            filterSelect.value = allCategories.includes(current) ? current : '';
        }

        const formSelect = document.getElementById('prodCategory');
        if (formSelect) {
            const current = formSelect.value;
            formSelect.innerHTML = allCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('') +
                '<option value="__new__">+ Add New Category&hellip;</option>';
            if (allCategories.includes(current)) formSelect.value = current;
        }
    }

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

    // Mirrors script.js's formatPrice so the admin table shows the same
    // auto-prefixed "NPR 300" the public site renders, instead of the bare
    // number the admin typed.
    function formatPrice(raw) {
        const val = (raw || '').trim();
        if (!val) return val;
        if (/^(npr|rs\.?|₹)/i.test(val)) return val;
        return `NPR ${val}`;
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
            const initialTab = getTabFromHash();
            history.replaceState({ tab: initialTab }, '', '#' + initialTab);
            switchTab(initialTab);
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
            history.replaceState(null, '', location.pathname + location.search);
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

    function switchTab(tabId) {
        menuItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === tabId));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
        if (pageTitle && I18N['tab_' + tabId]) pageTitle.textContent = t('tab_' + tabId);
        if (dashboardSidebar) dashboardSidebar.classList.remove('active');

        if (tabId === 'overviewTab') renderOverviewStats();
        if (tabId === 'repairsTab') { fetchRepairs().then(renderRepairsTable); }
        if (tabId === 'inquiriesTab') { fetchInquiries().then(renderInquiriesTable); }
        if (tabId === 'productsTab') { fetchProducts().then(renderProductsTable); }
        if (tabId === 'videosTab') { fetchVideos().then(renderVideosTable); }
        if (tabId === 'chatbotTab') { fetchChatbotServices().then(renderChatbotTable); }
        if (tabId === 'siteContentTab') loadSiteContentForm();
    }

    // Tabs are switched purely in JS with no URL change, so by default the
    // browser Back button has nothing to "go back" to within the admin panel
    // - it jumps straight out to whatever page was open before (usually the
    // public site). Pushing a history entry per tab, and switching tabs on
    // popstate instead of leaving the app, fixes that.
    const VALID_TAB_IDS = Array.from(tabPanes).map(pane => pane.id);

    function getTabFromHash() {
        const id = (location.hash || '').slice(1);
        return VALID_TAB_IDS.includes(id) ? id : 'overviewTab';
    }

    function navigateToTab(tabId) {
        if (location.hash !== '#' + tabId) history.pushState({ tab: tabId }, '', '#' + tabId);
        switchTab(tabId);
    }

    window.addEventListener('popstate', () => {
        if (dashboardView && dashboardView.style.display !== 'none') switchTab(getTabFromHash());
    });

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            if (tabId) navigateToTab(tabId);
        });
    });

    mobileSidebarToggle?.addEventListener('click', () => dashboardSidebar?.classList.add('active'));
    mobileCloseSidebarBtn?.addEventListener('click', () => dashboardSidebar?.classList.remove('active'));

    document.getElementById('quickNewJobBtn')?.addEventListener('click', () => { navigateToTab('repairsTab'); openRepairModal(); });
    document.getElementById('quickViewInqBtn')?.addEventListener('click', () => navigateToTab('inquiriesTab'));
    document.getElementById('quickAddProductBtn')?.addEventListener('click', () => { navigateToTab('productsTab'); openProductModal(); });
    document.getElementById('quickSyncSheetBtn')?.addEventListener('click', () => navigateToTab('settingsTab'));

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
        populateCategoryOptions();
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
    // Paints the overview cards from whatever is already in the in-memory
    // caches - no fetch. Split out from renderOverviewStats() so callers who
    // just fetched fresh data (e.g. initDashboard on login) don't pay for a
    // second, redundant round-trip before the dashboard shows real numbers.
    const LOW_STOCK_THRESHOLD = 5;

    function paintOverviewStats() {
        const totalRepairs = repairsCache.length;
        const pendingRepairs = repairsCache.filter(r => Number(r.stage) < 8).length;
        const totalInquiries = inquiriesCache.length;
        const newInquiries = inquiriesCache.filter(i => i.status === 'New').length;
        const lowStockItems = productsCache.filter(p => p.stock === 'in-stock' && Number(p.stock_qty) <= LOW_STOCK_THRESHOLD);

        document.getElementById('statTotalRepairs').textContent = totalRepairs;
        document.getElementById('statPendingRepairs').textContent = `${pendingRepairs} actively in progress`;
        document.getElementById('statTotalInquiries').textContent = totalInquiries;
        document.getElementById('statNewInquiries').textContent = `${newInquiries} pending review`;
        document.getElementById('statTotalProducts').textContent = productsCache.length;

        document.getElementById('statLowStock').textContent = lowStockItems.length;
        document.getElementById('statLowStockSub').textContent = lowStockItems.length
            ? lowStockItems.slice(0, 3).map(p => p.title).join(', ') + (lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : '')
            : 'All items well stocked';
        document.getElementById('statLowStockIcon')?.classList.toggle('is-active', lowStockItems.length > 0);

        document.getElementById('repairsCountBadge').textContent = pendingRepairs;
        document.getElementById('inquiriesCountBadge').textContent = newInquiries;
    }

    async function renderOverviewStats() {
        await Promise.all([fetchRepairs(), fetchInquiries(), fetchProducts()]);
        paintOverviewStats();
    }

    document.getElementById('statLowStockCard')?.addEventListener('click', () => navigateToTab('productsTab'));

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

    function getFilteredRepairs() {
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

        return list;
    }

    function renderRepairsTable() {
        if (!repairsTableBody) return;
        const list = getFilteredRepairs();

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

    document.getElementById('exportRepairsExcelBtn')?.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') { alert('Excel export library did not load. Check your connection and try again.'); return; }

        const rows = getFilteredRepairs().map(r => ({
            'Ticket ID': r.ticket_id || '',
            'Customer Name': r.customer_name || '',
            'Phone': r.phone || '',
            'Device': r.device || '',
            'Reported Issue': r.issue || '',
            'Stage': STAGE_NAMES[Number(r.stage) || 1] || '',
            'Date Received': r.date_received || '',
            'Estimated Delivery': r.estimated_delivery || '',
            'Cost': r.cost || '',
            'Technician Notes': r.technician_notes || '',
            'Date Created': r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
        }));

        if (!rows.length) { alert('No repair jobs to export - clear your search/filter or add a job first.'); return; }

        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = [
            { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 34 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 46 }, { wch: 12 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Repair Jobs');
        XLSX.writeFile(workbook, `newage-it-repairs-${new Date().toISOString().split('T')[0]}.xlsx`);
    });

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
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> ${t('rm_title_edit_prefix')} ${escapeHtml(ticketData.ticket_id)}`;
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
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-screwdriver-wrench text-primary"></i> ${t('rm_title_add')}`;
            if (idInput) {
                const existingIds = new Set(repairsCache.map(r => r.ticket_id));
                let suggested;
                do { suggested = 'NA-' + Math.floor(1000 + Math.random() * 9000); } while (existingIds.has(suggested));
                idInput.value = suggested;
                idInput.readOnly = false;
            }
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

    function productStockMeta(stock) {
        if (stock === 'in-stock') return { cls: 'stock', label: 'In Stock' };
        if (stock === 'out-of-stock') return { cls: 'outofstock', label: 'Out of Stock' };
        return { cls: 'preorder', label: 'Available on Order' };
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
                <tr><td colspan="10" style="text-align:center; color: var(--text-muted); padding: 30px;">
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
                    <td><span style="text-decoration: line-through; color: #64748b;">${item.mrp ? escapeHtml(formatPrice(item.mrp)) : ''}</span></td>
                    <td><strong style="color: var(--primary);">${escapeHtml(formatPrice(item.price))}</strong></td>
                    <td><span class="status-pill ${productStockMeta(item.stock).cls}">${productStockMeta(item.stock).label}</span></td>
                    <td>${Number(item.stock_qty) || 0}</td>
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

    document.getElementById('exportProductsExcelBtn')?.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') { alert('Excel export library did not load. Check your connection and try again.'); return; }

        const rows = getFilteredProducts().map(p => ({
            'Category': p.category || '',
            'Product Name': p.title || '',
            'Specifications': p.spec || '',
            'MRP (NPR)': p.mrp || '',
            'Selling Price (NPR)': p.price || '',
            'Stock Status': productStockMeta(p.stock).label,
            'Stock Qty': Number(p.stock_qty) || 0,
            'Image URL': p.image || '',
            'Date Added': p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : ''
        }));

        if (!rows.length) { alert('No products to export - clear your search/filter or add a product first.'); return; }

        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = [
            { wch: 16 }, { wch: 34 }, { wch: 46 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 40 }, { wch: 12 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
        XLSX.writeFile(workbook, `newage-it-products-${new Date().toISOString().split('T')[0]}.xlsx`);
    });

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

    const prodCategorySelect = document.getElementById('prodCategory');
    const prodNewCategoryInput = document.getElementById('prodNewCategory');

    prodCategorySelect?.addEventListener('change', () => {
        const isNew = prodCategorySelect.value === '__new__';
        if (prodNewCategoryInput) {
            prodNewCategoryInput.hidden = !isNew;
            if (isNew) prodNewCategoryInput.focus(); else prodNewCategoryInput.value = '';
        }
    });

    function openProductModal(productData = null) {
        if (!productModal) return;
        productForm?.reset();
        editingProductId = productData ? productData.id : null;
        populateCategoryOptions();
        if (prodNewCategoryInput) prodNewCategoryInput.hidden = true;

        if (productModalTitleEl) {
            productModalTitleEl.innerHTML = productData
                ? `<i class="fa-solid fa-pen-to-square text-primary"></i> ${t('pm_title_edit')}`
                : `<i class="fa-solid fa-box-open text-primary"></i> ${t('pm_title_add')}`;
        }

        if (productData) {
            document.getElementById('prodTitle').value = productData.title || '';
            document.getElementById('prodCategory').value = productData.category || 'Storage';
            document.getElementById('prodSpec').value = productData.spec || '';
            document.getElementById('prodMrp').value = productData.mrp ? formatPrice(productData.mrp) : '';
            document.getElementById('prodPrice').value = productData.price ? formatPrice(productData.price) : '';
            document.getElementById('prodStock').value = productData.stock || 'in-stock';
            document.getElementById('prodStockQty').value = productData.stock_qty ?? 0;
            if (prodImageUrlInput) prodImageUrlInput.value = productData.image || '';
        } else {
            // Pre-fill the currency prefix for a new product so the admin
            // only has to type the number, not "NPR" itself.
            document.getElementById('prodMrp').value = 'NPR ';
            document.getElementById('prodPrice').value = 'NPR ';
        }
        prodImageUrlInput?._previewUpdate?.();
        productModal.style.display = 'flex';
    }

    // If the admin clears the field and types/pastes a bare number, restore
    // the NPR/Rs prefix as soon as they leave the field instead of saving a
    // bare number.
    [document.getElementById('prodMrp'), document.getElementById('prodPrice')].forEach((input) => {
        input?.addEventListener('blur', () => {
            if (input.value.trim()) input.value = formatPrice(input.value);
        });
    });

    openAddProductModalBtn?.addEventListener('click', () => openProductModal());
    closeProductModalBtn?.addEventListener('click', () => { if (productModal) productModal.style.display = 'none'; });
    cancelProductModalBtn?.addEventListener('click', () => { if (productModal) productModal.style.display = 'none'; });

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;

            let category = document.getElementById('prodCategory')?.value || 'Storage';
            if (category === '__new__') {
                category = prodNewCategoryInput?.value?.trim() || '';
                if (!category) { alert('Type a name for the new category, or pick an existing one.'); return; }
            }

            const prodMrpRaw = document.getElementById('prodMrp')?.value?.trim() || '';
            const prodPriceRaw = document.getElementById('prodPrice')?.value?.trim() || '';
            // The MRP/Price fields are pre-filled with "NPR " for convenience;
            // if the admin left it untouched (no digits typed), treat it as
            // not entered instead of saving the bare prefix.
            const mrp = /\d/.test(prodMrpRaw) ? prodMrpRaw : '';
            const price = /\d/.test(prodPriceRaw) ? prodPriceRaw : '';
            if (!price) { alert('Enter a selling price.'); return; }

            const prodData = {
                title: document.getElementById('prodTitle')?.value?.trim() || '',
                category,
                spec: document.getElementById('prodSpec')?.value?.trim() || '',
                mrp,
                price,
                stock: document.getElementById('prodStock')?.value || 'in-stock',
                stock_qty: Math.max(0, parseInt(document.getElementById('prodStockQty')?.value, 10) || 0),
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
                ? `<i class="fa-solid fa-pen-to-square text-primary"></i> ${t('vm_title_edit')}`
                : `<i class="fa-brands fa-tiktok text-primary"></i> ${t('vm_title_add')}`;
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
    // 8a. Price Assistant Tab (chatbot's editable service/price catalogue)
    // =========================================================================
    let chatbotServicesCache = [];
    const DEFAULT_CHATBOT_CATEGORIES = [
        'Installation & Upgrades', 'Password Decrypt', 'Device Setup', 'Data Backup & Recovery',
        'Mobile & Smartphone Repair', 'Printer & Photocopy', 'Power System', 'Online/Offline Support',
        'Chip Level Repair', 'TV Repair'
    ];

    async function fetchChatbotServices() {
        if (!sb) return;
        const { data, error } = await sb.from('chatbot_services').select('*').order('category').order('item');
        if (error) { console.warn('Fetch chatbot services error:', error); return; }
        chatbotServicesCache = data || [];
        populateChatbotCategoryOptions();
    }

    function populateChatbotCategoryOptions() {
        const fromServices = chatbotServicesCache.map(s => s.category).filter(Boolean);
        const allCategories = [...new Set([...DEFAULT_CHATBOT_CATEGORIES, ...fromServices])];

        const filterSelect = document.getElementById('chatbotCategoryFilter');
        if (filterSelect) {
            const current = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Categories</option>' +
                allCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
            filterSelect.value = allCategories.includes(current) ? current : '';
        }

        const formSelect = document.getElementById('cbCategory');
        if (formSelect) {
            const current = formSelect.value;
            formSelect.innerHTML = allCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('') +
                '<option value="__new__">+ Add New Category&hellip;</option>';
            if (allCategories.includes(current)) formSelect.value = current;
        }
    }

    const chatbotSearchInput = document.getElementById('chatbotSearchInput');
    const chatbotCategoryFilter = document.getElementById('chatbotCategoryFilter');
    const chatbotTableBody = document.getElementById('chatbotTableBody');
    const chatbotModal = document.getElementById('chatbotModal');
    const chatbotForm = document.getElementById('chatbotForm');
    const chatbotModalTitleEl = document.getElementById('chatbotModalTitle');
    const cbCategorySelect = document.getElementById('cbCategory');
    const cbNewCategoryInput = document.getElementById('cbNewCategory');
    let editingChatbotId = null;

    function getFilteredChatbotServices() {
        const q = (chatbotSearchInput?.value || '').trim().toLowerCase();
        const cat = chatbotCategoryFilter?.value || '';
        return chatbotServicesCache.filter(item => {
            if (cat && item.category !== cat) return false;
            if (q && !`${item.item} ${item.category}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function formatChatbotPrice(item) {
        const price = Number(item.price) || 0;
        return `Rs. ${price.toLocaleString('en-IN')}${item.price_from ? ' onwards' : ''}`;
    }

    function renderChatbotTable() {
        if (!chatbotTableBody) return;
        const list = getFilteredChatbotServices();

        if (list.length === 0) {
            chatbotTableBody.innerHTML = `
                <tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-comment-dollar" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    No services match your search or filter.
                </td></tr>`;
            return;
        }

        chatbotTableBody.innerHTML = list.map(item => `
            <tr>
                <td><span class="badge" style="background: rgba(0, 210, 255, 0.1); color: var(--primary);">${escapeHtml(item.category)}</span></td>
                <td><strong>${escapeHtml(item.item)}</strong></td>
                <td><strong style="color: var(--primary);">${escapeHtml(formatChatbotPrice(item))}</strong></td>
                <td>
                    <div class="action-btn-group">
                        <button type="button" class="btn-icon btn-edit-chatbot" data-id="${escapeHtml(item.id)}" title="Edit Service"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button type="button" class="btn-icon btn-icon-del btn-del-chatbot" data-id="${escapeHtml(item.id)}" title="Delete Service"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`).join('');

        chatbotTableBody.querySelectorAll('.btn-edit-chatbot').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = chatbotServicesCache.find(s => s.id === btn.getAttribute('data-id'));
                if (item) openChatbotModal(item);
            });
        });
        chatbotTableBody.querySelectorAll('.btn-del-chatbot').forEach(btn => {
            btn.addEventListener('click', () => deleteChatbotService(btn.getAttribute('data-id')));
        });
    }

    async function deleteChatbotService(id) {
        if (!confirm('Remove this service from the Price Assistant chatbot?')) return;
        const { error } = await sb.from('chatbot_services').delete().eq('id', id);
        if (error) { alert('Could not delete service: ' + error.message); return; }
        await fetchChatbotServices();
        renderChatbotTable();
    }

    cbCategorySelect?.addEventListener('change', () => {
        const isNew = cbCategorySelect.value === '__new__';
        if (cbNewCategoryInput) {
            cbNewCategoryInput.hidden = !isNew;
            if (isNew) cbNewCategoryInput.focus(); else cbNewCategoryInput.value = '';
        }
    });

    function openChatbotModal(item = null) {
        if (!chatbotModal) return;
        chatbotForm?.reset();
        editingChatbotId = item ? item.id : null;
        populateChatbotCategoryOptions();
        if (cbNewCategoryInput) cbNewCategoryInput.hidden = true;

        if (chatbotModalTitleEl) {
            chatbotModalTitleEl.innerHTML = item
                ? `<i class="fa-solid fa-pen-to-square text-primary"></i> ${t('cm_title_edit')}`
                : `<i class="fa-solid fa-comment-dollar text-primary"></i> ${t('cm_title_add')}`;
        }

        if (item) {
            document.getElementById('cbCategory').value = item.category || DEFAULT_CHATBOT_CATEGORIES[0];
            document.getElementById('cbItem').value = item.item || '';
            document.getElementById('cbPrice').value = item.price || 0;
            document.getElementById('cbPriceFrom').checked = !!item.price_from;
            document.getElementById('cbKeywords').value = item.keywords || '';
        }
        chatbotModal.style.display = 'flex';
    }

    document.getElementById('openAddChatbotModalBtn')?.addEventListener('click', () => openChatbotModal());
    document.getElementById('closeChatbotModalBtn')?.addEventListener('click', () => { if (chatbotModal) chatbotModal.style.display = 'none'; });
    document.getElementById('cancelChatbotModalBtn')?.addEventListener('click', () => { if (chatbotModal) chatbotModal.style.display = 'none'; });

    chatbotSearchInput?.addEventListener('input', renderChatbotTable);
    chatbotCategoryFilter?.addEventListener('change', renderChatbotTable);

    if (chatbotForm) {
        chatbotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;

            let category = cbCategorySelect?.value || DEFAULT_CHATBOT_CATEGORIES[0];
            if (category === '__new__') {
                category = cbNewCategoryInput?.value?.trim() || '';
                if (!category) { alert('Type a name for the new category, or pick an existing one.'); return; }
            }

            const serviceData = {
                category,
                item: document.getElementById('cbItem')?.value?.trim() || '',
                price: Math.max(0, parseFloat(document.getElementById('cbPrice')?.value) || 0),
                price_from: !!document.getElementById('cbPriceFrom')?.checked,
                keywords: document.getElementById('cbKeywords')?.value?.trim() || ''
            };

            const submitBtn = chatbotForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const { error } = editingChatbotId
                ? await sb.from('chatbot_services').update(serviceData).eq('id', editingChatbotId)
                : await sb.from('chatbot_services').insert(serviceData);

            if (submitBtn) submitBtn.disabled = false;
            if (error) {
                const friendly = error.code === '23505'
                    ? 'A service with this exact name already exists in this category.'
                    : error.message;
                alert('Could not save service: ' + friendly);
                return;
            }

            editingChatbotId = null;
            chatbotModal.style.display = 'none';
            await fetchChatbotServices();
            renderChatbotTable();
        });
    }

    // =========================================================================
    // 8b. Site Content Tab (admin-editable homepage text)
    // =========================================================================
    let siteContentCache = {};
    const siteContentForm = document.getElementById('siteContentForm');
    const siteContentFeedback = document.getElementById('siteContentFeedback');

    async function loadSiteContentForm() {
        if (!sb || !siteContentForm) return;
        const { data, error } = await sb.from('site_content').select('key, value');
        if (error) { console.warn('Fetch site content error:', error); return; }
        siteContentCache = {};
        (data || []).forEach(row => { siteContentCache[row.key] = row.value; });

        siteContentForm.querySelectorAll('[data-key]').forEach(input => {
            input.value = siteContentCache[input.getAttribute('data-key')] || '';
        });
    }

    function showSiteContentFeedback(msg, type) {
        if (!siteContentFeedback) return;
        siteContentFeedback.style.display = 'block';
        siteContentFeedback.className = `login-feedback ${type}`;
        siteContentFeedback.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${escapeHtml(msg)}`;
    }

    if (siteContentForm) {
        siteContentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sb) return;

            const inputs = Array.from(siteContentForm.querySelectorAll('[data-key]'));
            const toUpsert = [];
            const toDelete = [];
            inputs.forEach(input => {
                const key = input.getAttribute('data-key');
                const value = input.value.trim();
                if (value) toUpsert.push({ key, value });
                else toDelete.push(key);
            });

            const submitBtn = siteContentForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                if (toUpsert.length) {
                    const { error } = await sb.from('site_content').upsert(toUpsert, { onConflict: 'key' });
                    if (error) throw error;
                }
                if (toDelete.length) {
                    const { error } = await sb.from('site_content').delete().in('key', toDelete);
                    if (error) throw error;
                }
                showSiteContentFeedback('Website text saved - live on the site now.', 'success');
                await loadSiteContentForm();
            } catch (err) {
                showSiteContentFeedback('Could not save: ' + err.message, 'error');
            }

            if (submitBtn) submitBtn.disabled = false;
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
        paintOverviewStats();
        renderRepairsTable();
        renderInquiriesTable();
        renderProductsTable();
        renderVideosTable();
    }

    // Initial check
    checkAuthUI();
});


