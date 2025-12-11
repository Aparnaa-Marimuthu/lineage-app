# urls.py - Maps URL routes to corresponding view functions

from views import get_data

def register_routes(app):
    app.add_url_rule("/data", view_func=get_data, methods=["POST"])
