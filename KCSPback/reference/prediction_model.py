"""
양파 도매 평균가격 순별 예측 모델 v5
v2 + 유가 데이터 추가
데이터: 가격, 기상(1곳), 반입량, 환율, 소비자/생산자 물가지수, 유가
학습: 2018~2024, 테스트: 2025
"""
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import time

t0 = time.time()
DATA_DIR = "c:/Users/82104/Desktop/onion_predict/"

# ================================================================
# 1. 데이터 로드
# ================================================================
def parse_date(d):
    d = str(d).strip().replace('\ufeff', '')
    pm = {'상순': 0, '중순': 1, '하순': 2}
    year = int(d[:4])
    month = int(d[4:6])
    period_str = d[6:]
    return year, month, pm[period_str], period_str

def to_idx(y, m, p):
    return (y - 2017) * 36 + (m - 1) * 3 + p

# 가격
price = pd.read_excel(DATA_DIR + "가격데이터_순별.xlsx")
price.columns = price.columns.str.strip()
parsed = price['DATE'].apply(parse_date)
price['Year'] = parsed.apply(lambda x: x[0])
price['Month'] = parsed.apply(lambda x: x[1])
price['Period'] = parsed.apply(lambda x: x[2])
price['PeriodStr'] = parsed.apply(lambda x: x[3])
price['idx'] = price.apply(lambda r: to_idx(r['Year'], r['Month'], r['Period']), axis=1)
for c in ['평균가격', '전년', '평년']:
    price[c] = pd.to_numeric(price[c], errors='coerce')
price = price.sort_values('idx').reset_index(drop=True)

# 날씨
weather = pd.read_csv(DATA_DIR + "날씨데이터_순별.csv")
weather.columns = weather.columns.str.strip()
wp = weather['DATE'].apply(parse_date)
weather['idx'] = [to_idx(x[0], x[1], x[2]) for x in wp]
WCOLS_RAW = [c for c in weather.columns if c not in ['DATE', 'idx']]
for c in WCOLS_RAW:
    weather[c] = pd.to_numeric(weather[c], errors='coerce')
weather = weather.sort_values('idx').reset_index(drop=True)

# 반입량
supply = pd.read_excel(DATA_DIR + "양파반입량_순별.xlsx")
supply.columns = supply.columns.str.strip()
sp = supply['DATE'].apply(parse_date)
supply['idx'] = [to_idx(x[0], x[1], x[2]) for x in sp]
supply['총반입량'] = pd.to_numeric(supply['총반입량'], errors='coerce')
supply = supply.sort_values('idx').reset_index(drop=True)

# 환율
exchange = pd.read_csv(DATA_DIR + "환율데이터_순별.csv")
exchange.columns = exchange.columns.str.strip()
ep = exchange['DATE'].apply(parse_date)
exchange['idx'] = [to_idx(x[0], x[1], x[2]) for x in ep]
ECOLS = ['원/달러', '달러_등락률(%)', '원/위안', '위안_등락률(%)']
for c in ECOLS:
    exchange[c] = pd.to_numeric(exchange[c], errors='coerce')
exchange = exchange.sort_values('idx').reset_index(drop=True)

# 소비자물가지수 (월별→순별)
cp = pd.read_csv(DATA_DIR + "Consumer_Price.csv", encoding='euc-kr')
cp.columns = ['날짜', '단위', 'CPI']
cp['CPI'] = pd.to_numeric(cp['CPI'], errors='coerce')
cp_rows = []
for _, row in cp.iterrows():
    y, m = int(row['날짜'][:4]), int(row['날짜'][5:7])
    for p in [0, 1, 2]:
        cp_rows.append({'idx': to_idx(y, m, p), 'CPI': row['CPI']})
cp_df = pd.DataFrame(cp_rows)

# 생산자물가지수 (월별→순별)
pp = pd.read_csv(DATA_DIR + "Producer_Price.csv", encoding='euc-kr')
pp.columns = ['날짜', '단위', 'PPI']
pp['PPI'] = pd.to_numeric(pp['PPI'], errors='coerce')
pp_rows = []
for _, row in pp.iterrows():
    y, m = int(row['날짜'][:4]), int(row['날짜'][5:7])
    for p in [0, 1, 2]:
        pp_rows.append({'idx': to_idx(y, m, p), 'PPI': row['PPI']})
