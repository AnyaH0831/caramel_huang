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

// Comprehensive image metadata
const imageMetadata = {
    'IMG_0329.jpg': {
        caption: 'What you watchin\'?',
        date: 'January 16, 2023',
        weather: 'Partly Cloudy, 22°C',
        location: 'Home',
        description: 'Taking a million selfies here.'
    },
    'IMG_0396.jpg': {
        caption: 'Handshake',
        date: 'January 18, 2023',
        weather: 'Cold, -10°C',
        location: 'Home',
        description: 'Anya\'s using Caramel to complete her science summative.'
    },
    'IMG_0538.jpg': {
        caption: 'Hehe I\'m pretty',
        date: 'January 31, 2023',
        weather: 'Cold, -15°C',
        location: 'Home',
        description: 'Caramel is pretty and she knows it.'
    },
    'IMG_2388.jpg': {
        caption: 'Happy Caramel at WOSS',
        date: 'June 13, 2025',
        weather: 'Warm, 22°C',
        location: 'WOSS North Campus',
        description: 'Adventure day at WOSS! Caramel is excited to explore new areas.'
    },
    'IMG_2410.jpg': {
        caption: 'Watchin\' humans at WOSS',
        date: 'June 13, 2025',
        weather: 'Warm, 22°C',
        location: 'WOSS South Campus, Infront of library',
        description: 'Caramel loves watching people and bark at them :D'
    },
    'IMG_2419.jpg': {
        caption: 'Haha I just barked at Mr.VR',
        date: 'June 13, 2025',
        weather: 'Warm, 22°C',
        location: 'WOSS North Campus, Infront of Portable 1',
        description: 'HAHA! Caramel hates Math!'
    },
    'IMG_2618.jpg': {
        caption: 'I look so mature as an UOttawa alumini',
        date: 'June 21, 2025',
        weather: 'Hot, 25°C',
        location: 'Home',
        description: 'Caramel in her distinguished University of Ottawa alumini scarf.'
    },
    'IMG_2899.JPG': {
        caption: 'I\'m so mature',
        date: 'April 30, 2022',
        weather: 'Cool, 18°C',
        location: 'Evan\'s Office',
        description: 'The one time she\'s photogenic....Or the first time the photo was taken correctly.'
    },
    'IMG_4208.jpg': {
        caption: 'I\'m a deer',
        date: 'July 17, 2022',
        weather: 'Warm, 25°C',
        location: 'Backyard',
        description: 'Caramel\'s ears are finally up like a deer.'
    },
    'IMG_5141.jpg': {
        caption: 'Skunk ToT',
        date: 'September 21, 2025',
        weather: 'Warm, 20°C',
        location: 'Home',
        description: 'The day Caramel encountered a skunk... that\'s why you shouldn\'t chase after a skunk!'
    },
    'IMG_7896.JPG': {
        caption: 'Hehe fwend',
        date: 'October 11, 2024',
        weather: 'Sunny, 19°C',
        location: 'Home',
        description: 'Got forced to make a new friend.'
    },
    'IMG_7952.JPG': {
        caption: 'Chipmunks',
        date: 'October 19, 2022',
        weather: 'Clear, 17°C',
        location: 'Evan\'s Office',
        description: 'Caramel is killing the chipmunk as usual.'
    },
    'IMG_8614.jpg': {
        caption: ':/',
        date: 'October 26, 2022',
        weather: 'Cloudy, 16°C',
        location: 'Evan\'s Office',
        description: 'Hehe'
    },
    'IMG_9981.jpg': {
        caption: 'I\'m handsome',
        date: 'April 6, 2025',
        weather: 'Sunny, 15°C',
        location: 'Home',
        description: 'Caramel stole a bow tie from a cake.'
    }
};

function createImageCard(imageUrl) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Get metadata or use filename as fallback
    const metadata = imageMetadata[filename];
    const caption = metadata ? metadata.caption : filename;
    
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
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Get metadata for this image
    const metadata = imageMetadata[filename];
    
    // Show modal
    modal.style.display = 'flex';
    modalImg.src = imageUrl;
    
    // Populate info panel
    if (metadata) {
        document.getElementById('infoTitle').textContent = metadata.caption;
        document.getElementById('infoDate').textContent = metadata.date;
        document.getElementById('infoWeather').textContent = metadata.weather;
        document.getElementById('infoLocation').textContent = metadata.location;
        document.getElementById('infoDescription').textContent = metadata.description;
    } else {
        // Fallback for images without metadata
        document.getElementById('infoTitle').textContent = filename;
        document.getElementById('infoDate').textContent = 'Date not available';
        document.getElementById('infoWeather').textContent = 'Weather not recorded';
        document.getElementById('infoLocation').textContent = 'Location unknown';
        document.getElementById('infoDescription').textContent = 'No description available for this image.';
    }
}

