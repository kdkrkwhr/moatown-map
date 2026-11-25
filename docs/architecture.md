# 서울 모아타운 현황지도 구조

GitHub Pages가 `main` 브랜치 루트의 정적 파일을 배포합니다. 브라우저가 지도와 사업 소식을 렌더링하며, 두 화면은 대상지와 세부구역 ID를 공유합니다. [서비스 소개](product-spec.html) · [데이터 출처와 검수 범위](data-sources.md)

## 화면과 모듈

`index.html`의 진입점은 `app.mjs`입니다. URL의 검색 조건과 선택을 먼저 읽어 화면을 준비한 뒤, 최신 스냅샷을 불러와 목록·지도·상세 패널을 연결합니다. 모바일에서는 검색창이 지도 위에 놓이고 하단 시트를 접거나 펼칠 수 있습니다. `?town=…`은 대상지 요약을, `?town=…&zone=…`은 선택한 세부구역 탭을 엽니다. 뒤로 가기와 공유 링크에서도 같은 ID를 사용합니다.

| 모듈 | 역할 |
| --- | --- |
| `map-engine.mjs` | 네이버 지도 JS API v3와 Geocoder를 로드합니다. 일반·위성 지도와 독립적인 지적편집도, 거리 재기, 주소 핀, 패널 여백을 고려한 구역 포커싱을 담당합니다. 줌 12 이하에서 자치구 집계 마커를, 줌 13 이상에서 구역별 경계·라벨을 표시합니다. |
| `project-search.mjs` | 이름·주소·사업 단계로 대상지와 세부구역을 찾습니다. 자치구·관리계획·추진 단계·최근 변동 조건 및 취소 이력을 처리합니다. |
| `detail-view.mjs` | 대상지·세부구역의 고정 요약과 추진·일정, 사업성·규제, 세부구역 탭을 만듭니다. 세부구역 비교표, 필드별 출처와 정보 수정 제보 링크도 여기서 구성합니다. |
| `detail-format.mjs` | 면적·세대수·날짜의 표시, 단계별 경과일, 같은 구간을 지난 다른 사업장의 소요 기간 비교를 담당합니다. |
| `address-reference.mjs` | 지번 입력의 자치구별 색인을 필요할 때 읽습니다. 도로명 조회는 다음 우편번호 검색과 네이버 좌표 검색을 사용합니다. 좌표를 서울 전역의 수록 참고 외곽과 대조해 내부·외부·경계 5m 이내를 판별합니다. 다각형 내부 판정은 저장소의 Turf 모듈을 사용합니다. |
| `news.mjs` | 공식 자료와 언론 보도를 각각 가져와 게시일순으로 정렬하고, 연결된 대상지·세부구역 ID로 소식을 찾습니다. 한 자료원에서 오류가 나면 조회에 성공한 자료를 제공합니다. |
| `news-page.mjs` | `news.html`의 진입점입니다. 출처·위치 필터와 소식 카드를 구성하고 관련 사업장으로 가는 지도 링크를 제공합니다. |
| `pilot-viewer.mjs`, `pilot-scene.mjs` | 3D 보기를 열면 해당 대상지의 건물 파일과 계획 근거를 읽습니다. 로컬 WebGL 뷰어에서 두 모드가 카메라를 공유하며, WebGL을 사용할 수 없을 때는 Canvas로 표시합니다. 네이버 지도와 패널을 유지한 채 대화상자를 열어 뒤로 가면 기존 탐색 위치로 복귀합니다. |

## 데이터 흐름과 표출 기준

지도는 `moatown-data/latest.json`의 `files`에서 같은 스냅샷의 경로를 읽습니다. `towns`와 `zones`는 `town.id`와 `zone.town_id`로 연결합니다. `boundaries`는 대상지·세부구역별 GeoJSON을 제공하고, `excluded`에는 원 명부에서 제외된 기록과 취소 이력이 있습니다. `review`에는 매칭 보류 사유와 누락 항목이 있습니다. 주소 색인은 `moatown-data/addresses/index.json`과 자치구별 파일로 구성됩니다.

