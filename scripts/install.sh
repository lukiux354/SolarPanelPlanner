#!/bin/bash

# Python dependencies.
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pip install --upgrade pip

# JS dependencies.
npm ci

echo "Done installing dependencies!"
