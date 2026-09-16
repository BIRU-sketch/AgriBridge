document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('marketplace-search-form');
    const result = document.getElementById('marketplace-result');
    const purchaseForm = document.getElementById('purchase-form');
    const purchaseQuantity = document.getElementById('purchase-quantity');
    let currentSearch = null;

    if (!searchForm || !result || !purchaseForm || !purchaseQuantity) {
        return;
    }

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        result.className = 'mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300';
        result.textContent = 'Searching available stock...';

        const params = new URLSearchParams(new FormData(searchForm));

        try {
            const response = await fetch(`${searchForm.action}?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Unable to search available stock.');
            }

            currentSearch = data;
            result.className = 'mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300';
            result.textContent = `${data.crop_name} ${data.quantity} available in stock.`;
            purchaseForm.classList.toggle('hidden', data.quantity <= 0);
            purchaseQuantity.max = data.quantity;
            purchaseQuantity.value = '';
        } catch (error) {
            purchaseForm.classList.add('hidden');
            result.className = 'mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300';
            result.textContent = error.message;
        }
    });

    purchaseForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!currentSearch) {
            return;
        }

        const quantity = Number(purchaseQuantity.value);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > currentSearch.quantity) {
            result.className = 'mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300';
            result.textContent = 'Enter a purchase quantity within the available stock.';
            return;
        }

        const confirmed = window.confirm(
            `Confirm purchase of ${quantity} ${currentSearch.crop_name}?`
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    crop_name: currentSearch.crop_name,
                    quality: currentSearch.quality,
                    quantity
                })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Unable to complete the purchase request.');
            }

            currentSearch.quantity = data.remaining_stock;
            result.className = 'mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300';
            result.textContent = `${data.message} ${data.remaining_stock} ${data.crop_name} available in stock.`;
            purchaseForm.classList.toggle('hidden', data.remaining_stock <= 0);
            purchaseQuantity.max = data.remaining_stock;
            purchaseQuantity.value = '';
        } catch (error) {
            result.className = 'mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300';
            result.textContent = error.message;
        }
    });
});