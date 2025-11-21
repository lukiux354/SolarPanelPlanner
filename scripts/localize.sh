#!/bin/bash

. .venv/bin/activate
python dev/manage.py makemessages -l en
python dev/manage.py compilemessages
