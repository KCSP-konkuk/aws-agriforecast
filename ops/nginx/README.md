# nginx 압축·캐시

`agriforecast-perf.conf` 는 프론트 정적 파일과 API 응답에 압축·캐시 규칙을 더한다.
사이트 설정(`/etc/nginx/sites-enabled/`, certbot 이 관리)은 서버에만 있으므로 이 조각을 include 해서 쓴다.

| 대상 | 적용 전 | 적용 후 |
|---|---|---|
| JS·CSS·API JSON | 압축 없음 | gzip (첫 화면 JS 218KB → 약 73KB) |
| `/assets/*` | 매번 서버에 확인 | 1년 캐시(파일명 해시) |
| `index.html` | 캐시 규칙 없음 → 옛 화면이 남아 흰 화면 | 매번 확인(`no-cache`) |
| 없는 `/assets/*` | `index.html` 200 → 흰 화면 | 404 |

## 적용(1회)

2026-10-13 운영 서버에 적용했다(`client_max_body_size` 줄 아래 include). 조각을 고치면 아래 scp · `nginx -t` · reload 만 다시 한다.

```
scp -i <키> ops/nginx/agriforecast-perf.conf ubuntu@<서버>:/tmp/
ssh -i <키> ubuntu@<서버>
sudo mv /tmp/agriforecast-perf.conf /etc/nginx/snippets/
sudo nano /etc/nginx/sites-enabled/<사이트>   # listen 443 server 블록 안, location / 위에 아래 한 줄
#   include snippets/agriforecast-perf.conf;
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` 가 `duplicate location "/assets/"` 로 실패하면 사이트 설정에 같은 location 이 이미 있는 것이므로 그쪽을 지우고 다시 확인한다.

## 확인

```
curl -sI -H 'Accept-Encoding: gzip' https://agriforecast.duckdns.org/assets/<아무 js> | grep -iE 'content-encoding|cache-control'
curl -sI https://agriforecast.duckdns.org/ | grep -i cache-control                   # no-cache
curl -s -o /dev/null -w '%{http_code}\n' https://agriforecast.duckdns.org/assets/x.js  # 404
```
