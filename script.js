document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('category-select');
    const journalEntriesContainer = document.getElementById('journal-entries');
    const loadMoreButton = document.getElementById('load-more-button');
    const apiUrl = 'http://localhost:8080';

    // Paginierung Status
    let currentPage = 1;
    const pageSize = 5;
    let currentCategoryId = null;
    let lastRenderedDate = null;

    // Modal Elemente
    const modal = document.getElementById('edit-modal');
    const closeButton = document.querySelector('.close-button');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const editContentTextarea = document.getElementById('edit-content');
    const editDateInput = document.getElementById('edit-date');
    const editCategoriesContainer = document.getElementById('edit-categories');
    let currentEditingEntry = null;
    let allCategories = [];

    // Kategorien laden und Dropdown füllen
    async function fetchCategories() {
        try {
            const response = await fetch(`${apiUrl}/categories`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const categories = await response.json();
            allCategories = categories; // Speichern für späteren Zugriff
            populateCategoryDropdown(categories);
        } catch (error) {
            console.error('Fehler beim Laden der Kategorien:', error);
            journalEntriesContainer.innerHTML = '<p>Fehler beim Laden der Kategorien. Ist die API erreichbar?</p>';
        }
    }

    function populateCategoryDropdown(categories) {
        categories
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.category;
                categorySelect.appendChild(option);
            });
    }

    // Journal-Einträge für eine Kategorie laden
    async function fetchJournalEntries(categoryId, append = false) {
        if (!categoryId) {
            journalEntriesContainer.innerHTML = '';
            loadMoreButton.style.display = 'none';
            return;
        }

        if (!append) {
            currentPage = 1;
            currentCategoryId = categoryId;
            lastRenderedDate = null;
            journalEntriesContainer.innerHTML = '<p>Lade Einträge...</p>';
            loadMoreButton.style.display = 'none';
        } else {
            loadMoreButton.textContent = 'Lade...';
            loadMoreButton.disabled = true;
        }

        try {
            const response = await fetch(`${apiUrl}/journalentries/category/${categoryId}?page=${currentPage}&pageSize=${pageSize}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const entries = await response.json();
            
            if (!append) {
                journalEntriesContainer.innerHTML = '';
            }

            displayJournalEntries(entries);

            // Button Logik
            if (entries.length < pageSize) {
                loadMoreButton.style.display = 'none';
            } else {
                loadMoreButton.style.display = 'block';
                loadMoreButton.textContent = 'Mehr laden';
                loadMoreButton.disabled = false;
            }

            currentPage++;

        } catch (error)
        {
            console.error(`Fehler beim Laden der Journal-Einträge für Kategorie ${categoryId}:`, error);
            if (!append) {
                journalEntriesContainer.innerHTML = `<p>Fehler beim Laden der Einträge für die ausgewählte Kategorie.</p>`;
            } else {
                loadMoreButton.textContent = 'Fehler beim Laden';
                loadMoreButton.disabled = false;
            }
        }
    }

    // Journal-Einträge als Chat-Liste anzeigen
    function displayJournalEntries(entries) {
        if (entries.length === 0 && !journalEntriesContainer.hasChildNodes()) {
            journalEntriesContainer.innerHTML = '<p>Keine Einträge für diese Kategorie gefunden.</p>';
            return;
        }

        const sortedEntries = entries.sort((a, b) => b.timestamp - a.timestamp);

        sortedEntries.forEach(entry => {
            const dateObj = new Date(entry.timestamp);
            const dateString = dateObj.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (dateString !== lastRenderedDate) {
                const dateHeader = document.createElement('div');
                dateHeader.classList.add('date-header');
                dateHeader.textContent = dateString;
                journalEntriesContainer.appendChild(dateHeader);
                lastRenderedDate = dateString;
            }

            const bubble = document.createElement('div');
            bubble.classList.add('journal-entry');
            // Click-Event zum Öffnen des Modals hinzufügen
            bubble.addEventListener('click', () => openEditModal(entry));

            const content = document.createElement('div');
            content.classList.add('entry-content');
            content.textContent = entry.content;

            const timestamp = document.createElement('span');
            timestamp.classList.add('timestamp');
            timestamp.textContent = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            bubble.appendChild(content);
            bubble.appendChild(timestamp);
            journalEntriesContainer.appendChild(bubble);
        });
    }

    const newEntryButton = document.getElementById('new-entry-button');
    const modalTitle = document.getElementById('modal-title');

    // Event Listener für das Dropdown
    categorySelect.addEventListener('change', (event) => {
        const categoryId = event.target.value;
        fetchJournalEntries(categoryId);
    });

    // Event Listener für Load More Button
    loadMoreButton.addEventListener('click', () => {
        if (currentCategoryId) {
            fetchJournalEntries(currentCategoryId, true);
        }
    });

    // Event Listener für Neuer Eintrag Button
    newEntryButton.addEventListener('click', () => openEditModal(null));

    // Modal Funktionen
    function openEditModal(entry) {
        currentEditingEntry = entry;
        
        if (entry) {
            modalTitle.textContent = 'Eintrag bearbeiten';
            editContentTextarea.value = entry.content;
            
            // Datum für datetime-local formatieren (YYYY-MM-DDTHH:mm)
            const date = new Date(entry.timestamp);
            const offset = date.getTimezoneOffset() * 60000;
            const localIsoString = new Date(date.getTime() - offset).toISOString().slice(0, 16);
            editDateInput.value = localIsoString;
        } else {
            modalTitle.textContent = 'Neuer Eintrag';
            editContentTextarea.value = '';
            
            // Aktuelles Datum setzen
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const localIsoString = new Date(now.getTime() - offset).toISOString().slice(0, 16);
            editDateInput.value = localIsoString;
        }

        // Kategorien Checkboxen generieren
        editCategoriesContainer.innerHTML = '';
        const currentSelectedCategoryId = parseInt(categorySelect.value);

        allCategories.forEach(category => {
            const label = document.createElement('label');
            label.classList.add('category-checkbox');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = category.id;
            
            if (entry) {
                // Bearbeiten: Prüfen ob die Kategorie dem Eintrag zugeordnet ist
                if (entry.categoryIds && entry.categoryIds.includes(category.id)) {
                    checkbox.checked = true;
                }
            } else {
                // Neu: Aktuell ausgewählte Kategorie vorselektieren
                if (category.id === currentSelectedCategoryId) {
                    checkbox.checked = true;
                }
            }
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' ' + category.category));
            editCategoriesContainer.appendChild(label);
        });

        modal.style.display = 'block';
    }

    function closeEditModal() {
        modal.style.display = 'none';
        currentEditingEntry = null;
    }

    async function saveEntry() {
        const newContent = editContentTextarea.value;
        const newDateString = editDateInput.value;
        const newTimestamp = new Date(newDateString).getTime();

        // Ausgewählte Kategorien sammeln
        const selectedCategoryIds = Array.from(editCategoriesContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value));

        let url = `${apiUrl}/journalentries`;
        let method = 'POST';
        let entryData = {
            content: newContent,
            timestamp: newTimestamp,
            categoryIds: selectedCategoryIds
        };

        if (currentEditingEntry) {
            // Update (PUT)
            url = `${apiUrl}/journalentries/${currentEditingEntry.id}`;
            method = 'PUT';
            // Bestehende Daten nehmen und mit neuen überschreiben (hasImage bleibt erhalten)
            entryData = { ...currentEditingEntry, ...entryData };
        } else {
            // Neu (POST)
            // Standardwerte für neue Einträge setzen
            entryData.hasImage = false;
        }

        console.log('Sende Daten an Server:', entryData); // Debugging

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entryData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // UI aktualisieren (Liste neu laden)
            const categoryId = categorySelect.value;
            fetchJournalEntries(categoryId);
            closeEditModal();

        } catch (error) {
            console.error('Fehler beim Speichern des Eintrags:', error);
            alert('Fehler beim Speichern des Eintrags.');
        }
    }

    // Event Listener für Modal
    closeButton.addEventListener('click', closeEditModal);
    cancelButton.addEventListener('click', closeEditModal);
    saveButton.addEventListener('click', saveEntry);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeEditModal();
        }
    });

    // Initiales Laden der Kategorien
    fetchCategories();
});
