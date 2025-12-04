document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('category-select');
    const journalEntriesContainer = document.getElementById('journal-entries');
    const apiUrl = 'http://localhost:8080';

    // Kategorien laden und Dropdown füllen
    async function fetchCategories() {
        try {
            const response = await fetch(`${apiUrl}/categories`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const categories = await response.json();
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
    async function fetchJournalEntries(categoryId) {
        if (!categoryId) {
            journalEntriesContainer.innerHTML = '';
            return;
        }
        journalEntriesContainer.innerHTML = '<p>Lade Einträge...</p>';
        try {
            const response = await fetch(`${apiUrl}/journalentries/category/${categoryId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const entries = await response.json();
            displayJournalEntries(entries);
        } catch (error)
        {
            console.error(`Fehler beim Laden der Journal-Einträge für Kategorie ${categoryId}:`, error);
            journalEntriesContainer.innerHTML = `<p>Fehler beim Laden der Einträge für die ausgewählte Kategorie.</p>`;
        }
    }

    // Journal-Einträge als Chat-Liste anzeigen
    function displayJournalEntries(entries) {
        journalEntriesContainer.innerHTML = '';
        if (entries.length === 0) {
            journalEntriesContainer.innerHTML = '<p>Keine Einträge für diese Kategorie gefunden.</p>';
            return;
        }

        entries
            .sort((a, b) => a.timestamp - b.timestamp) // Nach Zeitstempel sortieren
            .forEach(entry => {
                const bubble = document.createElement('div');
                bubble.classList.add('chat-bubble', 'right');

                const content = document.createElement('div');
                content.textContent = entry.content;

                const timestamp = document.createElement('span');
                timestamp.classList.add('timestamp');
                timestamp.textContent = new Date(entry.timestamp).toLocaleString('de-DE');

                bubble.appendChild(content);
                bubble.appendChild(timestamp);
                journalEntriesContainer.appendChild(bubble);
            });
    }

    // Event Listener für das Dropdown
    categorySelect.addEventListener('change', (event) => {
        const categoryId = event.target.value;
        fetchJournalEntries(categoryId);
    });

    // Initiales Laden der Kategorien
    fetchCategories();
});
