# 모아타운 현황지도

서울시가 선정한 모아타운과 세부 사업구역을 찾는 공개 지도입니다. 검색창에 `강북구 착공`처럼 입력하거나 자치구와 사업 단계 필터를 함께 선택하세요. 관리계획 승인은 대상지 단위로, 조합설립·사업인가·착공은 하위 구역 단위로 찾을 수 있습니다. 검색 결과를 누르면 해당 상세와 원문이 열립니다. 모바일은 하단 검색 패널을 누르거나 위로 끌어 올려 사용합니다.

- [서울 모아타운 현황지도](https://moatownmap.com/)
- [모아타운 Q&A](https://moatownmap.com/qa.html)에서 주소, 추진 단계, 시공사, 3D 계획에 대한 답을 읽고 해당 화면을 바로 열 수 있습니다.
- [착공 구역](https://moatownmap.com/?progress=construction) · [관리계획 승인 대상지](https://moatownmap.com/?plan=approved) · [취소 이력](https://moatownmap.com/?plan=canceled)
- [공식 자료와 언론 보도](https://moatownmap.com/news.html)에서 지역과 출처를 고르거나 관련 대상지의 지도 상세를 열 수 있습니다.
- [위성 지도와 지적편집도 보기](https://moatownmap.com/?map=hybrid&cadastral=1)
- [배경지도 출처 및 표시 원칙](docs/basemap.md)
- [제품 기획서](docs/product-spec.html)
- [상세 설계](docs/architecture.md)
- [서울 108개 대상지 기존 건물 3D 목록](docs/3d-city-results.md) · [화곡동 354](https://moatownmap.com/?town=mt-202603-public-002&view=3d) · [신월동 102-33](https://moatownmap.com/?town=mt-202603-public-067&view=3d) · [번동 429-114](https://moatownmap.com/?town=mt-202603-public-034&view=3d) · [면목동 86-3](https://moatownmap.com/?town=mt-202603-public-010&view=3d)
- [3D 시범 수집·검증 결과](docs/3d-pilot-results.md) · [시범 작업 지시서](docs/3d-pilot.md)
- [전체 대상지 건축 후 예상 3D 수록·보류 현황](docs/3d-plan-coverage.md) · [시흥동 817 일대](https://moatownmap.com/?town=mt-202603-public-025&view=3d&mode=after) · [화곡동 1087 구역별·전체 배치](https://moatownmap.com/?town=mt-202603-public-001&view=3d&mode=after)
- 건축 후 3D 배치 보기 · [번동 1~5구역](https://moatownmap.com/?town=mt-202603-public-034&view=3d&mode=after) · [면목역 1·2·4·6구역](https://moatownmap.com/?town=mt-202603-public-010&view=3d&mode=after) · [신월동 A1~A4](https://moatownmap.com/?town=mt-202603-public-067&view=3d&mode=after)
- [데이터 출처와 수집 범위](docs/data-sources.md)
- [2026.11.25 전체 데이터 검수와 항목별 수록률](docs/data-audit-2026-11-25.md)
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
- `vendor/turf/`: 주소 좌표와 참고 외곽의 포함 관계를 판별하는 Turf 모듈과 라이선스

완성된 스냅샷을 검증한 뒤 `moatown-data/latest.json`을 변경합니다. Pages 배포 시 최신 명부에서 대상지와 세부구역별 정적 상세 페이지(`/towns/<townId>/`, `/towns/<townId>/<zoneId>/`)와 사이트맵을 생성합니다. 첫 HTML에 추진 단계, 자료 기준일과 원문 링크가 들어가며, 지도가 준비되면 같은 주소에서 탐색을 계속할 수 있습니다. 기존 쿼리 링크도 지원합니다. 로컬 미리보기 전에는 `node scripts/build-sitemap.mjs`를 실행합니다.


## 로컬 확인

저장소 루트에서 `python3 -m http.server 8000`을 실행한 다음 `http://localhost:8000/`을 엽니다. 네이버 배경지도를 로컬에서 확인하려면 해당 주소를 Maps 애플리케이션의 Web 서비스 URL에 등록해야 합니다. 지도·소식·Q&A 페이지의 HTML, CSS, 모듈 또는 여기에서 참조하는 `assets/` 이미지를 수정한 후에는 `node scripts/sync-assets.mjs`를 실행하고 변경된 참조를 함께 커밋합니다. `node --test`는 공개 페이지와 하위 모듈, 이미지의 캐시 태그도 검사합니다.

네이버 일반·위성 지도에서 지적편집도를 겹쳐 보거나 거리 재기로 두 지점의 직선거리를 확인할 수 있습니다. 법정 경계는 관할 기관의 최신 고시에서 확인하세요.
