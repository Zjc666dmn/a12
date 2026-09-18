from sqlalchemy import inspect, text

from app.db.session import engine


TASK_INTENT_COLUMNS = {
    "teaching_topic": "VARCHAR(200)",
    "knowledge_points": "TEXT",
    "key_difficulties": "TEXT",
    "interaction_design": "TEXT",
    "intent_status": "VARCHAR(50) NOT NULL DEFAULT 'draft'",
    "intent_confidence": "VARCHAR(20)",
}

UPLOADED_FILE_COLUMNS = {
    "purpose": "VARCHAR(50) NOT NULL DEFAULT 'content'",
    "focus": "TEXT",
}


def ensure_task_intent_columns() -> None:
    inspector = inspect(engine)
    if "course_tasks" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("course_tasks")}
    missing_columns = [
        (name, column_type)
        for name, column_type in TASK_INTENT_COLUMNS.items()
        if name not in existing_columns
    ]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for name, column_type in missing_columns:
            connection.execute(text(f"ALTER TABLE course_tasks ADD COLUMN {name} {column_type}"))


def ensure_uploaded_file_columns() -> None:
    inspector = inspect(engine)
    if "uploaded_files" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("uploaded_files")}
    with engine.begin() as connection:
        for name, column_type in UPLOADED_FILE_COLUMNS.items():
            if name not in existing_columns:
                connection.execute(text(f"ALTER TABLE uploaded_files ADD COLUMN {name} {column_type}"))