경계에는 자료 유형과 원문 근거를 보존합니다. 대표 지번만 확인한 곳에는 핀을 표시하고, 위치를 확인하지 못한 곳은 목록에서 탐색할 수 있습니다. 면적·세대수·권리산정기준일 등은 해당 기록의 값을 사용합니다. 수록 자료에서 값을 확인하지 못한 상세 항목은 ‘미고시’로 표시합니다.

세부구역 비교표는 계획 세대수와 그 근거 자료의 기준일을 같은 칸에 표시합니다. 대상지의 직접 공표 수치를 우선하며, 모든 하위 구역의 세대수가 같은 관리계획 고시·표·계획안에 속할 때만 ‘수록 구역 계획 합계’를 계산합니다. 푸터의 스냅샷 기준일과 개별 사업 수치의 기준일을 따로 관리합니다.

소식 화면과 지도 상세 탭은 `moatown-data/news/official.json`과 `media.json`을 공유합니다. 원문 URL·게시일·관련 사업장 ID를 기록하고, 기사 내용으로 인가 단계나 시공사 필드를 자동 변경하지 않습니다.

## 변경 검증과 배포

1. 원자료를 갱신할 때 적용 범위·출처 URL·기준일과 매칭 보류 사유를 기록합니다. 스냅샷, 최신 포인터, 수록 범위와 사이트맵을 함께 확인합니다.
   기존 건물 3D는 참고 외곽이 있는 대상지에 제공하며, 계획·조감도는 공개 자료가 있는 대상지에서 연다. 건물 도형 수집은 `uv run scripts/build-pilot-buildings.py --cache-dir <도형캐시>`로 실행한다. 이어서 `uv run scripts/build-sinwol-current.py --town all --wfs-cache <도형캐시> --cache-dir <대장캐시>`, `uv run scripts/build-sinwol-height-evidence.py --all --cache-dir <층수캐시>`로 대장과 보충 층수를 대조한다. 캐시는 저장소 외부 경로를 사용한다. 출처·계획·건물 파일이 바뀌면 `node scripts/sync-pilot.mjs`로 배포 입력 버전을 갱신한다. [전역 수록 범위와 대조 결과](3d-city-results.md)
   기존 스냅샷에 외곽이 추가되면 도형 수집기에 `--extend --previous-boundaries <종전 경계 파일>`을 넘겨 변경된 대상지부터 수집할 수 있다. 대장 기재 높이가 별도로 확인된 건물은 `uv run scripts/build-register-heights.py --cache-dir <검증캐시>`로 원자료를 대조한다. 뷰어는 해당 대상지에서만 이 자료를 읽고, 기재 높이를 층수 환산보다 우선한다.
2. 화면 파일을 바꾼 뒤 `node scripts/sync-assets.mjs`를 실행합니다. 지도·소식 HTML에서 참조하는 CSS와 하위 모듈까지 같은 콘텐츠 해시를 붙입니다. 생성된 참조도 함께 커밋합니다.
3. 저장소 루트에서 `node --test`를 실행합니다. 데이터 참조, 주소·지도 로직, 상세 지표, 사이트맵 목록과 배포용 캐시 태그를 검사합니다.
4. GitHub Pages 배포 후 지도·소식 페이지와 상세 링크를 확인합니다. 검색용 `sitemap.xml`에는 두 페이지와 대상지·세부구역별 대표 URL을 담습니다. Google Search Console에서는 `https://moatownmap.com/` 속성의 `sitemap.xml` 처리 상태를 확인합니다. [사이트맵 열기](https://moatownmap.com/sitemap.xml) · [Search Console 사이트맵 보고서](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fmoatownmap.com%2F)

## 건축 후 3D 배포 자료

기존 배치도를 연결한 세 대상지는 원 도면을 사용한다. 추가 대상지의 예상 배치는 `node scripts/build-expanded-plans.mjs`로 미리 생성해 `moatown-data/plans/scenes/`에 저장한다. 한 대상지에서 전체 계획과 세부구역 계획이 모두 확인되면 두 장면을 따로 만든다. 브라우저는 선택한 대상지의 JSON을 읽으며, 배포 입력의 해시는 `node scripts/sync-pilot.mjs`로 갱신한다. [전체 수록 및 보류 목록](3d-plan-coverage.md)
