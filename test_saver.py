import os
from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver

load_dotenv(override=True)

DB_URI = os.environ.get("DATABASE_URL")
if not DB_URI:
    raise RuntimeError("DATABASE_URL environment variable is required.")

def main():
    with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
        checkpointer.setup()
        print("PostgresSaver connected and tables ready:", checkpointer)

main()