pp_df = pd.DataFrame(pp_rows)

# ★ v5: 유가 데이터
oil = pd.read_csv(DATA_DIR + "순_유가데이터.csv")
oil.columns = oil.columns.str.strip()
oil_parsed = oil['날짜'].apply(parse_date)
oil['idx'] = [to_idx(x[0], x[1], x[2]) for x in oil_parsed]
OIL_COLS = ['종가', '시가', '고가', '저가', '거래량']
for c in OIL_COLS: oil[c] = pd.to_numeric(oil[c], errors='coerce')
oil = oil.sort_values('idx').reset_index(drop=True)

print("=" * 60)
print("  양파 도매가격 순별 예측 모델 v5")
print("  (v2 + 유가 데이터 추가)")
print("=" * 60)
print(f"[로드] 가격 {price.shape[0]} | 날씨 {weather.shape[0]} | 반입량 {supply.shape[0]} | 환율 {exchange.shape[0]} | CPI {len(cp)} | PPI {len(pp)} | 유가 {oil.shape[0]}")

# ================================================================
# 2. 병합
# ================================================================
df = price[['idx', 'Year', 'Month', 'Period', 'PeriodStr', '평균가격', '전년', '평년', 'DATE']].copy()
df = df.merge(weather[['idx'] + WCOLS_RAW], on='idx', how='left')
df = df.merge(supply[['idx', '총반입량']], on='idx', how='left')
df = df.merge(exchange[['idx'] + ECOLS], on='idx', how='left')
df = df.merge(cp_df, on='idx', how='left')
df = df.merge(pp_df, on='idx', how='left')
df = df.merge(oil[['idx', '종가']].rename(columns={'종가': 'oil_close'}), on='idx', how='left')
df = df.sort_values('idx').reset_index(drop=True)
print(f"[병합] {df.shape[0]}행 × {df.shape[1]}열")

# ================================================================
# 3. 피쳐 엔지니어링
# ================================================================
TARGET = '평균가격'

# --- 가격 시계열 ---
for lag in [1, 2, 3, 4, 5, 6, 9, 12, 18, 36]:
    df[f'plag{lag}'] = df[TARGET].shift(lag)
for w in [3, 6, 12]:
    df[f'pma{w}'] = df[TARGET].shift(1).rolling(w).mean()
for w in [3, 6]:
    df[f'pstd{w}'] = df[TARGET].shift(1).rolling(w).std()
df['pmom3'] = df['plag1'] - df['plag4']
df['pmom6'] = df['plag1'] - df['plag6']
df['pyoy'] = df[TARGET].shift(1) / df[TARGET].shift(37) - 1
df['p_vs_py'] = df['plag1'] / df['평년'].replace(0, np.nan)
df['p_vs_jn'] = df['plag1'] / df['전년'].replace(0, np.nan)
df['p_ratio_12'] = df['plag1'] / df['plag12'].replace(0, np.nan)

# --- 반입량 ---
for lag in [1, 2, 3]:
    df[f'slag{lag}'] = df['총반입량'].shift(lag)
df['sma3'] = df['총반입량'].shift(1).rolling(3).mean()
df['sma6'] = df['총반입량'].shift(1).rolling(6).mean()
df['schg'] = df['총반입량'].shift(1).pct_change()
df['svma'] = df['slag1'] / df['sma6'].replace(0, np.nan)
df['ps_ratio'] = df['plag1'] / df['slag1'].replace(0, np.nan)

# --- 환율 ---
for lag in [1, 3, 6]:
    df[f'usd_l{lag}'] = df['원/달러'].shift(lag)
    df[f'cny_l{lag}'] = df['원/위안'].shift(lag)
    df[f'usd_chg_l{lag}'] = df['달러_등락률(%)'].shift(lag)
    df[f'cny_chg_l{lag}'] = df['위안_등락률(%)'].shift(lag)
