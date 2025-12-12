import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    """Get PostgreSQL connection from environment variable"""
    database_url = os.getenv('POSTGRES_URL')
    
    if not database_url:
        raise ValueError("POSTGRES_URL environment variable not set")
    
    return psycopg2.connect(database_url, sslmode='require')

def init_db():
    """Initialize database and create table if it doesn't exist"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id VARCHAR(255) PRIMARY KEY,
                settings TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        cursor.close()
        conn.close()
        print(" PostgreSQL database initialized successfully")
    except Exception as e:
        print(f" Database initialization: {e}")
        pass

def get_settings(user_id):
    """Get settings for a user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            'SELECT settings FROM user_settings WHERE user_id = %s',
            (user_id,)
        )
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return json.loads(row['settings'])
        return None
    except Exception as e:
        print(f" Error fetching settings: {e}")
        return None

def save_settings(user_id, settings_dict):
    """Save or update settings for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    settings_json = json.dumps(settings_dict)
    updated_at = datetime.utcnow()
    
    cursor.execute('''
        INSERT INTO user_settings (user_id, settings, updated_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id) 
        DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at
    ''', (user_id, settings_json, updated_at))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return updated_at.isoformat()

def delete_settings(user_id):
    """Delete settings for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'DELETE FROM user_settings WHERE user_id = %s',
        (user_id,)
    )
    
    deleted_count = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    
    return deleted_count
