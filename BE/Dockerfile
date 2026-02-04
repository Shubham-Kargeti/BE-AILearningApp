FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# Added build-essential for compiling Python packages (torch, scipy, etc.)
# Added libgomp1 for OpenMP support (required by faiss-cpu and scikit-learn)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    postgresql-client \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# Using --no-cache-dir to reduce image size
# AI/ML packages (torch, transformers, etc.) will take longer to install
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY config.py .

# Copy data files for course recommendations
# These include the FAISS vector index and course masterdata
COPY data ./data

# Create cache directory for HuggingFace models
# The sentence-transformers model will be downloaded on first use
RUN mkdir -p /app/.cache/huggingface && \
    chmod -R 755 /app/.cache

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Set HuggingFace cache directory
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