df['usd_ma3'] = df['원/달러'].shift(1).rolling(3).mean()
df['usd_ma6'] = df['원/달러'].shift(1).rolling(6).mean()
df['cny_ma3'] = df['원/위안'].shift(1).rolling(3).mean()

# --- ★ v5: 유가 피쳐 ---
for lag in [1, 3, 6]:
    df[f'oil_l{lag}'] = df['oil_close'].shift(lag)
df['oil_ma3'] = df['oil_close'].shift(1).rolling(3).mean()
df['oil_ma6'] = df['oil_close'].shift(1).rolling(6).mean()
df['oil_chg'] = df['oil_close'].shift(1).pct_change()
df['oil_mom3'] = df['oil_close'].shift(1) - df['oil_close'].shift(4)

# --- 물가지수 ---
for lag in [1, 3, 6]:
    df[f'cpi_l{lag}'] = df['CPI'].shift(lag)
    df[f'ppi_l{lag}'] = df['PPI'].shift(lag)
df['cpi_chg'] = df['CPI'].shift(1).pct_change()
df['ppi_chg'] = df['PPI'].shift(1).pct_change()
df['cpi_ppi_ratio'] = df['CPI'].shift(1) / df['PPI'].shift(1).replace(0, np.nan)

# --- 기상 ---
curr_wcols = [c for c in WCOLS_RAW if '전년' not in c]
for c in curr_wcols:
    for lag in [1, 3, 6, 9]:
        df[f'{c}_l{lag}'] = df[c].shift(lag)

# 기상 전년 대비 변화
w_pairs = [
    ('평균 기온(°C)', '전년 기온(°C)'),
    ('평균 강수량(mm)', '전년 강수량(mm)'),
    ('평균 일사량(MJ/㎡)', '전년 일사량(MJ/㎡)'),
    ('평균 습도(%)', '전년 습도(%)'),
]
for curr, prev in w_pairs:
    safe_name = curr.split('(')[0].strip().replace(' ', '_')
    df[f'{safe_name}_전년차'] = df[curr] - df[prev]
    df[f'{safe_name}_전년차_l3'] = df[f'{safe_name}_전년차'].shift(3)

# 기상 파생
df['temp_range_l3'] = df['최고 기온(°C)'].shift(3) - df['최저 기온(°C)'].shift(3)
df['heat_stress'] = (df['최고 기온(°C)'].shift(3) > 30).astype(int)
df['cold_stress'] = (df['최저 기온(°C)'].shift(3) < -5).astype(int)
df['heavy_rain_l3'] = (df['평균 강수량(mm)'].shift(3) > 10).astype(int)
df['heavy_rain_l6'] = (df['평균 강수량(mm)'].shift(6) > 10).astype(int)
df['drought_l3'] = (df['평균 강수량(mm)'].shift(3) < 0.5).astype(int)

# --- 달력 ---
df['msin'] = np.sin(2 * np.pi * df['Month'] / 12)
df['mcos'] = np.cos(2 * np.pi * df['Month'] / 12)
df['piy'] = (df['Month'] - 1) * 3 + df['Period']
df['pysin'] = np.sin(2 * np.pi * df['piy'] / 36)
df['pycos'] = np.cos(2 * np.pi * df['piy'] / 36)
df['harvest'] = ((df['Month'] >= 4) & (df['Month'] <= 6)).astype(int)
df['storage'] = ((df['Month'] >= 7) | (df['Month'] <= 3)).astype(int)
df['winter'] = ((df['Month'] >= 12) | (df['Month'] <= 2)).astype(int)

# --- ★ v2 추가: 보릿고개 교차 피쳐 ---
df['supply_gap'] = ((df['Month'] >= 1) & (df['Month'] <= 3)).astype(int)
df['plag1_x_gap'] = df['plag1'] * df['supply_gap']          # 가격 × 보릿고개
df['ppi_x_gap'] = df['PPI'].shift(1) * df['supply_gap']     # PPI × 보릿고개
df['pmom3_x_winter'] = df['pmom3'] * df['winter']            # 모멘텀 × 겨울
df['s_drop3'] = (df['slag1'] / df['sma3'].replace(0, np.nan)) - 1  # 반입량 감소율
df['s_yoy'] = df['총반입량'].shift(1) / df['총반입량'].shift(37).replace(0, np.nan)
df['p_accel'] = df['pmom3'] - df['pmom3'].shift(1)           # 가격 가속도

