# Solar Panel Planner

## Summary

This repository presents the **Solar Panel Planner**, a web-based solar power plant design system developed as a final bachelor's degree project. [cite_start]The system is designed for homeowners and non-professionals who wish to assess the suitability of their building's roof for a potential solar power plant without needing expensive professional software or waiting months for contractor estimates[cite: 42, 45, 47, 60, 104].

The primary goal of this project is to democratize access to solar planning tools. [cite_start]While professional tools like "SolarEdge Designer" exist, they are often inaccessible to private users or require significant technical knowledge [cite: 47, 136-139]. [cite_start]The "Solar Panel Planner" addresses this by providing a free, intuitive, and accessible interface for modeling roofs in 3D, analyzing solar efficiency, and calculating preliminary financial and energy production metrics [cite: 131-133, 143-145].

[cite_start]The system allows users to locate their property on a 2D map, draw the roof perimeter, and automatically generate a 3D model[cite: 118, 176]. [cite_start]It then simulates solar radiation to identify the most efficient roof planes and provides detailed reports on electricity generation, costs, and payback periods [cite: 43-44, 58-59]. [cite_start]The project is currently a working prototype implemented with Django and Three.js, with architecture in place for future expansion [cite: 49-50, 64-66].

## Features

- [cite_start]**WEB CAD Modeling:** Draw roof perimeters on a 2D Google Maps interface and automatically generate manipulable 3D models[cite: 39, 118, 176].
- [cite_start]**Efficiency Analysis:** Visual color-coding of roof planes (green to red) to indicate optimal placement for solar panels based on direct solar radiation [cite: 318, 635-636].
- [cite_start]**Solar Simulation:** Real-time 3D simulation of the sun's position based on date/time, allowing users to visualize potential shadowing from obstacles [cite: 333-337, 646-648].
- [cite_start]**Financial & Energy Analytics:** Automatic calculation of monthly power generation forecasts, total system cost, and investment payback period [cite: 44, 59, 339-341].
- [cite_start]**Custom Constraints:** Users can set specific budgets (in Euros) or power goals (in Watts), and the system will prioritize the most efficient roof areas [cite: 161-162, 296-299].
- [cite_start]**Solar Element Management:** Create, edit, delete, and rotate custom solar panel models with specific dimensions and power ratings[cite: 251, 256, 277].
- [cite_start]**User System:** Role-based access supporting "Guests" (1 project limit) and registered "Users" (10 project limit) [cite: 205-208, 616].

## Technology Stack

- [cite_start]**Backend:** Python 3.13.2, Django 5.1.3, Django REST Framework 3.14.0 [cite: 470-471].
- [cite_start]**Frontend:** JavaScript, Three.js 0.173.0 (for 3D visualization), Webpack 5.98.0, SCSS [cite: 472-473].
- [cite_start]**Database:** SQLite 3.43.2[cite: 471].
- [cite_start]**External APIs:** - **Google Maps API** (2D mapping and address search)[cite: 210, 347].
  - [cite_start]**OpenStreetMap (OSM) API** (Building height data retrieval)[cite: 209, 288].
- [cite_start]**Tools:** Ruff (code analysis), ESLint, AWS CodeCommit[cite: 471, 473].

## Installation

To run this project locally, you will need Python and Node.js installed.

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd solar-panel-planner
    ```

2.  **Install Frontend Dependencies:**
    [cite_start]Navigate to the project folder and install the JavaScript packages[cite: 695].
    ```bash
    npm ci
    ```

3.  **Set up the Python Environment:**
    [cite_start]Create a virtual environment and install the requirements[cite: 697].
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
    pip3 install -r requirements.txt
    ```

4.  **Database Setup:**
    [cite_start]Initialize the SQLite database[cite: 697].
    ```bash
    python3 dev/manage.py makemigrations
    python3 dev/manage.py migrate
    ```

5.  **Create Admin User:**
    ```bash
    python3 dev/manage.py createsuperuser
    ```

