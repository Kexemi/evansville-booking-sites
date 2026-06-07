/**
 * app.js — Shared runtime for Evansville Booking Sites
 * Handles: booking form, admin dashboard, PWA, Cal.com embed
 * Loaded via each site's HTML. Reads window._BIZ_CONFIG for per-site config.
 */
(function() {
    'use strict';

    const CFG = window._BIZ_CONFIG || {};
    const ADMIN_PW = CFG.adminPassword || CFG.phone.replace(/[^0-9]/g, '') || 'admin123';

    // ============================================================
    // 1. BOOKING FORM
    // ============================================================
    function getBookings() {
        try { return JSON.parse(localStorage.getItem('evb_bookings') || '[]'); }
        catch(e) { return []; }
    }
    function saveBooking(b) {
        const bookings = getBookings();
        bookings.push(b);
        localStorage.setItem('evb_bookings', JSON.stringify(bookings));
    }

    function submitBooking(e) {
        const form = document.getElementById('booking-form');
        if (!form) return;
        e.preventDefault();

        const name = document.getElementById('customer-name')?.value?.trim();
        const phone = document.getElementById('customer-phone')?.value?.trim();
        const email = document.getElementById('customer-email')?.value?.trim();
        const service = document.getElementById('service')?.value;
        const date = document.getElementById('date')?.value;
        const time = document.getElementById('time')?.value;
        const notes = document.getElementById('notes')?.value?.trim();

        if (!name || !phone || !service) {
            alert('Please fill in your name, phone, and service needed.');
            return;
        }

        const booking = {
            id: Date.now(), business: CFG.name,
            customerName: name, phone: phone, email: email || '',
            service: service, date: date || 'Not specified',
            time: time || 'Not specified', notes: notes || 'None',
            createdAt: new Date().toISOString()
        };

        // Save locally
        saveBooking(booking);

        // Show success
        form.classList.add('hidden');
        const success = document.getElementById('success-msg');
        if (success) {
            success.classList.remove('hidden');
            const summary = document.getElementById('booking-summary');
            if (summary) {
                summary.innerHTML =
                    '<div class="space-y-1">' +
                    '<p><strong>Business:</strong> ' + esc(CFG.name) + '</p>' +
                    '<p><strong>Customer:</strong> ' + esc(name) + '</p>' +
                    '<p><strong>Phone:</strong> ' + esc(phone) + '</p>' +
                    (email ? '<p><strong>Email:</strong> ' + esc(email) + '</p>' : '') +
                    '<p><strong>Service:</strong> ' + esc(service) + '</p>' +
                    '<p><strong>Date:</strong> ' + esc(booking.date) + '</p>' +
                    '<p><strong>Time:</strong> ' + esc(booking.time) + '</p>' +
                    (notes ? '<p><strong>Notes:</strong> ' + esc(notes) + '</p>' : '') +
                    '</div>' +
                    '<div class="mt-3 pt-3 border-t border-emerald-100">' +
                    '<p class="text-xs text-emerald-600"> Saved to dashboard. Owner notified.</p></div>';
            }
        }

        // Deliver via multiple channels
        deliverBooking(booking);
    }

    function deliverBooking(b) {
        // Channel 1: FormSubmit AJAX (email)
        try {
            fetch("https://formsubmit.co/ajax/evansvillebookings@gmail.com", {
                method: "POST",
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    _subject: "New Booking - " + CFG.name + " - " + b.customerName,
                    business: CFG.name, customerName: b.customerName,
                    phone: b.phone, email: b.email, service: b.service,
                    date: b.date, time: b.time, notes: b.notes,
                    _template: "table"
                })
            }).catch(function(){});
        } catch(e) {}

        // Channel 2: mailto: compose (opens email client)
        if (CFG.email) {
            var subject = encodeURIComponent("New Booking Request - " + CFG.name);
            var body = encodeURIComponent(
                "New Booking Request\n\n" +
                "Business: " + CFG.name + "\n" +
                "Customer: " + b.customerName + "\n" +
                "Phone: " + b.phone + "\n" +
                (b.email ? "Email: " + b.email + "\n" : "") +
                "Service: " + b.service + "\n" +
                "Date: " + b.date + "\n" +
                "Time: " + b.time + "\n" +
                (b.notes ? "Notes: " + b.notes + "\n" : "") +
                "\n---\nSent via your booking website"
            );
            setTimeout(function() {
                window.open("mailto:" + CFG.email + "?subject=" + subject + "&body=" + body, "_blank");
            }, 500);
        }
    }

    function copyBooking() {
        var text = document.getElementById('booking-summary')?.innerText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(function() {
            showToast(' Booking details copied! Send via SMS or email.');
        }).catch(function() {
            alert('Copy failed. Long-press and select text manually.');
        });
    }

    function showToast(msg) {
        var t = document.getElementById('toast');
        if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:100;background:#16a34a;color:white;padding:12px 24px;border-radius:12px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:block;';
        setTimeout(function(){ t.style.display = 'none'; }, 3500);
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ============================================================
    // 2. ADMIN DASHBOARD
    // ============================================================
    function initAdmin() {
        var toggle = document.getElementById('admin-toggle');
        var panel = document.getElementById('admin-panel');
        if (!toggle || !panel) return;

        toggle.addEventListener('click', function() {
            if (panel.classList.contains('open')) {
                panel.classList.remove('open');
                panel.style.display = 'none';
                return;
            }
            var pw = prompt('Enter admin password to view bookings:');
            if (pw === ADMIN_PW) {
                panel.style.display = 'block';
                panel.classList.add('open');
                renderAdmin();
            } else if (pw !== null) {
                alert('Incorrect password. Try again or contact support.');
            }
        });
    }

    function renderAdmin() {
        var container = document.getElementById('admin-bookings');
        if (!container) return;
        var bookings = getBookings();
        if (bookings.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No bookings yet. Share your site to start receiving requests.</p>';
            updateAdminStats(0);
            return;
        }
        var html = '<div class="overflow-x-auto"><table class="w-full text-sm">';
        html += '<thead><tr class="bg-gray-100">';
        html += '<th class="p-2 text-left">Date</th><th class="p-2 text-left">Customer</th><th class="p-2 text-left">Phone</th>';
        html += '<th class="p-2 text-left">Service</th><th class="p-2 text-left">When</th><th class="p-2 text-left">Notes</th><th class="p-2">Action</th>';
        html += '</tr></thead><tbody>';
        for (var i = bookings.length - 1; i >= 0; i--) {
            var b = bookings[i];
            var d = new Date(b.createdAt);
            var dateStr = (d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
            html += '<tr class="border-b hover:bg-gray-50">';
            html += '<td class="p-2 text-xs text-gray-400">' + dateStr + '</td>';
            html += '<td class="p-2 font-medium">' + esc(b.customerName) + '</td>';
            html += '<td class="p-2"><a href="tel:' + esc(b.phone) + '" class="text-blue-600">' + esc(b.phone) + '</a></td>';
            html += '<td class="p-2">' + esc(b.service) + '</td>';
            html += '<td class="p-2 text-xs">' + esc(b.date) + ' ' + esc(b.time) + '</td>';
            html += '<td class="p-2 text-xs text-gray-500 max-w-[150px] truncate">' + esc(b.notes) + '</td>';
            html += '<td class="p-2 text-center"><button onclick="deleteBooking(' + b.id + ')" class="text-xs text-red-500 hover:text-red-700">✕</button></td>';
            html += '</tr>';
        }
        html += '</tbody></table></div>';
        container.innerHTML = html;
        updateAdminStats(bookings.length);
    }

    window.deleteBooking = function(id) {
        if (!confirm('Remove this booking?')) return;
        var bookings = getBookings().filter(function(b) { return b.id !== id; });
        localStorage.setItem('evb_bookings', JSON.stringify(bookings));
        renderAdmin();
    };

    function updateAdminStats(count) {
        var stat = document.getElementById('admin-stats');
        if (stat) stat.textContent = count + ' booking' + (count !== 1 ? 's' : '');
    }

    // Export bookings
    function exportBookings() {
        var bookings = getBookings();
        if (!bookings.length) { alert('No bookings to export.'); return; }
        var csv = 'Date,Time,Customer,Phone,Email,Service,Booking Date,Booking Time,Notes\n';
        for (var i = 0; i < bookings.length; i++) {
            var b = bookings[i];
            csv += '"' + b.createdAt + '","' + b.customerName + '","' + b.phone + '","' + (b.email||'') + '","' + b.service + '","' + b.date + '","' + b.time + '","' + (b.notes||'') + '"\n';
        }
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = CFG.slug + '-bookings.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
    window.exportBookings = exportBookings;

    function clearAllBookings() {
        if (!confirm('Delete ALL bookings? This cannot be undone.')) return;
        if (!confirm('Are you sure? All booking data will be permanently removed.')) return;
        localStorage.setItem('evb_bookings', '[]');
        renderAdmin();
    }
    window.clearAllBookings = clearAllBookings;

    // ============================================================
    // 3. CAL.COM EMBED
    // ============================================================
    function initCalCom() {
        if (!CFG.calUsername) return;
        // Hide placeholder, show embed
        var ph = document.getElementById('cal-placeholder');
        var em = document.getElementById('cal-embed');
        if (ph) ph.style.display = 'none';
        if (em) {
            em.style.display = 'block';
            em.setAttribute('data-cal-link', CFG.calUsername + '/' + (CFG.calEventType || '30min'));
        }
        // Load Cal.com embed script
        if (!document.querySelector('script[src*="cal.com/embed.js"]')) {
            var script = document.createElement('script');
            script.src = 'https://cal.com/embed.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }

    // ============================================================
    // 4. PWA — Service Worker Registration
    // ============================================================
    function initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/evansville-booking-sites/sw.js')
                .then(function() { /* console.log('SW registered'); */ })
                .catch(function() { /* console.log('SW registration failed'); */ });
        }
    }

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        // Wire up booking form
        var form = document.getElementById('booking-form');
        if (form) form.addEventListener('submit', submitBooking);

        // Wire up copy button
        var copyBtn = document.getElementById('copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', copyBooking);

        // Init admin dashboard
        initAdmin();

        // Init Cal.com if configured
        initCalCom();

        // Init PWA
        initPWA();

        // Wire up delete buttons via mutation observer (for dynamic admin rows)
        var adminContainer = document.getElementById('admin-bookings');
        if (adminContainer) {
            var observer = new MutationObserver(function() {
                document.querySelectorAll('.delete-booking-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        deleteBooking(parseInt(this.dataset.id));
                    });
                });
            });
            observer.observe(adminContainer, { childList: true, subtree: true });
        }
    });
})();
