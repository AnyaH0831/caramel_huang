// Configuration - Automatically detects local vs production environment
const apiBaseUrl = window.location.hostname.includes("localhost")
  ? "http://localhost:7071"
  : `https://${window.location.hostname}`;
const FUNCTION_URL = `${apiBaseUrl}/api/list-images`;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const galleryEl = document.getElementById('gallery');
const statsEl = document.getElementById('stats');
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');

// Load images when page loads
document.addEventListener('DOMContentLoaded', loadImages);

async function loadImages() {
    showLoading();
    hideError();
    
    try {
        const response = await fetch(FUNCTION_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const imageUrls = await response.json();
        displayImages(imageUrls);
        updateStats(imageUrls.length);
        
    } catch (error) {
        console.error('Error loading images:', error);
        showError(`Failed to load images: ${error.message}. Make sure your Azure Function is running on ${FUNCTION_URL}`);
    } finally {
        hideLoading();
    }
}

function displayImages(imageUrls) {
    galleryEl.innerHTML = '';
    
    if (imageUrls.length === 0) {
        galleryEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--dark-goldenrod); font-size: 1.2rem;">No images found in your storage container.</div>';
        return;
    }

    imageUrls.forEach(url => {
        const imageCard = createImageCard(url);
        galleryEl.appendChild(imageCard);
    });
}

function createImageCard(imageUrl) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${filename}" onclick="openModal('${imageUrl}')" onerror="handleImageError(this)">
        <div class="image-info">
            <div class="image-name">${filename}</div>
        </div>
    `;
    
    return card;
}

function handleImageError(img) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgbG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
    img.alt = 'Failed to load image';
}

function openModal(imageUrl) {
    modal.style.display = 'block';
    modalImg.src = imageUrl;
}

function closeModal() {
    modal.style.display = 'none';
}

// Close modal when clicking outside the image
modal.onclick = function(event) {
    if (event.target === modal) {
        closeModal();
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

function showLoading() {
    loadingEl.style.display = 'block';
    galleryEl.style.display = 'none';
    statsEl.style.display = 'none';
}

function hideLoading() {
    loadingEl.style.display = 'none';
    galleryEl.style.display = 'grid';
    statsEl.style.display = 'block';
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    errorEl.style.display = 'none';
}

function updateStats(count) {
    statsEl.textContent = `Found ${count} image${count !== 1 ? 's' : ''} in your collection`;
}

// Paw click effect
function createPawEffect(x, y) {    
    const pawElement = document.createElement('div');
    pawElement.innerHTML = '🐾';
    pawElement.style.filter = 'sepia(100%) saturate(200%) hue-rotate(15deg) brightness(0.8)';
    pawElement.style.position = 'fixed';
    pawElement.style.left = (x - 20) + 'px';
    pawElement.style.top = (y - 20) + 'px';
    pawElement.style.fontSize = '36px';
    pawElement.style.pointerEvents = 'none';
    pawElement.style.zIndex = '9999';
    pawElement.style.animation = 'pawEffect 1.5s ease-out forwards';
    pawElement.style.userSelect = 'none';
    
    document.body.appendChild(pawElement);
    
    // Remove the element after animation
    setTimeout(() => {
        if (pawElement.parentNode) {
            pawElement.parentNode.removeChild(pawElement);
        }
    }, 1500);
}

// Add click event listener to the entire document
document.addEventListener('click', function(e) {
    // Don't add paw effect when clicking on images or buttons (to avoid interference)
    if (!e.target.closest('img, button, .close')) {
        createPawEffect(e.clientX, e.clientY);
    }
});