6.  **Run the System:**
    [cite_start]You will need two terminals to run the backend server and the frontend bundler simultaneously[cite: 698].
    
    *Terminal 1:*
    ```bash
    npm run dev
    ```
    
    *Terminal 2:*
    ```bash
    python3 manage.py runserver
    ```

## Usage

- [cite_start]Access the system in your browser at `http://127.0.0.1:8000/solar/map`[cite: 698].
- [cite_start]Access the admin panel at `http://127.0.0.1:8000/admin`[cite: 699].
- **Getting Started:** Click "+ Create New Project". Search for an address, then click on the 2D map to draw the corners of a roof plane. [cite_start]Close the shape to generate the 3D model [cite: 591, 602-608].
- **Designing:** Switch to 3D view. Adjust roof heights by dragging vertices. [cite_start]Click on roof planes to "select" them for panel placement [cite: 613-614, 628-630].
- [cite_start]**Analysis:** Use the settings menu to toggle "Efficiency Mode" to see heatmaps or open the "Statistics" window for detailed charts[cite: 635, 660].

## Research & Analysis

[cite_start]This project is based on a 95-page bachelor's thesis "Solar Power Plant Design System"[cite: 36, 40]. The development process included:
- [cite_start]**Market Analysis:** Comparison with "SolarEdge Designer", "PVsyst", and "Project Sunroof" to identify the need for a free, beginner-friendly tool [cite: 135-170].
- [cite_start]**System Design:** Creation of 29 use cases and comprehensive UML diagrams (Sequence, Activity, Class, Deployment)[cite: 211, 467].
- **Testing:**
  - [cite_start]**Static Analysis:** Using ESLint (82 initial errors fixed) and Ruff (~40 initial errors fixed)[cite: 529, 534].
  - [cite_start]**Integration Testing:** 44 backend tests covering 75% of the server-side code using Django's test framework [cite: 541-545].
  - [cite_start]**UI Testing:** Automated scenarios using "Katalon Recorder" and manual testing for complex 3D manipulations [cite: 546-552].

## Project Structure

[cite_start]The system follows the Django MVT (Model-View-Template) pattern and is divided into 5 main subsystems[cite: 96, 211]:

- `modules/solar/` – The core Django application containing the logic.
  - [cite_start]`models/` – Database models including `SolarProject` and `SolarPanel`[cite: 482].
  - [cite_start]`views/` – Backend logic for API handling and rendering[cite: 497].
  - [cite_start]`static/js/` – Frontend logic using Three.js for the 3D environment[cite: 498].
  - [cite_start]`tests/` – Integration tests[cite: 496].
- [cite_start]`core/uauth/` – Authentication and authorization logic[cite: 494].

## Customization

The system is designed as a prototype with extensibility in mind. [cite_start]Future improvements could include tree shadowing simulation, weather API integration, and selling-to-grid financial calculations[cite: 713].

## License

[cite_start]This project was created as a Bachelor's Final Degree Project at Kaunas University of Technology, Faculty of Informatics[cite: 2, 15].

## Contact

[cite_start]**Author:** Lukas Navickas [cite: 17]  
**Supervisor:** Asist. [cite_start]Dr. Mikas Binkis [cite: 19]

## Visuals

Below are screenshots of the system in action.

<table>
  <tr>
    <td align="center"><b>Main Interface (Split View)</b><br><img src="images/main_interface.png" width="420" alt="2D and 3D view split"></td>
    <td align="center"><b>3D Efficiency Analysis</b><br><img src="images/efficiency_mode.png" width="420" alt="Heatmap of roof efficiency"></td>
  </tr>
  <tr>
    <td align="center"><b>Roof Drawing (2D)</b><br><img src="images/drawing_2d.png" width="420" alt="Drawing roof on map"></td>
    <td align="center"><b>Solar Simulation</b><br><img src="images/simulation.png" width="420" alt="Shadow simulation"></td>
  </tr>
  <tr>
    <td align="center"><b>Project Statistics</b><br><img src="images/statistics.png" width="420" alt="Financial and power stats"></td>
    <td align="center"><b>Panel Configuration</b><br><img src="images/panel_config.png" width="420" alt="Editing solar panels"></td>
  </tr>
</table>
