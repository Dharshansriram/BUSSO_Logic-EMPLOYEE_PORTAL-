import os
import sys

# Ensure both bisso_project root and backend dir are in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
backend_dir = os.path.join(current_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from backend.core.config import settings

if __name__ == "__main__":
    print(f"Starting BUSSOLOGIC Operations API on http://localhost:{settings.PORT}...")
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
