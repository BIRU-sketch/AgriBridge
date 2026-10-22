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

    // Farmer Search Filter
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
});
