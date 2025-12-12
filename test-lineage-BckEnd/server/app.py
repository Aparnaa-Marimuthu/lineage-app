from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask
from flask_cors import CORS
import yaml
import requests
from urls import register_routes
from database import init_db

def load_databricks_config():
    """
    Load config from environment variables (Vercel)
    OR fallback to config.yaml (local development).
    """
    host = os.getenv("DATABRICKS_HOST")
    http_path = os.getenv("DATABRICKS_HTTP_PATH")
    token = os.getenv("DATABRICKS_TOKEN")

    if host and http_path and token:
        return host, http_path, token

    try:
        with open("config.yaml", "r") as f:
            cfg = yaml.safe_load(f)
            host = cfg["databricks"]["host"]
            http_path = cfg["databricks"]["http_path"]
            token = cfg["databricks"]["token"]
            return host, http_path, token
    except Exception:
        raise ValueError(
            "Missing Databricks config. Set environment variables OR create config.yaml locally."
        )

def create_app():
    app = Flask(__name__)
    CORS(app)

    init_db()

    server_hostname, http_path, token = load_databricks_config()
    warehouse_id = http_path.split("/")[-1]

    app.config["DATABRICKS"] = {
        "base_url": f"https://{server_hostname}/api/2.0/sql/statements",
        "warehouse_id": warehouse_id,
        "token": token,
    }

    sess = requests.Session()
    sess.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    app.config["HTTP_SESSION"] = sess

    register_routes(app)
    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 3000)), debug=True)
