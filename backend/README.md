# Backend — FastAPI

## Requisitos

- Python 3.12+

## Instalación

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -e ".[dev]"
```

## Comandos

```bash
fastapi dev src/inventario/main.py   # servidor de desarrollo en http://127.0.0.1:8000/docs
pytest                               # tests
ruff check . && ruff format --check . # lint y formato
mypy src                             # tipos
```
