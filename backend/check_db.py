from sqlalchemy import text
from app.session import SessionLocal

db = SessionLocal()
rows = db.execute(text("""
    SELECT table_name, column_name, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND (column_name ILIKE '%embedding%' OR udt_name = 'vector')
"""))
for r in rows:
    print(r)
