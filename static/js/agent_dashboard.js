document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('toast-msg');
    let toastTimeout = null;

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // Filter Farmers Table
    const farmerSearch = document.getElementById('farmer-search');
    const farmersTbody = document.getElementById('farmers-tbody');

    if (farmerSearch && farmersTbody) {
        farmerSearch.addEventListener('input', () => {
            const query = farmerSearch.value.toLowerCase().trim();
            const rows = farmersTbody.querySelectorAll('tr');
            rows.forEach((row) => {
                const text = row.textContent.toLowerCase();
                row.style.display = !query || text.includes(query) ? '' : 'none';
            });
        });
    }

    // Match Allocation Confirmation
    document.querySelectorAll('.propose-match-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const crop = btn.dataset.crop || 'Produce Lot';
            const buyer = btn.dataset.buyer || 'Verified Buyer';
            const volume = btn.dataset.volume || '100 Qtl';

            if (confirm(`Allocate ${volume} of ${crop} from local cooperative to ${buyer}?`)) {
                btn.textContent = '✓ Allocated';
                btn.disabled = true;
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary');
                showToast(`Allocation agreement proposed for ${crop}! Buyer notified.`);
            }
        });
    });
});
