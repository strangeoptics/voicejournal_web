document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('category-select');
    const journalEntriesContainer = document.getElementById('journal-entries');
    
    // Create Sentinel dynamically
    const scrollSentinel = document.createElement('div');
    scrollSentinel.id = 'scroll-sentinel';
    scrollSentinel.style.height = '20px';
    scrollSentinel.style.textAlign = 'center';
    scrollSentinel.style.color = '#888';
    scrollSentinel.style.width = '100%';

    const apiUrlInput = document.getElementById('api-url');
    const refreshApiButton = document.getElementById('refresh-api');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const pageSizeInput = document.getElementById('page-size');
    
    // API Host aus LocalStorage laden oder Standardwert setzen
    let apiHost = localStorage.getItem('voicejournal_api_host') || 'localhost';
    let apiUrl = `http://${apiHost}:8080`;
    apiUrlInput.value = apiHost;

    // Paginierung Status
    let currentPage = 1;
    let pageSize = parseInt(localStorage.getItem('voicejournal_page_size')) || 5;
    pageSizeInput.value = pageSize;
    let currentCategoryId = null;
    let lastRenderedDate = null;
    let isLoading = false;
    let hasMore = true;

    // Intersection Observer für Infinite Scroll
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore && currentCategoryId) {
            fetchJournalEntries(currentCategoryId, true);
        }
    }, { 
        root: journalEntriesContainer,
        threshold: 0.1 
    });

    observer.observe(scrollSentinel);

    // Modal Elemente
    const modal = document.getElementById('edit-modal');
    const closeButton = document.querySelector('.close-button');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const deleteButton = document.getElementById('delete-button');
    const editContentTextarea = document.getElementById('edit-content');
    const editDateInput = document.getElementById('edit-date');
    const editEndDateInput = document.getElementById('edit-end-date');
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
            journalEntriesContainer.innerHTML = `<p style="color: red; padding: 20px;">Fehler beim Laden der Kategorien.<br>
            API URL: ${apiUrl}/categories<br>
            Fehler: ${error.message}<br>
            Ist das Backend gestartet?</p>`;
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
            scrollSentinel.textContent = '';
            return;
        }

        if (isLoading) return;
        isLoading = true;

        if (!append) {
            currentPage = 1;
            currentCategoryId = categoryId;
            lastRenderedDate = null;
            hasMore = true;
            journalEntriesContainer.innerHTML = '';
            journalEntriesContainer.appendChild(scrollSentinel);
            scrollSentinel.textContent = 'Lade Einträge...';
        } else {
            scrollSentinel.textContent = 'Lade mehr...';
        }

        try {
            const selectedCategory = allCategories.find(c => c.id == categoryId);
            let currentSize = pageSize;
            if (selectedCategory && selectedCategory.showAll) {
                currentSize = 10000;
            }

            const response = await fetch(`${apiUrl}/journalentries/category/${categoryId}?page=${currentPage}&pageSize=${currentSize}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const entries = await response.json();
            
            displayJournalEntries(entries);

            // Check if we reached the end
            if (entries.length < currentSize) {
                hasMore = false;
                scrollSentinel.textContent = '';
            } else {
                scrollSentinel.textContent = ''; // Clear text, sentinel remains for observer
            }
            
            // Ensure sentinel is at the bottom
            journalEntriesContainer.appendChild(scrollSentinel);

            currentPage++;

        } catch (error)
        {
            console.error(`Fehler beim Laden der Journal-Einträge für Kategorie ${categoryId}:`, error);
            if (!append) {
                journalEntriesContainer.innerHTML = `<p>Fehler beim Laden der Einträge für die ausgewählte Kategorie.</p>`;
            }
            scrollSentinel.textContent = 'Fehler beim Laden';
            journalEntriesContainer.appendChild(scrollSentinel);
        } finally {
            isLoading = false;
        }
    }

    // Journal-Einträge als Chat-Liste anzeigen
    function displayJournalEntries(entries) {
        if (entries.length === 0 && !journalEntriesContainer.hasChildNodes()) {
            journalEntriesContainer.innerHTML = '<p>Keine Einträge für diese Kategorie gefunden.</p>';
            return;
        }

        const sortedEntries = entries.sort((a, b) => b.start_datetime - a.start_datetime);

        sortedEntries.forEach(entry => {
            const dateObj = new Date(entry.start_datetime);
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
            bubble.dataset.id = entry.id;
            
            // Long Click Logic für das Öffnen des Modals
            let pressTimer = null;
            const startPress = (e) => {
                // Nur Linksklick oder Touch
                if (e.type === 'mousedown' && e.button !== 0) return;

                if (pressTimer === null) {
                    pressTimer = setTimeout(() => {
                        openEditModal(entry);
                        pressTimer = null;
                    }, 600); // 600ms für Long Click
                }
            };
            const cancelPress = () => {
                if (pressTimer !== null) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            bubble.addEventListener('mousedown', startPress);
            bubble.addEventListener('touchstart', startPress, { passive: true });
            bubble.addEventListener('mouseup', cancelPress);
            bubble.addEventListener('mouseleave', cancelPress);
            bubble.addEventListener('touchend', cancelPress);
            bubble.addEventListener('touchmove', cancelPress, { passive: true });
            
            // Prevent context menu on long press
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });

            const content = document.createElement('div');
            content.classList.add('entry-content');
            content.textContent = entry.content;

            const timestamp = document.createElement('span');
            timestamp.classList.add('timestamp');
            
            let timeString = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            if (entry.stop_datetime) {
                const endDateObj = new Date(entry.stop_datetime);
                const endTimeString = endDateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                timeString += ` - ${endTimeString}`;
            }
            timestamp.textContent = timeString;

            const footer = document.createElement('div');
            footer.classList.add('entry-footer');

            const categoriesDiv = document.createElement('div');
            categoriesDiv.classList.add('entry-categories');

            if (entry.categoryIds && entry.categoryIds.length > 0) {
                const otherCategories = entry.categoryIds
                    .filter(id => id != currentCategoryId)
                    .map(id => {
                        const cat = allCategories.find(c => c.id === id);
                        return cat ? cat.category : '';
                    })
                    .filter(name => name !== '');

                if (otherCategories.length > 0) {
                    otherCategories.forEach(catName => {
                        const tag = document.createElement('span');
                        tag.classList.add('entry-category-tag');
                        tag.textContent = catName;
                        categoriesDiv.appendChild(tag);
                    });
                }
            }

            footer.appendChild(categoriesDiv);
            footer.appendChild(timestamp);

            bubble.appendChild(content);
            bubble.appendChild(footer);

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

    // Event Listener für Neuer Eintrag Button
    newEntryButton.addEventListener('click', () => openEditModal(null));

    // Event Listener für Settings Toggle
    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('open');
    });

    // Event Listener für API Host Änderung
    refreshApiButton.addEventListener('click', () => {
        let newHost = apiUrlInput.value.trim();
        let newPageSize = parseInt(pageSizeInput.value);

        if (newHost && newPageSize > 0) {
            apiHost = newHost;
            apiUrl = `http://${apiHost}:8080`;
            pageSize = newPageSize;
            
            localStorage.setItem('voicejournal_api_host', apiHost);
            localStorage.setItem('voicejournal_page_size', pageSize);
            
            // UI zurücksetzen und neu laden
            journalEntriesContainer.innerHTML = '';
            journalEntriesContainer.appendChild(scrollSentinel);
            scrollSentinel.textContent = '';
            categorySelect.innerHTML = '<option value="">--Bitte eine Kategorie auswählen--</option>';
            currentCategoryId = null;
            
            fetchCategories();
        }
    });

    // Modal Funktionen
    function openEditModal(entry) {
        currentEditingEntry = entry;
        
        if (entry) {
            modalTitle.textContent = 'Eintrag bearbeiten';
            deleteButton.style.display = 'block';
            editContentTextarea.value = entry.content;
            
            // Datum für datetime-local formatieren (YYYY-MM-DDTHH:mm)
            const date = new Date(entry.start_datetime);
            const offset = date.getTimezoneOffset() * 60000;
            const localIsoString = new Date(date.getTime() - offset).toISOString().slice(0, 16);
            editDateInput.value = localIsoString;

            // Enddatum formatieren
            if (entry.stop_datetime) {
                const endDate = new Date(entry.stop_datetime);
                const endOffset = endDate.getTimezoneOffset() * 60000;
                const localEndIsoString = new Date(endDate.getTime() - endOffset).toISOString().slice(0, 16);
                editEndDateInput.value = localEndIsoString;
            } else {
                editEndDateInput.value = '';
            }
        } else {
            modalTitle.textContent = 'Neuer Eintrag';
            deleteButton.style.display = 'none';
            editContentTextarea.value = '';
            
            // Aktuelles Datum setzen
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const localIsoString = new Date(now.getTime() - offset).toISOString().slice(0, 16);
            editDateInput.value = localIsoString;
            editEndDateInput.value = '';
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

    async function deleteEntry() {
        if (!currentEditingEntry) return;

        try {
            const response = await fetch(`${apiUrl}/journalentries/${currentEditingEntry.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Remove entry from DOM
            const entryElement = document.querySelector(`.journal-entry[data-id="${currentEditingEntry.id}"]`);
            if (entryElement) {
                entryElement.remove();
            }

            closeEditModal();

        } catch (error) {
            console.error('Fehler beim Löschen des Eintrags:', error);
            alert('Fehler beim Löschen des Eintrags.');
        }
    }

    async function saveEntry() {
        const newContent = editContentTextarea.value;
        const newDateString = editDateInput.value;
        const newStartDatetime = new Date(newDateString).getTime();
        
        const newEndDateString = editEndDateInput.value;
        let newStopDatetime = null;
        if (newEndDateString) {
            newStopDatetime = new Date(newEndDateString).getTime();
        }

        // Ausgewählte Kategorien sammeln
        const selectedCategoryIds = Array.from(editCategoriesContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value));

        let url = `${apiUrl}/journalentries`;
        let method = 'POST';
        let entryData = {
            content: newContent,
            start_datetime: newStartDatetime,
            stop_datetime: newStopDatetime,
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

            if (currentEditingEntry) {
                // Update existing entry in DOM without reloading list
                const entryElement = document.querySelector(`.journal-entry[data-id="${currentEditingEntry.id}"]`);
                if (entryElement) {
                    const contentElement = entryElement.querySelector('.entry-content');
                    const timestampElement = entryElement.querySelector('.timestamp');
                    
                    if (contentElement) contentElement.textContent = entryData.content;
                    
                    const dateObj = new Date(entryData.start_datetime);
                    if (timestampElement) {
                        let timeString = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        if (entryData.stop_datetime) {
                            const endDateObj = new Date(entryData.stop_datetime);
                            const endTimeString = endDateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            timeString += ` - ${endTimeString}`;
                        }
                        timestampElement.textContent = timeString;
                    }

                    // Update categories display
                    let categoriesDiv = entryElement.querySelector('.entry-categories');
                    if (categoriesDiv) {
                        categoriesDiv.remove();
                    }

                    if (entryData.categoryIds && entryData.categoryIds.length > 0) {
                        const otherCategories = entryData.categoryIds
                            .filter(id => id != currentCategoryId)
                            .map(id => {
                                const cat = allCategories.find(c => c.id === id);
                                return cat ? cat.category : '';
                            })
                            .filter(name => name !== '');

                        if (otherCategories.length > 0) {
                            categoriesDiv = document.createElement('div');
                            categoriesDiv.classList.add('entry-categories');
                            
                            otherCategories.forEach(catName => {
                                const tag = document.createElement('span');
                                tag.classList.add('entry-category-tag');
                                tag.textContent = catName;
                                categoriesDiv.appendChild(tag);
                            });
                            
                            const footer = entryElement.querySelector('.entry-footer');
                            if (footer) {
                                const timestampEl = footer.querySelector('.timestamp');
                                if (timestampEl) {
                                    footer.insertBefore(categoriesDiv, timestampEl);
                                } else {
                                    footer.appendChild(categoriesDiv);
                                }
                            } else {
                                entryElement.appendChild(categoriesDiv);
                            }
                        }
                    }

                    // Update the local object so next openEditModal has correct data
                    Object.assign(currentEditingEntry, entryData);
                }
            } else {
                // UI aktualisieren (Liste neu laden)
                const categoryId = categorySelect.value;
                fetchJournalEntries(categoryId);
            }
            
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
    deleteButton.addEventListener('click', deleteEntry);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeEditModal();
        }
    });

    // Initiales Laden der Kategorien
    fetchCategories();
});
