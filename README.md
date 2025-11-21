# Welcome to OSOM.Codex Sandbox!

## Getting started
Follow the steps below to set up the project for the first time. After completing the setup, check the [Development](#development) section for instructions on running the project.

### 1. Install dependencies
#### JavaScript
Run the following command to install the required dependencies:
```sh
npm ci
```
#### Python
Set up a virtual environment and install the necessary packages:
```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### 2. Initialize the database
Create migration files and apply them to set up the database tables:
```sh
python dev/manage.py makemigrations
python dev/manage.py migrate
```

### 3. Create a default user
Create an admin user to log in to the system. Replace `<name>` with an appropriate value:
```sh
DJANGO_SUPERUSER_PASSWORD="Secret#Web#Dev" python dev/manage.py createsuperuser --no-input --username lukn --email lukn@dev.indeform.com
```

## Development
### Start development servers
1. Start the Webpack bundler to compile front-end assets and watch for changes:
    ```sh
    npm run dev
    ```
2. Start the Django development server:
    ```sh
    python dev/manage.py runserver
    ```
    To run the server with a debugger ([debugpy](https://github.com/microsoft/debugpy)) support:
    ```
    python -Xfrozen_modules=off -m debugpy --listen localhost:5678 dev/manage.py runserver
    ```
    * **VS Code users:** To use a debugger through the IDE, put the configuration below into `.vscode/launch.json`. Then start the Django web  server as described above, open "Run and Debug" tab and run "Attach to Django" task which will connect to the debugger server.
    ```
    {
        "version": "0.2.0",
        "configurations": [
            {
                "name": "Attach to Django",
                "type": "debugpy",
                "request": "attach",
                "connect": {
                    "host": "localhost",
                    "port": 5678
                },
                "justMyCode": true
            }
        ]
    }
    ```

## Creating modules
### 1. Generate a new module
Run the following command to create a new Django app (module). Replace `<module>` with the module name (e.g., `analytics`):
```sh
mkdir -p dev/modules/<module> && python dev/manage.py startapp <module> dev/modules/<module>
```

### 2. Configure the module
Follow these steps to integrate the new module into the project:

#### a. Update `apps.py`
Ensure the module follows our naming convention by adding the `module.` prefix to a `name` in `dev/modules/<module>/apps.py`:
```python
from django.apps import AppConfig

class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'module.analytics'
```

#### b. Register the module in `INSTALLED_APPS`
Add the module to the `INSTALLED_APPS` list in [`dev/main/settings.py`](dev/main/settings.py). For example, following the `analytics` app example:
```python
INSTALLED_APPS = [
    ...
    "django.contrib.staticfiles",
    "modules.analytics",
    ...
]
```

#### c. Include module URLs
If the module exposes API endpoints, include them in the `urlpatterns` list in [`dev/main/urls.py`](dev/main/urls.py):
```python
urlpatterns = [
    ...
    path("analytics/", include("modules.analytics.urls", namespace="modules/analytics")),
    ...
]
```

## Formatting and linting
### JavaScript / TypeScript
#### Setup
Ensure that dependencies from `package.json` are installed. Use an appropriate IDE extension for automatic linting and formatting.
- **VS Code users:** Install the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extension and set ESLint as the default formatter for `.js` and `.ts` files.

#### Usage
- Show formatting issues:
  ```sh
  npm run lint
  ```
- Fix formatting issues:
  ```sh
  npm run lint:fix
  ```
  *(Some issues may need to be fixed manually.)*

### Python
#### Setup
The project uses [Ruff](https://docs.astral.sh/ruff/) as the linter and formatter. Ensure all dependencies from `requirements.txt` are installed.
- **VS Code users:** Install the [Ruff](https://marketplace.visualstudio.com/items?itemName=charliermarsh.ruff) extension. If Ruff doesn't work, check if `ruff.interpreter` is using the Python executable from your virtual environment.

#### Usage
- Format source files:
  ```sh
  ruff format
  ```
- Run static analysis and check for code style issues:
  ```sh
  ruff check
  ```
  *(Avoid running `ruff check . --fix` on all files, as it may introduce unnecessary changes.)*

## Scripts
Directory [scripts/](/scripts/) contain some convenience scripts to make some actions easier.
- [./scripts/doctor](./scripts/doctor) - check if all required development tools are installed and view their versions.
- [./scripts/install](./scripts/install) - install all project dependencies, create and activate Python virtual environment.
- [./scripts/localize](./scripts/localize) - create localization files for specified languages and compile them. You will need to update localization command arguments within the script to include required languages.

    *(Run `chmod +x ./scripts/<script>` to make the script executable.)*

## Troubleshooting
If something doesn't work, check that all required development tools and project dependencies are installed. Run the following command to check for missing dependencies automatically:
```sh
./scripts/doctor
```
This script will verify if all required tools are installed and display their versions.

### Recommended versions
The project is known to work with the following versions:
```
NodeJS: v22.11.0
NPM: 10.9.0
Python: 3.13.2
Pip: 25.0.1
```
