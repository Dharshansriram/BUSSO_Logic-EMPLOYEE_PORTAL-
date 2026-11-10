import os
import sys

# Ensure both bisso_project root and backend dir are in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from backend.core.config import settings

if __name__ == "__main__":
    print(f"Starting BUSSOLOGIC Operations API on http://localhost:{settings.PORT}...")
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
