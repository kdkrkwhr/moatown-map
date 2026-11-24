# 모아타운 현황지도

서울시가 공식 선정한 모아타운을 지도에서 탐색하고, 구역별 공개 계획과 근거 자료를 확인하는 프로젝트입니다. 현재는 **공개 지도 MVP**입니다. 화면 전체 지도 위에 검색·자치구 필터·접을 수 있는 목록을 배치했습니다. 서울 전역에서 모아타운 참고 외곽을 먼저 보여 주고, 확대하거나 대상지를 고르면 세부 사업구역을 구분해 표시합니다. 경계가 없는 대상지는 목록에서 찾을 수 있고, 확인된 대표 위치는 선택할 때만 점으로 표시합니다.

- [GitHub Pages 지도](https://kdkrkwhr.github.io/moatown-map/)
- [서울 지도 비교 미리보기](https://kdkrkwhr.github.io/moatown-map/?map=quiet)
- [배경지도 출처 및 표시 원칙](docs/basemap.md)
- [제품 기획서](docs/product-spec.html)
- [상세 설계](docs/architecture.md)
- [데이터 출처와 수집 범위](docs/data-sources.md)
- [최신 데이터 스냅샷](moatown-data/latest.json)

## 첫 공개 범위

- 서울시 공식 선정 대상지. 신청만 한 곳은 제외합니다.
- 서울 전역 → 모아타운 → 세부 사업구역. 확인하지 못한 경계·위치·수치는 추정하지 않습니다.
- GitHub Pages에서 공개 정적 데이터를 읽습니다. 로그인, 운영진 기능, 소식 수집 배치, AI는 이번 범위가 아닙니다.

## 저장소 구성

- `docs/`: README를 제외한 모든 문서
- `moatown-data/`: 한국시간 기준 날짜별 공개 데이터
- `index.html`: 공개 지도와 대상지 목록 진입점
- `app.mjs`, `map-engine.mjs`, `styles.css`: 지도 화면과 배경지도·경계 및 선택 동작
- `vendor/leaflet/`: Leaflet 1.9.4 및 원본 BSD-2-Clause 라이선스

완성된 스냅샷을 검증한 뒤 `moatown-data/latest.json`을 변경합니다. 사이트 갱신일은 공식 자료 기준일과 다릅니다. 공식 고시·공고 확인을 대체하지 않습니다.


## 로컬 확인

저장소 루트에서 `python3 -m http.server 8000`을 실행한 다음 `http://localhost:8000/`을 엽니다. `file://`로 열면 브라우저가 데이터 요청을 차단할 수 있습니다. 지도 모듈 검증은 `node --test`로 실행합니다.

상단의 **서울 지도 / 기존 지도**로 같은 위치의 배경을 비교할 수 있습니다. 기존 지도만 외부 타일을 요청합니다. 법정 경계는 운영 기관의 최신 고시를 확인해야 합니다.
