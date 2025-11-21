#!/bin/bash

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
BLUE="\e[34m"
BOLD="\e[1m"
RESET="\e[0m"

cd "$PWD" || exit 1
echo -e "${BOLD}${BLUE}Checking system dependencies...${RESET}\n"

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "✅ ${GREEN}$1${RESET} is installed: ${YELLOW}$("$1" --version | head -n 1)${RESET}."
    else
        echo -e "❌ ${RED}$1${RESET} is ${BOLD}NOT installed.${RESET}."
        if [[ "$1" == "node" ]]; then
            echo -e "   Install it via: ${BLUE}https://nodejs.org/${RESET}."
        elif [[ "$1" == "npm" ]]; then
            echo -e "   Install Node.js (includes npm): ${BLUE}https://nodejs.org/${RESET}."
        elif [[ "$1" == "python" ]]; then
            echo -e "   Install it via: ${BLUE}https://www.python.org/downloads/${RESET}."
        elif [[ "$1" == "pip" ]]; then
            echo -e "   Install it via: ${BOLD}sudo apt install python3-pip${RESET}."
        fi
    fi
}

check_npm_dir() {
    DIR=node_modules/

    if [[ -d "$DIR" && "$(ls -A "$DIR")" ]]; then
        echo -e "✅ ${GREEN}node_modules${RESET} directory exists."
    else
        echo -e "❌ ${RED}node_modules${RESET} directory does NOT exist."
    fi
}

check_venv_dir() {
    if test -f .venv/bin/python3; then
        echo -e "✅ ${GREEN}.venv${RESET} virtual environment directory exists."
    else
        echo -e "❌ ${RED}.venv${RESET} virtual environment directory does NOT exist."
    fi
}

check_command node
check_command npm
check_npm_dir
check_command python
check_command pip
check_venv_dir

echo -e "\n${GREEN}✅ Dependency check completed.${RESET}"
