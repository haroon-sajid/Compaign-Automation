## Requirements
Python 3.11
Redis

# Database Setup (PostgreSQL on Ubuntu)

# Open PostgreSQL as the postgres user:

sudo -u postgres psql


# Create a database user:

CREATE USER campaign_user WITH PASSWORD 'campaign_pass';

# Create a database owned by this user:

CREATE DATABASE campaign_db OWNER campaign_user;

# Connect to the database:

\c campaign_db

# Ensure the user owns the schema and has full privileges:

ALTER SCHEMA public OWNER TO campaign_user;
GRANT ALL PRIVILEGES ON DATABASE campaign_db TO campaign_user;
GRANT ALL ON SCHEMA public TO campaign_user;

# Installation

# Unzip the project folder.

# Navigate to the project directory:

cd campaign-automation


# Install dependencies:

pip install -r server_requirements.txt
pip install -r requirements.txt

# Database Migration & Seeding

# Run the following commands to set up database tables and seed initial data:

python manage.py makemigrations
python manage.py migrate
python manage.py seedplans

# Running the Server

# Start the development server:

python manage.py runserver


# Redis & Celery Setup

# Install Redis (Ubuntu example):

sudo apt update
sudo apt install redis-server


# Start Redis service:

sudo systemctl enable redis-server
sudo systemctl start redis-server


# Run Celery worker (from the project root):
celery -A campaign worker -B -l info
