from flask import request, jsonify, current_app
import requests
from database import get_settings, save_settings, delete_settings

def get_data():
    """
    POST /data
    Body: { "query": "" }
    Calls Databricks SQL Statements API and returns { columns: [...], rows: [...] }.
    """
    try:
        body = request.get_json(silent=True) or {}
        query = body.get("query")

        if not query or not isinstance(query, str):
            return jsonify({"error": "Missing or invalid query in request body"}), 400

        dbx = current_app.config["DATABRICKS"]
        session = current_app.config["HTTP_SESSION"]

        payload = {
            "statement": query,
            "warehouse_id": dbx["warehouse_id"],
            "wait_timeout": "50s",
            "on_wait_timeout": "CANCEL",
            "result_format": "JSON",
        }

        resp = session.post(dbx["base_url"], json=payload, timeout=60)

        if not resp.ok:
            return jsonify({
                "error": f"Databricks API error: {resp.status_code} {resp.reason}"
            }), resp.status_code

        result = resp.json()
        schema = [c["name"] for c in result.get("manifest", {}).get("schema", {}).get("columns", [])]
        rows = result.get("result", {}).get("data_array", [])

        formatted_rows = [
            {schema[i]: v for i, v in enumerate(row)}
            for row in rows
        ]

        return jsonify({"columns": schema, "rows": formatted_rows})

    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Databricks query failed (network)",
            "details": str(e),
        }), 502

    except Exception as e:
        return jsonify({
            "error": "Databricks query failed",
            "details": str(e),
        }), 500

def get_user_settings(user_id):
    """GET /api/user-settings/<user_id>"""
    try:
        settings = get_settings(user_id)
        
        if not settings:
            return jsonify({"message": "No settings found"}), 404
        
        return jsonify(settings), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch settings",
            "details": str(e)
        }), 500


def save_user_settings(user_id):
    """POST /api/user-settings/<user_id>"""
    try:
        body = request.get_json(silent=True) or {}
        
        if not body or len(body) == 0:
            return jsonify({"error": "Settings data is required"}), 400
        
        updated_at = save_settings(user_id, body)
        
        return jsonify({
            "message": "Settings saved successfully",
            "userId": user_id,
            "savedAt": updated_at
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to save settings",
            "details": str(e)
        }), 500


def delete_user_settings(user_id):
    """DELETE /api/user-settings/<user_id>"""
    try:
        deleted_count = delete_settings(user_id)
        
        return jsonify({
            "message": "Settings deleted successfully",
            "userId": user_id,
            "deletedRows": deleted_count
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to delete settings",
            "details": str(e)
        }), 500