# ================================================================
# 4. 정제 + Train/Test
# ================================================================
EXCLUDE = (
    {'idx', 'Year', 'Month', 'Period', 'PeriodStr', 'DATE',
     TARGET, '전년', '평년', '총반입량', 'CPI', 'PPI', 'oil_close'}
    | set(ECOLS) | set(WCOLS_RAW)
)
ALL_FEATURES = [c for c in df.columns if c not in EXCLUDE and not df[c].isna().all()]

first_valid = df[ALL_FEATURES].dropna().index.min()
df_clean = df.loc[first_valid:].copy()
df_clean[ALL_FEATURES] = (
    df_clean[ALL_FEATURES]
    .fillna(method='ffill').fillna(0)
    .replace([np.inf, -np.inf], 0)
)

train = df_clean[(df_clean['Year'] >= 2018) & (df_clean['Year'] <= 2024)]
test = df_clean[df_clean['Year'] == 2025]

print(f"[후보 피쳐] {len(ALL_FEATURES)}개")
print(f"[학습] {len(train)}행 | [테스트] {len(test)}행")

# ================================================================
# 5. 피쳐 선별 (CV 기반 최적 N 탐색)
# ================================================================
print("\n--- 피쳐 선별 (CV 탐색) ---")

y_tr = train[TARGET].values
y_te = test[TARGET].values

# ★ v2: 1-4월 샘플 가중치 (보릿고개 학습 강화)
WEIGHT_JAN_APR = 1.5
sample_weights_tr = np.where(train['Month'].values <= 4, WEIGHT_JAN_APR, 1.0)

tscv = TimeSeriesSplit(n_splits=5)

# importance 기반 피쳐 순위
selector = xgb.XGBRegressor(
    n_estimators=500, max_depth=4, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0,
)
selector.fit(train[ALL_FEATURES].values, y_tr, sample_weight=sample_weights_tr)
importance = pd.DataFrame({
    'feature': ALL_FEATURES,
    'importance': selector.feature_importances_,
}).sort_values('importance', ascending=False)

# CV 탐색: 상위 N개별 성능 비교
N_CANDIDATES = [10, 12, 15, 18, 20, 25, 30, 40]
best_cv_r2, best_n = -999, 18
for n_feat in N_CANDIDATES:
    if n_feat > len(ALL_FEATURES):
        continue
    feats = importance.head(n_feat)['feature'].tolist()
    Xt = train[feats].values
    fold_r2s = []
    for tr_idx, val_idx in tscv.split(Xt):
        m_ = xgb.XGBRegressor(
            n_estimators=500, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0,
        )
        m_.fit(Xt[tr_idx], y_tr[tr_idx], sample_weight=sample_weights_tr[tr_idx])
        fold_r2s.append(r2_score(y_tr[val_idx], m_.predict(Xt[val_idx])))
    avg = np.mean(fold_r2s)
    print(f"  N={n_feat:>3d}: CV R²={avg:.4f}")
    if avg > best_cv_r2:
        best_cv_r2, best_n = avg, n_feat

SELECTED = importance.head(best_n)['feature'].tolist()
print(f"  ★ 최적 N={best_n} (CV R²={best_cv_r2:.4f})")
print(f"  피쳐 목록: {SELECTED}")

X_train = train[SELECTED].values
X_test = test[SELECTED].values

# ================================================================
# 6. 하이퍼파라미터 탐색 (Grid Search + CV)
# ================================================================
print("\n--- 하이퍼파라미터 탐색 ---")
HP_GRID = {
    'max_depth': [2, 3, 4],
    'learning_rate': [0.02, 0.03, 0.05],
    'n_estimators': [300, 400, 500],
    'subsample': [0.7, 0.8, 0.9],
}

