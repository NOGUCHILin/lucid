FROM python:3.12-slim

WORKDIR /app

# Install git and build dependencies
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Clone graphiti server source
RUN git clone --depth 1 https://github.com/getzep/graphiti.git /tmp/graphiti && \
    cp -r /tmp/graphiti/server/* /app/ && \
    rm -rf /tmp/graphiti

# Install dependencies
RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "graph_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
