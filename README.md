# Interactive Course Dependency Graph

A web-based interactive graph for Computer Science and Information Systems students to track their courses, prerequisites, and academic paths. Built using vanilla JavaScript and D3.js (v7).

## Features

- **Dynamic Text Fitting:** Node sizes adjust automatically based on the length of the course name to avoid text clipping.
- **Smart Path Highlighting:** Clicking any course instantly highlights its prerequisites and future unlocked courses in yellow.
- **Persistent Selection:** Clicking on the empty background won't reset your current view, allowing you to focus on the selected path.
- **Visual Flow:** Active paths feature slightly larger arrowheads to easily follow the course direction.

## Project Structure

- `index.html` - The dashboard layout, styling, and sidebar panel.
- `graph.js` - D3.js rendering logic, node positioning, and click events.
- `graph.json` - The database file containing the list of courses (nodes) and relations (links).

## How to Run the Project

Because the project loads the dataset asynchronously via JavaScript (`d3.json`), opening `index.html` directly by double-clicking it will cause a CORS error in your browser.

To run it properly, you need a quick local server. Choose one of these simple methods:

### Method 1: VS Code (Easiest)

1. Open the project folder in **VS Code**.
2. Install the **Live Server** extension.
3. Click the **Go Live** button at the bottom right of the window, or right-click `index.html` and choose **Open with Live Server**.

### Method 2: Python (Command Line)

1. Open your terminal or command prompt inside the project folder.
2. Run the following command:
   ```bash
   python -m http.server 8000
   ```
