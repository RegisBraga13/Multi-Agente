# Servidor da consulta (FastAPI). Roda igual no computador e em qualquer nuvem.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/backend

COPY pyproject.toml ./
COPY app ./app
COPY casos_de_teste ./casos_de_teste
COPY banco_local ./banco_local
RUN pip install --no-cache-dir . && useradd --create-home especialista

USER especialista
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
