# Project Architecture: "The Factory & The Sandbox"

This document outlines the directory structure and development philosophy of the Orange Dev Tracker. To ensure stability during rapid iteration, the project follows a **"Core vs. Lab"** (Sandbox-to-Production) lifecycle.

## 🏗 Directory Structure

### 1. `code/` (The Factory)
This is where the logic lives. It is partitioned by stability:
*   **`code/core/`**: Production-ready data pipelines. Scripts here are expected to be stable and are used to rebuild the main dashboard.
*   **`code/governance/`**: Logic for high-complexity domain data (BIPs, Mailing Lists). This is "Infrastructure" that supports both core and lab features.
*   **`code/lib/`**: Shared Python utilities, constants, and logging handlers.

### 2. Remote Data Integration
The tracker does not store data locally. Instead, it relies on pre-processed artifacts fetched directly from the [Orange Dev Data](https://github.com/sorukumar/orange-dev-data) repository. The frontend uses a dynamic `DATA_PATH_PREFIX` (defined in `js/utils.js`) to point to the remote `output/` directory, ensuring the visualizations always reflect the latest processed statistics.

### 3. `lab/` (The Sandbox)
This is the area for rapid UI and functional prototyping. Each sub-folder is a "Feature Bundle":
*   **`lab/gloria/`**: Experimental Maintainer Spotlight. Contains its own `story.html` and `prep.py`.
*   **`lab/bips/`**: Early-stage Governance Dashboard.

### 4. `analysis/` (The Scratchpad)
One-off research scripts, debug tools, and insight generators that are not part of the monthly production cron job.

### 5. Root Directory (The Showroom)
Only stable, deployment-ready HTML files live in the root (e.g., `story.html`, `index.html`, and `reports.html` — the unlisted State of Bitcoin Core monthly report archive; its 6 slides are rendered by `scripts/reports.js`, which `report-card.html` also uses as the headless canvas Playwright captures for the social decks).

---

## 🛠 Development Workflow: "Graduation"

New features should follow this lifecycle to ensure the repository remains clean and the main dashboard stays functional:

1.  **Exploration**: Create a script in `analysis/` to test a hypothesis or extract a new dataset.
2.  **Sandbox (The Lab)**:
    *   Create a folder in `lab/feature_name/`.
    *   Develop the UI (`story.html`) and local data prep logic (`prep.py`) there.
    *   Write experimental data to `data/lab/`.
3.  **Refinement**: Iterate until the feature is stable and visually polished.
4.  **Graduation (Production)**:
    *   Move the HTML from `lab/.../story.html` to root (e.g., `feature.html`).
    *   Move logic from `lab/.../prep.py` to `code/core/`.
    *   Update data outputs to write to `data/core/`.
    *   Integrate the graduated script into the main `rebuild.py`.

---

## 💡 Guidelines for LLMs & Collaborators

*   **Respect the Prefix**: Frontend JS must use `DATA_PATH_PREFIX` (defined in `js/utils.js`) for all `fetch` calls to ensure they work at any directory depth.
*   **No Root Pollution**: Do not add new `.html` files to the root until they have been validated in the `lab/`.
*   **Data Isolation**: All data generation happens in the `orange-dev-data` repository. Ensure that local lab scripts fetch data from the appropriate remote paths or use local mock data temporarily.
