# views.py - Defines request handlers (logic for each API endpoint)

from flask import request, jsonify, current_app
import requests

def get_data():
    """
    POST /data
    Body: { "query": "<SQL here>" }
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

