// ===== GLOBAL VARIABLES =====
let currentPrediction = null;
let predictionsChart = null;
let diagnosisChart = null;
let predictions = [];
let currentPage = 1;
const rowsPerPage = 10;

// ===== NAVIGATION =====
function showSection(sectionName) {
    try {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const section = document.getElementById(sectionName);
        if (section) {
            section.classList.add('active');
        }
        
        const navLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
        
        if (sectionName === 'dashboard') {
            setTimeout(() => {
                loadDashboard();
            }, 100);
        }
    } catch (error) {
        console.error('Error showing section:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });
    
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
    
    initializeUploadZone();
    loadPredictions();
});

// ===== UPLOAD ZONE =====
function initializeUploadZone() {
    const uploadZone = document.getElementById('uploadZone');
    const imageInput = document.getElementById('imageInput');
    
    if (!uploadZone || !imageInput) return;
    
    uploadZone.addEventListener('click', function() {
        imageInput.click();
    });
    
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary)';
        uploadZone.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
    });
    
    uploadZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        uploadZone.style.backgroundColor = '';
    });
    
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        uploadZone.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageUpload(files[0]);
        }
    });
    
    imageInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleImageUpload(e.target.files[0]);
        }
    });
}

function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('Veuillez sélectionner une image valide', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        displayImagePreview(e.target.result, file.name);
        document.getElementById('imageInput').dataset.file = file;
    };
    reader.readAsDataURL(file);
}

function displayImagePreview(imageSrc, fileName) {
    const uploadZone = document.getElementById('uploadZone');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const imageName = document.getElementById('imageName');
    
    if (!uploadZone || !imagePreview || !previewImage || !imageName) return;
    
    previewImage.src = imageSrc;
    imageName.textContent = fileName;
    
    uploadZone.style.display = 'none';
    imagePreview.style.display = 'block';
    
    document.getElementById('predictionResult').style.display = 'none';
}

// ===== PREDICTION =====
document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeImage);
    }
});

function analyzeImage() {
    const imageInput = document.getElementById('imageInput');
    const file = imageInput.files && imageInput.files[0];
    
    if (!file) {
        showNotification('Veuillez d\'abord sélectionner une image', 'warning');
        return;
    }
    
    showLoading(true);
    
    const formData = new FormData();
    formData.append('image', file);
    
    fetch('/api/predict', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const prediction = {
                diagnosis: data.prediction,
                confidence: data.confidence,
                probabilities: data.probabilities || {
                    NORMAL: 0.5,
                    PNEUMONIA: 0.5
                },
                timestamp: new Date().toISOString()
            };
            
            currentPrediction = prediction;
            displayPredictionResult(prediction);
            showNotification(`Analyse complète: ${data.prediction}`, 'success');
        } else {
            throw new Error(data.error || 'Erreur lors de l\'analyse');
        }
        showLoading(false);
    })
    .catch(error => {
        console.error('Error analyzing image:', error);
        showNotification(`Erreur: ${error.message}`, 'error');
        showLoading(false);
    });
}

function displayPredictionResult(prediction) {
    const resultDiv = document.getElementById('predictionResult');
    if (!resultDiv) return;
    
    const confidenceValue = document.getElementById('confidenceValue');
    const confidenceBar = document.getElementById('confidenceBar');
    const normalProb = document.getElementById('normalProb');
    const pneumoniaProb = document.getElementById('pneumoniaProb');
    const resultTimestamp = document.getElementById('resultTimestamp');
    
    const confidencePercent = (prediction.confidence * 100).toFixed(1);
    const normalPercent = (prediction.probabilities.NORMAL * 100).toFixed(1);
    const pneumoniaPercent = (prediction.probabilities.PNEUMONIA * 100).toFixed(1);
    
    if (confidenceValue) confidenceValue.textContent = `${confidencePercent}%`;
    if (confidenceBar) confidenceBar.style.width = `${confidencePercent}%`;
    if (normalProb) normalProb.textContent = `${normalPercent}%`;
    if (pneumoniaProb) pneumoniaProb.textContent = `${pneumoniaPercent}%`;
    if (resultTimestamp) resultTimestamp.textContent = new Date(prediction.timestamp).toLocaleString();
    
    resultDiv.style.display = 'block';
}