best_hp_r2 = -999
best_params = {
    'n_estimators': 400, 'max_depth': 2,
    'learning_rate': 0.03, 'subsample': 0.7,
    'colsample_bytree': 0.8, 'random_state': 42, 'verbosity': 0,
}
cnt = 0
total = 1
for v in HP_GRID.values():
    total *= len(v)
total *= 5  # folds

for d in HP_GRID['max_depth']:
    for lr in HP_GRID['learning_rate']:
        for ne in HP_GRID['n_estimators']:
            for ss in HP_GRID['subsample']:
                params_ = {
                    'n_estimators': ne, 'max_depth': d,
                    'learning_rate': lr, 'subsample': ss,
                    'colsample_bytree': 0.8, 'random_state': 42, 'verbosity': 0,
                }
                fold_r2s = []
                for tr_idx, val_idx in tscv.split(X_train):
                    m_ = xgb.XGBRegressor(**params_)
                    m_.fit(X_train[tr_idx], y_tr[tr_idx], sample_weight=sample_weights_tr[tr_idx])
                    fold_r2s.append(r2_score(y_tr[val_idx], m_.predict(X_train[val_idx])))
                avg = np.mean(fold_r2s)
                cnt += 5
                if avg > best_hp_r2:
                    best_hp_r2 = avg
                    best_params = params_.copy()

print(f"  탐색 완료 ({cnt} fits)")
print(f"  최적: depth={best_params['max_depth']}, lr={best_params['learning_rate']}, "
      f"n_est={best_params['n_estimators']}, sub={best_params['subsample']}")
print(f"  CV R²={best_hp_r2:.4f}")

# ================================================================
# 7. 최종 모델 학습
# ================================================================
print("\n" + "=" * 60)
print("  모델 학습: XGBoost")
print("=" * 60)
model = xgb.XGBRegressor(**best_params)
model.fit(X_train, y_tr, sample_weight=sample_weights_tr)
print("  학습 완료!")

# ================================================================
# 8. CV 결과
# ================================================================
print("\n--- TimeSeriesSplit 5-Fold CV ---")
cv_results = []
for fold, (tr_idx, val_idx) in enumerate(tscv.split(X_train), 1):
    w_fold = sample_weights_tr[tr_idx]
    fm_ = xgb.XGBRegressor(**best_params)
    fm_.fit(X_train[tr_idx], y_tr[tr_idx], sample_weight=w_fold)
    fp = fm_.predict(X_train[val_idx])
    fr2 = r2_score(y_tr[val_idx], fp)
    frmse = np.sqrt(mean_squared_error(y_tr[val_idx], fp))
    cv_results.append({'fold': fold, 'R2': fr2, 'RMSE': frmse})
    print(f"  Fold {fold}: R²={fr2:.4f}, RMSE={frmse:,.1f}")
avg_r2 = np.mean([r['R2'] for r in cv_results])
avg_rmse = np.mean([r['RMSE'] for r in cv_results])
print(f"  ─────────────────────────────")
print(f"  평균: R²={avg_r2:.4f}, RMSE={avg_rmse:,.1f}")

# ================================================================
# 9. 테스트 평가
# ================================================================
y_pred = model.predict(X_test)
test_r2 = r2_score(y_te, y_pred)
test_rmse = np.sqrt(mean_squared_error(y_te, y_pred))
test_mae = mean_absolute_error(y_te, y_pred)
test_mape = np.mean(np.abs((y_te - y_pred) / y_te)) * 100

print("\n" + "=" * 60)
print("  2025년 테스트 결과")
print("=" * 60)
print(f"  R²:   {test_r2:.4f}")
print(f"  RMSE: {test_rmse:,.1f}")
print(f"  MAE:  {test_mae:,.1f}")
print(f"  MAPE: {test_mape:.1f}%")
print(f"  피쳐: {best_n}개")
print(f"  파라미터: depth={best_params['max_depth']}, lr={best_params['learning_rate']}, "
      f"n_est={best_params['n_estimators']}, sub={best_params['subsample']}")
