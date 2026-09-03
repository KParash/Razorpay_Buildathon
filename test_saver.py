import asyncio
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

async def main():
    async with AsyncSqliteSaver.from_conn_string("state.db") as memory:
        print("Works with async with:", memory)

asyncio.run(main())