function closeModal() {
    modal.style.display = 'none';
}

// Close modal when clicking outside the container
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
    // Randomly choose between two specific colors
    const colors = ['#8B4513', '#CD853F']; // Original brown and sandy brown
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const pawElement = document.createElement('div');
    pawElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" version="1.1">
            <path d="M 18.719 5.758 C 16.287 6.374, 13.384 9.696, 12.675 12.672 C 11.014 15.451, 12.208 18.751, 15.360 20.110 C 16.498 20.831, 17.996 20.929, 19.239 20.364 C 20.193 19.930, 21.252 18.840, 21.780 17.746 C 22.441 16.380, 22.604 15.516, 22.587 13.440 C 22.557 9.329, 21.756 6.668, 20.331 5.942 C 19.890 5.717, 19.196 5.637, 18.719 5.758 M 28.128 5.748 C 27.078 6.090, 26.461 6.901, 25.978 8.566 C 25.635 9.747, 25.422 11.616, 25.410 13.536 C 25.398 15.507, 25.570 16.405, 26.220 17.746 C 26.742 18.828, 27.801 19.923, 28.761 20.374 C 29.376 20.664, 29.469 20.686, 30.432 20.688 C 31.399 20.690, 31.500 20.671, 32.196 20.326 C 33.495 19.707, 34.487 18.505, 35.046 16.874 C 35.775 14.749, 35.658 12.933, 34.661 10.896 C 33.315 8.142, 30.803 5.893, 28.878 5.716 C 28.549 5.691, 28.260 5.703, 28.128 5.748 M 8.322 16.549 C 6.991 17.042, 5.936 18.568, 5.451 20.424 C 5.184 21.476, 5.244 22.920, 5.590 23.735 C 6.232 25.209, 7.893 26.584, 9.627 27.111 C 10.540 27.389, 11.662 27.331, 12.398 26.973 C 14.173 26.105, 15.055 23.655, 14.544 21.061 C 14.028 18.441, 11.670 14.489, 10.065 13.873 C 9.390 13.626, 8.799 13.556, 8.322 16.549 M 38.328 16.595 C 37.080 17.028, 35.798 18.668, 34.611 20.655 C 33.420 22.653, 33.078 24.563, 33.543 26.316 C 33.838 27.583, 34.570 28.747, 35.595 29.250 C 36.338 29.611, 37.454 29.669, 38.367 29.391 C 40.101 28.864, 41.762 27.489, 42.404 26.015 C 42.756 25.189, 42.816 23.753, 42.541 22.691 C 42.045 20.831, 40.992 17.046, 39.666 16.555 C 39.144 16.381, 38.736 16.389, 38.328 16.595 M 22.380 21.460 C 22.043 21.594, 21.356 21.912, 20.853 22.160 C 20.090 22.530, 19.803 22.739, 19.107 23.433 C 18.600 23.940, 18.076 24.681, 17.819 25.142 C 16.818 26.866, 15.873 28.003, 13.647 29.653 C 12.638 30.444, 12.144 30.946, 11.619 31.972 C 10.060 35.264, 11.172 38.589, 14.252 40.085 C 15.528 40.704, 16.559 40.928, 18.144 40.931 C 19.575 40.933, 20.056 40.858, 21.800 40.365 C 22.810 40.080, 23.128 40.032, 24.000 40.032 C 24.872 40.032, 25.190 40.080, 26.200 40.365 C 27.939 40.857, 28.423 40.933, 29.856 40.930 C 30.882 40.929, 31.330 40.885, 32.016 40.713 C 35.120 39.934, 37.059 37.788, 37.073 35.115 C 37.085 32.808, 35.839 30.656, 33.495 28.932 C 32.061 27.879, 31.091 26.713, 30.185 24.960 C 29.914 24.433, 29.580 24.004, 28.944 23.364 C 28.201 22.616, 27.940 22.423, 27.158 22.040 C 26.652 21.794, 25.941 21.594, 25.599 21.504 C 24.753 21.282, 23.195 21.283, 22.380 21.460" stroke="none" fill="${randomColor}" fill-rule="evenodd"/>
        </svg>
    `;
    pawElement.style.position = 'fixed';
    pawElement.style.left = (x - 24) + 'px'; // Center the 48px SVG
    pawElement.style.top = (y - 24) + 'px';
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