jan_apr = test['Month'] <= 4
mape_14 = np.mean(np.abs((y_te[jan_apr] - y_pred[jan_apr]) / y_te[jan_apr])) * 100
mape_512 = np.mean(np.abs((y_te[~jan_apr] - y_pred[~jan_apr]) / y_te[~jan_apr])) * 100
print(f"  1-4월 MAPE: {mape_14:.1f}%  |  5-12월 MAPE: {mape_512:.1f}%")
print("=" * 60)

# 순별 상세
print(f"\n{'DATE':>14s}  {'실제':>10s}  {'예측':>10s}  {'오차':>10s}  {'오차율':>7s}")
print("-" * 58)
for i in range(len(test)):
    d = test.iloc[i]['DATE']
    a, p_ = y_te[i], y_pred[i]
    marker = " ◀" if test.iloc[i]['Month'] <= 4 else ""
    print(f"{d:>14s}  {a:>10,.1f}  {p_:>10,.1f}  {a-p_:>+10,.1f}  {abs(a-p_)/a*100:>6.1f}%{marker}")

# ================================================================
# 10. 피쳐 중요도
# ================================================================
final_imp = pd.DataFrame({
    'feature': SELECTED,
    'importance': model.feature_importances_,
}).sort_values('importance', ascending=False)

print(f"\n--- 피쳐 중요도 Top 15 ({best_n}개 중) ---")
for _, row in final_imp.head(15).iterrows():
    bar = '█' * int(row['importance'] * 80)
    print(f"  {row['feature']:30s}  {row['importance']:.4f}  {bar}")

