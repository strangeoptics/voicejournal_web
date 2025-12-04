# Voice Journal Frontend

This is a simple web interface to display journal entries from a REST API.

## Prerequisites

- Node.js and npm must be installed.
- The backend REST API must be running on `http://localhost:8080`.

## Installation

1.  Open a terminal in the project root folder.
2.  Run the following command to install the dependencies:
    ```bash
    npm install
    ```

## Running the application

1.  After the installation is complete, run the following command to start the web server:
    ```bash
    npm start
    ```
2.  Open your web browser and navigate to `http://localhost:8081` (or the URL provided by `live-server` in the terminal).

## How it works

- The application fetches categories from `http://localhost:8080/categories` and populates a dropdown menu.
- When you select a category, it fetches the corresponding journal entries from `http://localhost:8080/journalentries/category/{id}`.
- The entries are displayed in a chat-like interface.
