# 모아타운 현황지도

서울시가 공식 선정한 모아타운을 지도에서 탐색하고, 구역별 공개 계획과 근거 자료를 확인하는 프로젝트입니다. 현재는 **기획·설계·데이터 준비 단계**이며 지도 기능은 아직 구현하지 않았습니다.

- [GitHub Pages 진행 현황](https://kdkrkwhr.github.io/moatown-map/)
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
- `index.html`: 지도 구현 전 진행 현황을 안내하는 페이지

완성된 스냅샷을 검증한 뒤 `moatown-data/latest.json`을 변경합니다. 사이트 갱신일은 공식 자료 기준일과 다릅니다. 공식 고시·공고 확인을 대체하지 않습니다.