# ================================================================
# 11. 시각화 (6개 플롯)
# ================================================================
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import platform

    if platform.system() == 'Windows':
        font_candidates = ['Malgun Gothic', 'NanumGothic', 'NanumBarunGothic', 'Gulim']
        font_set = False
        for font_name in font_candidates:
            font_list = [f.name for f in fm.fontManager.ttflist]
            if font_name in font_list:
                plt.rcParams['font.family'] = font_name
                font_set = True
                print(f"  [폰트] {font_name} 사용")
                break
        if not font_set:
            import os
            win_font_dir = 'C:/Windows/Fonts'
            for fname in ['malgun.ttf', 'malgunbd.ttf', 'NanumGothic.ttf', 'gulim.ttc']:
                fpath = os.path.join(win_font_dir, fname)
                if os.path.exists(fpath):
                    fm.fontManager.addfont(fpath)
                    prop = fm.FontProperties(fname=fpath)
                    plt.rcParams['font.family'] = prop.get_name()
                    print(f"  [폰트] {fpath} 직접 로드")
                    font_set = True
                    break
    elif platform.system() == 'Darwin':
        plt.rcParams['font.family'] = 'AppleGothic'
    else:
        try:
            import koreanize_matplotlib
        except ImportError:
            plt.rcParams['font.family'] = 'NanumGothic'

    plt.rcParams['axes.unicode_minus'] = False

    COLORS = {
        'actual': '#2C3E50', 'pred': '#FF5722', 'fill': '#FF5722',
        'bar': '#FF7043', 'res_pos': '#E74C3C', 'res_neg': '#2ECC71',
        'cv_bar': '#42A5F5', 'cv_avg': '#FF5722',
    }

    # ── ① 2025 실제 vs 예측 ──
    fig, ax = plt.subplots(figsize=(14, 6))
    x = range(len(test))
    ax.plot(x, y_te, 'o-', color=COLORS['actual'], linewidth=2.2,
            markersize=7, label='실제가격', zorder=5)
    ax.plot(x, y_pred, 's-', color=COLORS['pred'], linewidth=2,
            markersize=5, label='XGBoost 예측', zorder=4)
    ax.fill_between(x, y_te, y_pred, alpha=0.12, color=COLORS['fill'])
    for i in range(len(test)):
        err_pct = abs(y_te[i] - y_pred[i]) / y_te[i] * 100
        ax.annotate(f'{err_pct:.1f}%', (i, (y_te[i] + y_pred[i]) / 2),
                    fontsize=7, ha='center', color='gray', alpha=0.8)
    xlabels = [d.replace('2025', "'25") for d in test['DATE']]
    ax.set_xticks(range(len(test)))
    ax.set_xticklabels(xlabels, rotation=55, ha='right', fontsize=8)
    ax.set_title(f'2025 양파 도매가격: 실제 vs 예측  |  R²={test_r2:.4f}  RMSE={test_rmse:,.1f}  MAPE={test_mape:.1f}%',
                 fontsize=13, fontweight='bold', pad=12)
    ax.set_ylabel('가격 (원/1kg)', fontsize=11)
    ax.set_xlabel('순별', fontsize=11)
    ax.legend(fontsize=10, loc='upper left')
    ax.grid(alpha=0.3, linestyle='--')
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_2025_prediction.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [1/6] result_2025_prediction.png")

    # ── ② 산점도 ──
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.scatter(y_te, y_pred, s=70, c=COLORS['pred'], alpha=0.75, edgecolors='white', linewidth=0.8, zorder=5)
    mn = min(y_te.min(), y_pred.min()) * 0.9
    mx = max(y_te.max(), y_pred.max()) * 1.1
    ax.plot([mn, mx], [mn, mx], 'k--', alpha=0.4, linewidth=1, label='y = x (완벽 예측)')
    ax.set_xlim(mn, mx); ax.set_ylim(mn, mx)
    ax.set_xlabel('실제 가격 (원)', fontsize=11)
    ax.set_ylabel('예측 가격 (원)', fontsize=11)
    ax.set_title(f'실제 vs 예측 산점도 (R²={test_r2:.4f})', fontsize=13, fontweight='bold')
    ax.legend(fontsize=10)
    ax.grid(alpha=0.3, linestyle='--')
    ax.set_aspect('equal')
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_scatter.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [2/6] result_scatter.png")

    # ── ③ 피쳐 중요도 (Top 20) ──
    top_n = min(20, len(final_imp))
    top_imp = final_imp.head(top_n).iloc[::-1]
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.barh(range(top_n), top_imp['importance'].values, color=COLORS['bar'], alpha=0.85, edgecolor='white')
    ax.set_yticks(range(top_n))
    ax.set_yticklabels(top_imp['feature'].values, fontsize=9)
    for i, v in enumerate(top_imp['importance'].values):
        ax.text(v + 0.002, i, f'{v:.4f}', va='center', fontsize=8, color='gray')
    ax.set_xlabel('Importance', fontsize=11)
    ax.set_title(f'피쳐 중요도 Top {top_n} (전체 {best_n}개 선택)', fontsize=13, fontweight='bold')
    ax.grid(axis='x', alpha=0.3, linestyle='--')
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_feature_importance.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [3/6] result_feature_importance.png")

    # ── ④ 전체 시계열 ──
    full_pred = model.predict(df_clean[SELECTED].values)
    fig, ax = plt.subplots(figsize=(16, 6))
    dates = df_clean['DATE'].values
    actual_vals = df_clean[TARGET].values
    n_pts = len(dates)
    n_train = len(train)
    ax.axvline(x=n_train - 0.5, color='gray', linestyle=':', alpha=0.6, linewidth=1.5)
    ax.axvspan(n_train - 0.5, n_pts, alpha=0.06, color='orange')
    ax.text(n_train + 1, max(actual_vals) * 0.95, '← 2025 테스트', fontsize=9, color='gray', style='italic')
    ax.plot(range(n_pts), actual_vals, '-', color=COLORS['actual'], linewidth=1.5, alpha=0.8, label='실제가격')
    ax.plot(range(n_pts), full_pred, '-', color=COLORS['pred'], linewidth=1.2, alpha=0.65, label='모델 예측')
    tick_pos, tick_lab = [], []
    for i, d in enumerate(dates):
        if '01상순' in str(d):
            tick_pos.append(i)
            tick_lab.append(str(d)[:4])
    ax.set_xticks(tick_pos)
    ax.set_xticklabels(tick_lab, fontsize=10)
    ax.set_title('양파 도매가격 전체 시계열 (2018~2025)', fontsize=13, fontweight='bold', pad=12)
    ax.set_ylabel('가격 (원/1kg)', fontsize=11)
    ax.set_xlabel('연도', fontsize=11)
    ax.legend(fontsize=10, loc='upper left')
    ax.grid(alpha=0.3, linestyle='--')
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_full_timeseries.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [4/6] result_full_timeseries.png")

    # ── ⑤ 잔차 분석 ──
    residuals = y_te - y_pred
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    ax1 = axes[0]
    colors_r = [COLORS['res_neg'] if r < 0 else COLORS['res_pos'] for r in residuals]
    ax1.bar(range(len(residuals)), residuals, color=colors_r, alpha=0.75, edgecolor='white')
    ax1.axhline(0, color='black', linewidth=0.8)
    ax1.set_xticks(range(len(test)))
    ax1.set_xticklabels(xlabels, rotation=55, ha='right', fontsize=7)
    ax1.set_ylabel('잔차 (실제 - 예측)', fontsize=10)
    ax1.set_title('순별 예측 잔차', fontsize=12, fontweight='bold')
    ax1.grid(axis='y', alpha=0.3, linestyle='--')
    ax2 = axes[1]
    ax2.hist(residuals, bins=min(12, len(residuals)), color=COLORS['pred'], alpha=0.7, edgecolor='white')
    ax2.axvline(0, color='black', linewidth=0.8, linestyle='--')
    ax2.axvline(np.mean(residuals), color='blue', linewidth=1.2, linestyle='-', label=f'평균={np.mean(residuals):,.1f}')
    ax2.set_xlabel('잔차 (원)', fontsize=10)
    ax2.set_ylabel('빈도', fontsize=10)
    ax2.set_title('잔차 분포', fontsize=12, fontweight='bold')
    ax2.legend(fontsize=9)
    ax2.grid(alpha=0.3, linestyle='--')
    plt.suptitle(f'잔차 분석  |  MAE={test_mae:,.1f}원  MAPE={test_mape:.1f}%', fontsize=13, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_residuals.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [5/6] result_residuals.png")

    # ── ⑥ CV 결과 ──
    fig, ax = plt.subplots(figsize=(8, 5))
    folds = [r['fold'] for r in cv_results]
    r2s = [r['R2'] for r in cv_results]
    bar_colors = [COLORS['cv_bar'] if r >= 0 else '#EF9A9A' for r in r2s]
    ax.bar(folds, r2s, color=bar_colors, alpha=0.8, edgecolor='white', width=0.6)
    ax.axhline(avg_r2, color=COLORS['cv_avg'], linewidth=1.8, linestyle='--', label=f'CV 평균 R²={avg_r2:.4f}')
    ax.axhline(test_r2, color='green', linewidth=1.5, linestyle=':', label=f'테스트 R²={test_r2:.4f}')
    for i, r in enumerate(r2s):
        ax.text(folds[i], r + 0.02 if r >= 0 else r - 0.06, f'{r:.3f}', ha='center', fontsize=10, fontweight='bold')
    ax.set_xlabel('Fold', fontsize=11)
    ax.set_ylabel('R²', fontsize=11)
    ax.set_title('TimeSeriesSplit 5-Fold 교차검증 결과', fontsize=13, fontweight='bold')
    ax.legend(fontsize=10, loc='lower right')
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_xticks(folds)
    plt.tight_layout()
    plt.savefig(DATA_DIR + 'result_cv_results.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  [6/6] result_cv_results.png")

    print(f"\n[시각화 완료] result_*.png 6개 파일 저장됨")
except Exception as e:
    print(f"\n[시각화 건너뜀] {e}")
    import traceback; traceback.print_exc()

# ================================================================
# 12. 결과 저장
# ================================================================
result_df = test[['DATE', 'Year', 'Month', 'Period', TARGET]].copy()
result_df['예측가격'] = y_pred
result_df['오차'] = y_te - y_pred
result_df['오차율(%)'] = np.abs(result_df['오차'] / y_te) * 100
result_df.to_csv(DATA_DIR + 'result_2025_predictions.csv', index=False, encoding='utf-8-sig')

print(f"[저장] result_2025_predictions.csv")
print(f"\n총 소요시간: {time.time() - t0:.1f}초")
