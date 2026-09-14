import os

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "agriforecast")
DB_USER = os.getenv("DB_USER", "agri")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

MODEL_SAVE_DIR = os.getenv("MODEL_SAVE_DIR", "models/saved")
