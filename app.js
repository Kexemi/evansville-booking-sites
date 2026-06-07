/**
 * app.js v2 — Premium client-facing features for Local Business App Factory
 * Multi-step booking wizard, photo upload, live reviews, Spanish toggle, estimators
 */
(function() {
    'use strict';
    const C = window._BIZ_CONFIG || {};
    
    // ============================================================
    // 1. MULTI-STEP BOOKING WIZARD
    // ============================================================
    let bookingData = {};

    function initBookingWizard() {
        const form = document.getElementById('booking-form');
        if (!form) return;

        // Build wizard structure
        form.innerHTML = `
            <div class="flex mb-6" id="step-indicator">
                <div class="flex-1 text-center" data-step="1"><div class="w-8 h-8 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-sm font-bold">1</div><p class="text-xs mt-1 text-gray-500">Service</p></div>
                <div class="flex-1 text-center" data-step="2"><div class="w-8 h-8 rounded-full bg-gray-200 text-gray-400 inline-flex items-center justify-center text-sm font-bold">2</div><p class="text-xs mt-1 text-gray-400">Photos</p></div>
                <div class="flex-1 text-center" data-step="3"><div class="w-8 h-8 rounded-full bg-gray-200 text-gray-400 inline-flex items-center justify-center text-sm font-bold">3</div><p class="text-xs mt-1 text-gray-400">Info</p></div>
                <div class="flex-1 text-center" data-step="4"><div class="w-8 h-8 rounded-full bg-gray-200 text-gray-400 inline-flex items-center justify-center text-sm font-bold">4</div><p class="text-xs mt-1 text-gray-400">Confirm</p></div>
            </div>
            <div id="wizard-steps"></div>
        `;
        const steps = document.getElementById('wizard-steps');
        
        // Step 1: Service selection
        steps.appendChild(createStep(1, `
            <h3 class="text-lg font-bold mb-3">What do you need?</h3>
            <select id="wiz-service" class="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-lg" required>
                <option value="">Select a service...</option>
                ${document.getElementById('service-opts')?.innerHTML || ''}
            </select>
            <div class="grid grid-cols-2 gap-2 mb-4" id="urgency-selector">
                <button type="button" class="urgency-btn p-3 rounded-xl border-2 border-gray-200 text-center hover:border-blue-400" data-urgent="false">
                    <span class="text-2xl">📅</span>
                    <p class="text-sm font-medium mt-1">Schedule</p>
                    <p class="text-xs text-gray-400">Pick a date</p>
                </button>
                <button type="button" class="urgency-btn p-3 rounded-xl border-2 border-gray-200 text-center hover:border-red-400" data-urgent="true">
                    <span class="text-2xl">🆘</span>
                    <p class="text-sm font-medium mt-1">Emergency</p>
                    <p class="text-xs text-gray-400">Need help now</p>
                </button>
            </div>
        `, 'Choose a Service', 'nextStep(2)'));

        // Step 2: Photo upload
        steps.appendChild(createStep(2, `
            <h3 class="text-lg font-bold mb-3">Add photos (optional)</h3>
            <div id="dropzone" class="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 cursor-pointer transition">
                <div class="text-4xl mb-2">📷</div>
                <p class="text-gray-500">Drop photos here or click to upload</p>
                <p class="text-xs text-gray-400 mt-1">Helps us give you a more accurate estimate</p>
                <input type="file" id="photo-input" accept="image/*" multiple class="hidden" capture="environment">
            </div>
            <div id="photo-previews" class="grid grid-cols-3 gap-2 mt-3"></div>
        `, 'Add Photos (Optional)', 'nextStep(3)'));

        // Step 3: Contact info
        steps.appendChild(createStep(3, `
            <h3 class="text-lg font-bold mb-3">Your Contact Info</h3>
            <div class="space-y-3">
                <div><label class="block text-sm font-medium mb-1">Your Name *</label><input type="text" id="wiz-name" required class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500" placeholder="Jane Doe"></div>
                <div><label class="block text-sm font-medium mb-1">Phone *</label><input type="tel" id="wiz-phone" required class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500" placeholder="(812) 555-5555"></div>
                <div><label class="block text-sm font-medium mb-1">Email</label><input type="email" id="wiz-email" class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500" placeholder="jane@example.com"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="wiz-date" class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"></div>
                    <div><label class="block text-sm font-medium mb-1">Time</label><input type="time" id="wiz-time" class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"></div>
                </div>
                <div><label class="block text-sm font-medium mb-1">Details</label><textarea id="wiz-notes" rows="2" class="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500" placeholder="Describe the issue..."></textarea></div>
            </div>
        `, 'Your Info', 'nextStep(4)'));

        // Step 4: Confirm
        steps.appendChild(createStep(4, `
            <h3 class="text-lg font-bold mb-3">Confirm Your Booking</h3>
            <div id="confirm-details" class="bg-gray-50 rounded-xl p-4 text-sm space-y-2 mb-4"></div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition shadow-lg">
                ✅ Confirm Booking
            </button>
        `, 'Confirm', ''));

        // Show step 1
        showStep(1);

        // Wire up urgency selector
        document.querySelectorAll('.urgency-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.urgency-btn').forEach(b => b.classList.remove('border-blue-400', 'border-red-400', 'bg-blue-50', 'bg-red-50'));
                this.classList.add(this.dataset.urgent === 'true' ? 'border-red-400 bg-red-50' : 'border-blue-400 bg-blue-50');
                bookingData.urgent = this.dataset.urgent === 'true';
            });
        });

        // Photo upload
        const dz = document.getElementById('dropzone');
        const pi = document.getElementById('photo-input');
        if (dz && pi) {
            dz.addEventListener('click', () => pi.click());
            pi.addEventListener('change', handlePhotos);
            dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('border-blue-500', 'bg-blue-50'); });
            dz.addEventListener('dragleave', () => dz.classList.remove('border-blue-500', 'bg-blue-50'));
            dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('border-blue-500', 'bg-blue-50'); handlePhotos({ target: { files: e.dataTransfer.files } }); });
        }
    }

    function createStep(num, content, label, onNext) {
        const div = document.createElement('div');
        div.className = 'wizard-step hidden';
        div.dataset.step = num;
        div.innerHTML = content +
            `<div class="flex justify-between mt-6 pt-4 border-t">
                ${num > 1 ? '<button type="button" onclick="prevStep(' + (num-1) + ')" class="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">← Back</button>' : '<div></div>'}
                ${onNext ? '<button type="button" onclick="' + onNext + '" class="px-8 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">' + label + ' →</button>' : ''}
            </div>`;
        return div;
    }

    window.nextStep = function(num) {
        // Validate current step
        if (num === 2) {
            // Step 1 validation
            const svc = document.getElementById('wiz-service')?.value;
            if (!svc) { alert('Please select a service.'); return; }
            bookingData.service = svc;
            bookingData.urgent = bookingData.urgent || false;
        }
        if (num === 4) {
            // Step 3 validation
            const name = document.getElementById('wiz-name')?.value?.trim();
            const phone = document.getElementById('wiz-phone')?.value?.trim();
            if (!name || !phone) { alert('Please enter your name and phone.'); return; }
            bookingData.name = name; bookingData.phone = phone;
            bookingData.email = document.getElementById('wiz-email')?.value;
            bookingData.date = document.getElementById('wiz-date')?.value;
            bookingData.time = document.getElementById('wiz-time')?.value;
            bookingData.notes = document.getElementById('wiz-notes')?.value;
            renderConfirmation();
        }
        showStep(num);
    };
    window.prevStep = showStep;

    function showStep(num) {
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
        const s = document.querySelector(`.wizard-step[data-step="${num}"]`);
        if (s) s.classList.remove('hidden');
        document.querySelectorAll('#step-indicator [data-step]').forEach((el, i) => {
            const stepNum = parseInt(el.dataset.step);
            const circle = el.querySelector('.w-8');
            if (!circle) return;
            if (stepNum < num) { circle.className = 'w-8 h-8 rounded-full bg-green-500 text-white inline-flex items-center justify-center text-sm font-bold'; circle.textContent = '✓'; }
            else if (stepNum === num) { circle.className = 'w-8 h-8 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-sm font-bold'; circle.textContent = stepNum; }
            else { circle.className = 'w-8 h-8 rounded-full bg-gray-200 text-gray-400 inline-flex items-center justify-center text-sm font-bold'; circle.textContent = stepNum; }
        });
        window.scrollTo({ top: document.getElementById('booking')?.offsetTop - 80, behavior: 'smooth' });
    }

    function renderConfirmation() {
        const el = document.getElementById('confirm-details');
        if (!el) return;
        const biz = C.name || 'our business';
        el.innerHTML = `
            <div class="flex justify-between"><span class="text-gray-500">Business</span><span class="font-medium">${esc(biz)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Service</span><span class="font-medium">${esc(bookingData.service || '')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Urgency</span><span class="font-medium">${bookingData.urgent ? '🆘 Emergency' : '📅 Scheduled'}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Name</span><span class="font-medium">${esc(bookingData.name || '')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Phone</span><span class="font-medium">${esc(bookingData.phone || '')}</span></div>
            ${bookingData.email ? `<div class="flex justify-between"><span class="text-gray-500">Email</span><span class="font-medium">${esc(bookingData.email)}</span></div>` : ''}
            ${bookingData.date ? `<div class="flex justify-between"><span class="text-gray-500">Date</span><span class="font-medium">${esc(bookingData.date)}</span></div>` : ''}
            ${bookingData.time ? `<div class="flex justify-between"><span class="text-gray-500">Time</span><span class="font-medium">${esc(bookingData.time)}</span></div>` : ''}
            ${bookingData.notes ? `<div class="flex justify-between"><span class="text-gray-500">Notes</span><span class="font-medium">${esc(bookingData.notes)}</span></div>` : ''}
            ${bookingData.photos?.length ? `<div class="flex justify-between"><span class="text-gray-500">Photos</span><span class="font-medium">${bookingData.photos.length} uploaded</span></div>` : ''}
        `;
    }

    function handlePhotos(e) {
        const files = e.target.files;
        if (!files?.length) return;
        bookingData.photos = bookingData.photos || [];
        const container = document.getElementById('photo-previews');
        for (const file of files) {
            bookingData.photos.push(file);
            const reader = new FileReader();
            reader.onload = function(ev) {
                const div = document.createElement('div');
                div.className = 'relative rounded-xl overflow-hidden aspect-square border';
                div.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover"><button type="button" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs" onclick="this.parentElement.remove()">✕</button>`;
                container?.appendChild(div);
            };
            reader.readAsDataURL(file);
        }
    }

    function submitBooking(e) {
        e.preventDefault();
        if (!bookingData.name || !bookingData.phone || !bookingData.service) {
            alert('Please complete all required fields.');
            return;
        }
        const b = { id: Date.now(), business: C.name, customerName: bookingData.name, phone: bookingData.phone, email: bookingData.email || '', service: bookingData.service, date: bookingData.date || '', time: bookingData.time || '', notes: bookingData.notes || '', urgent: bookingData.urgent, photos: bookingData.photos?.length || 0, createdAt: new Date().toISOString() };
        const existing = JSON.parse(localStorage.getItem('evb_bookings') || '[]');
        existing.push(b);
        localStorage.setItem('evb_bookings', JSON.stringify(existing));

        // Show success
        const form = document.getElementById('booking-form');
        const success = document.getElementById('success-msg');
        if (form) form.innerHTML = '';
        if (success) {
            success.classList.remove('hidden');
            document.getElementById('booking-summary')?.remove();
            const s = document.createElement('div');
            s.id = 'booking-summary';
            s.className = 'mt-4 bg-white rounded-xl p-4 text-left text-sm border border-emerald-100';
            s.innerHTML = `<p><strong>Service:</strong> ${esc(b.service)}</p><p><strong>When:</strong> ${b.date || 'Flexible'} ${b.time || ''}</p><p><strong>Contact:</strong> ${esc(b.phone)}</p>`;
            success.appendChild(s);
        }

        // Attempt delivery
        try {
            fetch("https://formsubmit.co/ajax/evansvillebookings@gmail.com", {
                method: "POST", headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ _subject: "New Booking - " + C.name, business: C.name, customerName: b.customerName, phone: b.phone, service: b.service, date: b.date, time: b.time, notes: b.notes, _template: "table" })
            }).catch(() => {});
        } catch(e) {}
        // mailto backup
        if (C.email) {
            setTimeout(() => window.open("mailto:" + C.email + "?subject=" + encodeURIComponent("New Booking - " + C.name) + "&body=" + encodeURIComponent("Customer: " + b.customerName + "\nPhone: " + b.phone + "\nService: " + b.service + "\nDate: " + b.date + " " + b.time + "\nNotes: " + b.notes), "_blank"), 500);
        }
    }

    // ============================================================
    // 2. LIVE REVIEW SYSTEM
    // ============================================================
    function initReviews() {
        const btn = document.getElementById('post-review-btn');
        const list = document.getElementById('reviews-list');
        if (!btn || !list) return;
        btn.addEventListener('click', function() {
            const name = (document.getElementById('review-name')?.value || 'You').trim();
            const text = document.getElementById('review-text')?.value?.trim();
            const rating = parseInt(document.querySelector('input[name="review-rating"]:checked')?.value || '5');
            if (!text) { alert('Please write a review.'); return; }
            const reviews = JSON.parse(localStorage.getItem('evb_reviews') || '[]');
            reviews.unshift({ name, text, rating, date: new Date().toLocaleDateString() });
            localStorage.setItem('evb_reviews', JSON.stringify(reviews));
            document.getElementById('review-text').value = '';
            renderReviews();
        });
        renderReviews();
    }

    function renderReviews() {
        const list = document.getElementById('reviews-list');
        if (!list) return;
        const stored = JSON.parse(localStorage.getItem('evb_reviews') || '[]');
        const template = list.querySelectorAll('.review-card');
        let all = [...stored];
        // Include template reviews from HTML
        template.forEach(el => all.push({ name: el.querySelector('.text-gray-400')?.textContent?.trim() || 'Customer', text: el.querySelector('.text-gray-600')?.textContent?.replace(/"/g,'') || '', rating: el.querySelector('.star')?.textContent?.length || 5, date: '' }));
        if (!all.length) return;
        list.innerHTML = all.map(r => `
            <div class="review-card bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div class="flex items-center mb-1.5">
                    <span class="star text-lg">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5-(r.rating||5))}</span>
                    <span class="text-xs text-gray-400 ml-2">${esc(r.name)}${r.date ? ' · ' + r.date : ''}</span>
                </div>
                <p class="text-sm text-gray-600">"${esc(r.text)}"</p>
            </div>
        `).join('');
    }

    // ============================================================
    // 3. SPANISH TOGGLE
    // ============================================================
    const translations = {
        'Book Now': 'Reserve Ahora', 'Call Now': 'Llama Ahora', 'Schedule Service': 'Programar Servicio',
        'Customer Reviews': 'Opiniones de Clientes', 'Submit Booking': 'Enviar Reserva',
        'Your Name': 'Tu Nombre', 'Phone': 'Teléfono', 'Service Needed': 'Servicio Necesario',
        'Preferred Date': 'Fecha Preferida', 'Additional Notes': 'Notas Adicionales',
        'Serving': 'Sirviendo', 'Emergency': 'Emergencia', 'Book Online': 'Reserve en Línea',
    };

    function initLangToggle() {
        const btn = document.getElementById('lang-toggle');
        if (!btn) return;
        let es = false;
        btn.addEventListener('click', function() {
            es = !es;
            this.textContent = es ? '🇺🇸 EN' : '🇲🇽 ES';
            document.querySelectorAll('[data-en]').forEach(el => {
                el.textContent = es ? (translations[el.textContent.trim()] || el.textContent) : el.dataset.en;
            });
        });
    }

    // ============================================================
    // 4. SERVICE ESTIMATOR
    // ============================================================
    function initEstimator() {
        const calc = document.getElementById('estimator');
        if (!calc) return;
        const sliders = calc.querySelectorAll('input[type="range"]');
        sliders.forEach(s => {
            s.addEventListener('input', function() {
                const val = document.getElementById(this.dataset.display);
                if (val) val.textContent = this.value + (this.dataset.suffix || '');
                updateEstimate();
            });
        });
    }

    function updateEstimate() {
        const el = document.getElementById('estimate-result');
        if (!el) return;
        let total = 0;
        document.querySelectorAll('#estimator input[type="range"]').forEach(s => {
            total += parseInt(s.value) * parseFloat(s.dataset.rate || '1');
        });
        el.textContent = '$' + Math.round(total).toLocaleString();
    }

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        initBookingWizard();
        initReviews();
        initLangToggle();
        initEstimator();
        // Wire up form submit
        const form = document.getElementById('booking-form');
        if (form) form.addEventListener('submit', submitBooking);
        // Admin
        const toggle = document.getElementById('admin-toggle');
        const panel = document.getElementById('admin-panel');
        if (toggle && panel) {
            toggle.addEventListener('click', function() {
                if (panel.classList.contains('open')) { panel.style.display = 'none'; panel.classList.remove('open'); return; }
                const pw = prompt('Admin password:');
                if (pw === C.adminPassword) { panel.style.display = 'block'; panel.classList.add('open'); renderAdmin(); }
                else if (pw !== null) alert('Incorrect password.');
            });
        }
    });

    // ============================================================
    // UTILITIES
    // ============================================================
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    window.exportBookings = function() {
        const b = JSON.parse(localStorage.getItem('evb_bookings') || '[]');
        if (!b.length) { alert('No bookings.'); return; }
        const csv = 'Date,Customer,Phone,Service,Notes\n' + b.map(r => `"${r.createdAt}","${r.customerName}","${r.phone}","${r.service}","${r.notes||''}"`).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = C.slug + '-bookings.csv'; a.click();
    };
    window.clearAllBookings = function() { if (confirm('Clear ALL bookings?')) { localStorage.setItem('evb_bookings', '[]'); renderAdmin(); } };
    window.copyBooking = function() {
        const s = document.getElementById('booking-summary');
        if (s) navigator.clipboard.writeText(s.innerText).then(() => { const t = document.getElementById('toast'); if (t) { t.style.display='block'; setTimeout(() => t.style.display='none', 2500); } });
    };
    function renderAdmin() {
        const c = document.getElementById('admin-bookings');
        if (!c) return;
        const b = JSON.parse(localStorage.getItem('evb_bookings') || '[]');
        const stat = document.getElementById('admin-stats');
        if (stat) stat.textContent = b.length + ' booking' + (b.length !== 1 ? 's' : '');
        if (!b.length) { c.innerHTML = '<p class="text-gray-400 text-center py-4">No bookings yet.</p>'; return; }
        c.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-100"><th class="p-2 text-left">Date</th><th class="p-2 text-left">Customer</th><th class="p-2 text-left">Service</th><th class="p-2 text-left">Phone</th><th class="p-2">Action</th></tr></thead><tbody>' +
            [...b].reverse().map(r => `<tr class="border-b"><td class="p-2 text-xs text-gray-400">${r.createdAt?.slice(0,10)||''}</td><td class="p-2 font-medium">${esc(r.customerName)}</td><td class="p-2">${esc(r.service)}</td><td class="p-2"><a href="tel:${esc(r.phone)}" class="text-blue-600">${esc(r.phone)}</a></td><td class="p-2 text-center"><button onclick="window.deleteBooking(${r.id})" class="text-xs text-red-500">✕</button></td></tr>`).join('') +
        '</tbody></table></div>';
    }
    window.deleteBooking = function(id) {
        const b = JSON.parse(localStorage.getItem('evb_bookings') || '[]').filter(x => x.id !== id);
        localStorage.setItem('evb_bookings', JSON.stringify(b));
        renderAdmin();
    };
})();
