// Configuration - Use auto-detection for now
const getApiBaseUrl = () => {
    // Use auto-detection based on current hostname
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:7071"
        : `https://${window.location.hostname}`;
};

const apiBaseUrl = getApiBaseUrl();
const FUNCTION_URL = `${apiBaseUrl}/api/list-images`;
const VISITOR_COUNT_URL = `${apiBaseUrl}/api/visitor-count`;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const galleryEl = document.getElementById('gallery');
const statsEl = document.getElementById('stats');
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');
const visitorCountEl = document.getElementById('visitorCount');

// Load images and update visitor count when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadImages();
    updateVisitorCount();
});

async function loadImages() {
    showLoading();
    hideError();
    
    // Debug info
    console.log('Environment:', window.location.hostname);
    console.log('API Base URL:', apiBaseUrl);
    console.log('Function URL:', FUNCTION_URL);
    
    try {
        console.log('Fetching from:', FUNCTION_URL);
        const response = await fetch(FUNCTION_URL);
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const imageUrls = await response.json();
        console.log('Successfully loaded images:', imageUrls);
        displayImages(imageUrls);
        updateStats(imageUrls.length);
        
    } catch (error) {
        console.error('Error loading images:', error);
        console.error('Full error details:', {
            message: error.message,
            stack: error.stack,
            functionUrl: FUNCTION_URL,
            hostname: window.location.hostname
        });
        showError(`Failed to load images: ${error.message}. Trying to fetch from: ${FUNCTION_URL}`);
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

// Custom captions for photos
const photoCaptions = {
    'IMG_0329.jpg': 'Caramel Playing in the Yard',
    'IMG_0396.jpg': 'Sleepy Caramel',
    'IMG_0538.jpg': 'At the Dog Park',
    'IMG_2388.jpg': 'Happy Caramel',
    'IMG_2410.jpg': 'Sunny Day Walk',
    'IMG_2419.jpg': 'Caramel Being Cute',
    'IMG_2618.jpg': 'Adventure Time',
    'IMG_2899.JPG': 'Golden Hour Caramel',
    'IMG_4208.jpg': 'Playing with Toys',
    'IMG_5141.jpg': 'Caramel\'s Portrait',
    'IMG_7896.JPG': 'Relaxing Day',
    'IMG_7952.JPG': 'Beautiful Caramel',
    'IMG_8614.jpg': 'Fun Times',
    'IMG_9981.jpg': 'Sweet Caramel'
};

function createImageCard(imageUrl) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Get custom caption or use filename as fallback
    const caption = photoCaptions[filename] || filename;
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${caption}" onclick="openModal('${imageUrl}')" onerror="handleImageError(this)">
        <div class="image-info">
            <div class="image-name">${caption}</div>
        </div>
    `;
    
    return card;
}

function handleImageError(img) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgbG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
    img.alt = 'Failed to load image';
}

function openModal(imageUrl) {
    modal.style.display = 'flex';
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
    // Stats display removed
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

// Visitor Counter Functions
async function updateVisitorCount() {
    try {
        console.log('Updating visitor count...');
        const response = await fetch(VISITOR_COUNT_URL, {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Visitor count response:', data);
            visitorCountEl.textContent = data.count || 'Error';
        } else {
            console.error('Failed to fetch visitor count:', response.status);
            visitorCountEl.textContent = 'Error';
        }
    } catch (error) {
        console.error('Error fetching visitor count:', error);
        visitorCountEl.textContent = 'Error';
    }
}