from views import (
    get_data, 
    get_user_settings, 
    save_user_settings, 
    delete_user_settings
)

def register_routes(app):
    app.add_url_rule("/data", view_func=get_data, methods=["POST"])

    app.add_url_rule(
        "/api/user-settings/<user_id>", 
        view_func=get_user_settings, 
        methods=["GET"]
    )
    app.add_url_rule(
        "/api/user-settings/<user_id>", 
        view_func=save_user_settings, 
        methods=["POST"]
    )
    app.add_url_rule(
        "/api/user-settings/<user_id>", 
        view_func=delete_user_settings, 
        methods=["DELETE"]
    )
