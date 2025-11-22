# Summary

This repository hosts the **Solar Panel Planner**, a web-based design system developed as a Bachelor's Final Degree Project. It is designed for homeowners who wish to independently assess the suitability of their building's roof for a potential solar power plant. While professional tools (like "SolarEdge Designer") exist, they are often inaccessible to the public or overly complex, and simple calculators (like "Project Sunroof") lack global coverage or detailed modeling capabilities. This system bridges that gap by providing a user-friendly 3D modeling tool accessible directly in the browser.

The system allows users to locate their property via Google Maps, draw their roof geometry in 2D, and automatically generate a 3D model. Users can then simulate solar panel placement, analyze shadow impacts based on geographical location and time, and calculate preliminary financial returns and electricity generation estimates.

The application is built using the **Django** framework for the backend and uses **Three.js** for sophisticated 3D visualization on the client side. The project includes 5 core subsystems covering authentication, solar element management, budget constraints, simulation, and visualization. It serves as a functional prototype to help users bypass the initial, often lengthy, consultation phase with contractors by providing immediate, visual feasibility data.

# Features

- **WEB CAD Modeling:** Draw roof perimeters on a 2D Google Map and instantly visualize them in a 3D environment.
- **Solar Efficiency Analysis:** Heatmap visualization indicating the most efficient roof planes based on solar radiation and orientation.
- **Shadow Simulation:** Real-time sun positioning and shadow casting based on specific dates and times.
- **Automated Panel Placement:** Algorithms that automatically fill roof areas with solar panels, prioritizing high-efficiency zones within budget or power limits.
- **Financial & Generation Estimates:** Calculation of monthly electricity generation, ROI, and total installation costs.
- **Custom Hardware:** Ability to define custom solar panel specifications (dimensions, wattage, price).
- **Obstacle Management:** Tools to draw and exclude areas (chimneys, vents) from panel placement.
- **Project Management:** User accounts to save, edit, and manage multiple design projects.

# Technology Stack

- **Backend:** Django 5.1.3 (Python 3.13)
- **Database:** SQLite (Development), extensible to PostgreSQL
- **Frontend:** JavaScript (ES6+), Webpack 5
- **3D Visualization:** Three.js 0.173.0
- **Mapping APIs:** Google Maps JavaScript API, OpenStreetMap (OSM) API (for building height data)
- **Styling:** SCSS/CSS
- **Code Quality:** Ruff (Python), ESLint (JS)

# Installation

The system is designed to run on a local server (Ubuntu/Linux recommended).

**Prerequisites:**
* Python 3.12+
* Node.js 22+ & npm
* Google Maps API Key

**Setup Steps:**

1.  **Clone the repository and navigate to the dev folder:**
    ```bash
    git clone [your-repo-link]
    cd dev
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm ci
    ```

3.  **Setup Python Environment:**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip3 install -r requirements.txt
    ```

4.  **Initialize Database:**
    ```bash
    python3 manage.py makemigrations
    python3 manage.py migrate
    ```

5.  **Create Admin User (Optional):**
    ```bash
    python3 manage.py createsuperuser
    ```

6.  **Run the Application:**
    You will need two terminal instances:
    * Terminal 1 (Frontend build): `npm run dev`
    * Terminal 2 (Backend server): `python3 manage.py runserver`

# Usage

- Access the system at `http://127.0.0.1:8000/solar/map`.
- **Guest Mode:** Create one project immediately to test the features.
- **Registered User:** Sign up to save up to 10 projects.
- **Workflow:**
    1.  Create a new project.
    2.  Find your building on the 2D map.
    3.  Draw the roof edges (points) on the map.
    4.  Switch to 3D view to adjust roof height and vertex positions.
    5.  Select roof planes to automatically place solar panels.
    6.  View the "Statistics" modal for financial and energy insights.

# Research & Analysis

This project is backed by a 95-page Bachelor's thesis involving:
- **Market Analysis:** Detailed comparison of solutions like *PVsyst*, *SolarEdge*, and *Project Sunroof*, identifying the lack of consumer-accessible 3D design tools.
- **Mathematical Modeling:** Implementation of geometry logic for roof pitch, vertex manipulation, and solar irradiance calculations.
- **Testing:** Extensive integration testing (75% backend code coverage) and automated UI testing using "Katalon Recorder".
- **Validation:** Usability testing to ensure the interface is intuitive for non-engineers.

# Project Structure

The repository is organized into a modular Django application structure:

- `dev/` – Main development environment and configuration.
  - `modules/solar/` – The core application logic.
    - `models/` – Database schemas for `SolarProject`, `SolarPanel`, and User profiles.
    - `views/` – API endpoints and view controllers.
    - `js/` – The heavy-lifting frontend logic, including:
      - `3D View` – Three.js scene management.
      - `2D View` – Google Maps integration.
      - `Simulation` – Solar path and shadow logic.
  - `core/` – Authentication and base system utilities.
  - `pub/` – Compiled static assets (Webpack output).

# License

This project is provided for educational and demonstration purposes as part of a Bachelor's degree curriculum at Kaunas University of Technology.

# Contact

**Lukas Navickas** - https://www.linkedin.com/in/lukas-navickas-013a91224

# Visuals

Below are screenshots demonstrating the design process within the system.

<table>
  <tr>
    <td align="center"><b>Main Interface (Split View)</b><br><i>Drawing in 2D while visualizing in 3D</i><br><img width="400" alt="image" src="https://github.com/user-attachments/assets/972b8a11-cb74-41f9-8794-eda63a2d98ee" />
</td>
    <td align="center"><b>3D Roof Modeling</b><br><i>Adjusting roof vertices and height</i><br><img src="images/image-2.png" width="420"></td>
  </tr>
  <tr>
    <td align="center"><b>Solar Panel Placement</b><br><i>Automatic layout on selected planes</i><br><img src="images/image-3.png" width="420"></td>
    <td align="center"><b>Efficiency Heatmap</b><br><i>Visualizing optimal areas for energy generation</i><br><img src="images/image-4.png" width="420"></td>
  </tr>
  <tr>
    <td align="center"><b>Shadow Simulation</b><br><i>Real-time shadow analysis based on time of day</i><br><img src="images/image-5.png" width="420"></td>
    <td align="center"><b>Obstacle Management</b><br><i>Defining chimneys and vents to avoid panel overlap</i><br><img src="images/image-6.png" width="420"></td>
  </tr>
  <tr>
    <td align="center"><b>Project Statistics</b><br><i>Monthly generation forecast</i><br><img src="images/image-7.png" width="420"></td>
    <td align="center"><b>Financial Analysis</b><br><i>ROI and installation cost estimation</i><br><img src="images/image-8.png" width="420"></td>
  </tr>
</table>
