DB_HOST = "localhost"
DB_PORT = 3306
DB_NAME = "agriforecast"
DB_USER = "root"
DB_PASSWORD = "kcsp"
DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

MODEL_SAVE_DIR = "models/saved"
