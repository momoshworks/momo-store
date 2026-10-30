import sys
import uvicorn
from app.config import HOST, PORT

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

if __name__ == "__main__":
    print(f"Starting MOMO store server...")
    print(f"Web interface: http://localhost:{PORT}")
    print(f"API Docs: http://localhost:{PORT}/docs")
    print(f"Catalog JSON: http://localhost:{PORT}/api/catalog.json")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)