function resetPrediction() {
    const uploadZone = document.getElementById('uploadZone');
    const imagePreview = document.getElementById('imagePreview');
    const predictionResult = document.getElementById('predictionResult');
    const imageInput = document.getElementById('imageInput');
    
    if (uploadZone) uploadZone.style.display = 'block';
    if (imagePreview) imagePreview.style.display = 'none';
    if (predictionResult) predictionResult.style.display = 'none';
    if (imageInput) imageInput.value = '';
    
    currentPrediction = null;
}

function savePrediction() {
    if (!currentPrediction) {
        showNotification('Aucune prédiction à sauvegarder', 'warning');
        return;
    }
    
    fetch('/api/predictions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            timestamp: currentPrediction.timestamp,
            prediction: currentPrediction.diagnosis,
            confidence: currentPrediction.confidence
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        showNotification('Prédiction sauvegardée avec succès', 'success');
        loadPredictions();
    })
    .catch(error => {
        console.error('Error saving prediction:', error);
        showNotification(`Erreur lors de la sauvegarde: ${error.message}`, 'error');
    });
}

// ===== DASHBOARD =====
function loadDashboard() {
    try {
        updateStatistics();
        if (!predictionsChart || !diagnosisChart) {
            initializeCharts();
        } else {
            updateCharts();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateStatistics() {
    try {
        const totalPredictions = predictions.length;
        const normalCount = predictions.filter(p => p.prediction === 'NORMAL').length;
        const pneumoniaCount = predictions.filter(p => p.prediction === 'PNEUMONIA').length;
        const avgConfidence = predictions.length > 0 
            ? (predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length * 100).toFixed(1)
            : 0;
        
        const totalPredEl = document.getElementById('totalPredictions');
        const avgConfEl = document.getElementById('avgConfidence');
        const normalRateEl = document.getElementById('normalRate');
        const pneumoniaRateEl = document.getElementById('pneumoniaRate');
        
        if (totalPredEl) totalPredEl.textContent = totalPredictions;
        if (avgConfEl) avgConfEl.textContent = `${avgConfidence}%`;
        if (normalRateEl) normalRateEl.textContent = totalPredictions > 0 ? `${((normalCount/totalPredictions)*100).toFixed(1)}%` : '0%';
        if (pneumoniaRateEl) pneumoniaRateEl.textContent = totalPredictions > 0 ? `${((pneumoniaCount/totalPredictions)*100).toFixed(1)}%` : '0%';
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

function initializeCharts() {
    try {
        const predictionsCtx = document.getElementById('predictionsChart');
        if (predictionsCtx && window.Chart) {
            const today = new Date();
            const labels = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                labels.push(date.toISOString().split('T')[0]);
            }
            
            predictionsChart = new Chart(predictionsCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Prédictions par jour',
                        data: labels.map(() => 0),
                        borderColor: 'var(--primary)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        const diagnosisCtx = document.getElementById('diagnosisChart');
        if (diagnosisCtx && window.Chart) {
            diagnosisChart = new Chart(diagnosisCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Normal', 'Pneumonie'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: [
                            '#10B981',
                            '#EF4444'
                        ],
                        borderColor: 'var(--bg-secondary)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        updateCharts();
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

function updateCharts() {
    if (!predictionsChart || !diagnosisChart) return;
    
    try {
        const dailyPredictions = {};
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyPredictions[dateStr] = 0;
        }
        
        predictions.forEach(prediction => {
            const date = new Date(prediction.timestamp).toISOString().split('T')[0];
            if (dailyPredictions.hasOwnProperty(date)) {
                dailyPredictions[date]++;
            }
        });
        
        const labels = Object.keys(dailyPredictions);
        const data = Object.values(dailyPredictions);
        
        predictionsChart.data.labels = labels;
        predictionsChart.data.datasets[0].data = data;
        predictionsChart.update();
        
        const normalCount = predictions.filter(p => p.prediction === 'NORMAL').length;
        const pneumoniaCount = predictions.length - normalCount;
        
        diagnosisChart.data.datasets[0].data = [normalCount, pneumoniaCount];
        diagnosisChart.update();
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// ===== PAGINATION TABLE =====
function updatePredictionsTable() {
    const tbody = document.getElementById('predictionsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (predictions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Aucune prédiction</td></tr>';
        return;
    }
    
    // Calculer pagination
    const totalPages = Math.ceil(predictions.length / rowsPerPage);
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const paginatedData = predictions.slice(startIdx, endIdx);
    
    // Afficher les lignes de la page actuelle
    paginatedData.forEach(prediction => {
        const row = document.createElement('tr');
        const date = new Date(prediction.timestamp).toLocaleDateString('fr-FR');
        const confidence = ((prediction.confidence || 0) * 100).toFixed(1);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>
                <span class="diagnosis-badge ${prediction.prediction === 'NORMAL' ? 'normal' : 'pneumonia'}">
                    ${prediction.prediction}
                </span>
            </td>
            <td>${confidence}%</td>
            <td>N: ${((prediction.confidence || 0) * 100).toFixed(1)}% - P: ${(((1 - prediction.confidence) || 0) * 100).toFixed(1)}%</td>
            <td>
                <button class="btn btn-small btn-outline" onclick="deletePrediction(${prediction.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Ajouter pagination controls
    createPaginationControls(totalPages);
}

function createPaginationControls(totalPages) {
    // Supprimer anciens controls
    const oldPagination = document.querySelector('.pagination-controls');
    if (oldPagination) oldPagination.remove();
    
    // Créer nouveaux controls
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination-controls';
    paginationDiv.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 1.5rem;
        padding: 1rem 0;
        align-items: center;
        flex-wrap: wrap;
    `;
    
    // Bouton précédent
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Précédent';
        prevBtn.className = 'btn btn-small btn-outline';
        prevBtn.onclick = () => goToPage(currentPage - 1);
        paginationDiv.appendChild(prevBtn);
    }
    
    // Numéros de pages
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = `btn btn-small ${i === currentPage ? 'btn-primary' : 'btn-outline'}`;
        pageBtn.style.minWidth = '40px';
        pageBtn.onclick = () => goToPage(i);
        paginationDiv.appendChild(pageBtn);
    }
    
    // Bouton suivant
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Suivant →';
        nextBtn.className = 'btn btn-small btn-outline';
        nextBtn.onclick = () => goToPage(currentPage + 1);
        paginationDiv.appendChild(nextBtn);
    }
    
    // Infos pagination
    const info = document.createElement('span');
    info.style.cssText = 'margin-left: 1rem; font-size: 0.875rem; color: #666;';
    info.textContent = `Page ${currentPage} sur ${totalPages}`;
    paginationDiv.appendChild(info);
    
    // Ajouter après le tableau
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.parentNode.insertBefore(paginationDiv, tableContainer.nextSibling);
    }
}

function goToPage(page) {
    const totalPages = Math.ceil(predictions.length / rowsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        updatePredictionsTable();
        document.querySelector('.predictions-table').scrollIntoView({ behavior: 'smooth' });
    }
}

function loadPredictions() {
    currentPage = 1;
    
    fetch('/api/predictions')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            predictions = Array.isArray(data) ? data : [];
            updatePredictionsTable();
            updateStatistics();
            if (document.getElementById('dashboard')?.classList.contains('active')) {
                updateCharts();
            }
        })
        .catch(error => {
            console.error('Error loading predictions:', error);
            predictions = [];
            updatePredictionsTable();
        });
}

function deletePrediction(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette prédiction ?')) {
        return;
    }
    
    fetch(`/api/predictions/${id}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            showNotification('Prédiction supprimée', 'success');
            loadPredictions();
        } else {
            throw new Error('Erreur lors de la suppression');
        }
    })
    .catch(error => {
        console.error('Error deleting prediction:', error);
        showNotification(`Erreur lors de la suppression: ${error.message}`, 'error');
    });
}

// ===== UTILITY FUNCTIONS =====
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.toggle('active', show);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6366F1'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        z-index: 1500;
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        opacity: 0.8;
        transition: opacity 0.2s;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
    
    .btn-small {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
    }
    
    .diagnosis-badge {
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        font-weight: 500;
        font-size: 0.875rem;
    }
    
    .diagnosis-badge.normal {
        background-color: #DCFCE7;
        color: #166534;
    }
    
    .diagnosis-badge.pneumonia {
        background-color: #FEE2E2;
        color: #991B1B;
    }

    .pagination-controls button {
        cursor: pointer;
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function() {
    showSection('home');
    
    setTimeout(() => {
        if (!predictionsChart && !diagnosisChart) {
            initializeCharts();
        }
    }, 500);
});