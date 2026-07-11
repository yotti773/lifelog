FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY login_local.py .
ENTRYPOINT ["python", "login_local.py"]
