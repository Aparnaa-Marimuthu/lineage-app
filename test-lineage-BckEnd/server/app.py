# app.py - Initializes Flask app, loads config, and registers routes

from flask import Flask
from flask_cors import CORS
import yaml
import requests
import os
from urls import register_routes

def create_app():
    app = Flask(__name__)
    CORS(app)  

    with open("config.yaml", "r") as f:
        cfg = yaml.safe_load(f)

    server_hostname = cfg["databricks"].get("host")
    http_path = cfg["databricks"].get("http_path")
    token = cfg["databricks"].get("token")

    if not server_hostname or not http_path or not token:
        raise ValueError("Missing config values. Check config.yaml for host, http_path, and token.")

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

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 3000))
    # Flask dev server — fine for local; use a WSGI server in prod
    app.run(host="0.0.0.0", port=port, debug=True)
