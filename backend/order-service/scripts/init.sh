#!/bin/bash

# Variables
DB_NAME="postgres"
DB_USER="postgres"
SQL_FILE="init.sql"

# Run the SQL file
psql -U $DB_USER -d $DB_NAME -f $SQL_FILE