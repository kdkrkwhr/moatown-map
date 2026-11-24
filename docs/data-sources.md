# 데이터 출처와 수집 범위

세부 사업구역의 색은 각 구역 원자료의 추진 단계를 따릅니다. 확인일과 단계 변경일은 구분합니다. 번동 429-114의 통합심의 통과, 사업시행계획인가, 착공 행사 연월은 [서울시 2024년 12월 16일 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=424981)에 근거한 번동 모아주택 1~5구역 공동 이력입니다. 기간은 연월 단위 차이로 계산합니다.

이 저장소의 데이터는 시·구 공식 원문에 연결되는 **초기 부분 스냅샷**입니다. 행 수는 이 저장소에서 대조해 넣은 기록 수이며, 오늘 서울시에서 추진 중인 전체 사업 수나 최신 확정 수가 아닙니다.

## 어떤 자료를 사용했나

| 자료 | 반영 기준 |
| --- | --- |
| [서울시 모아타운 추진 현황](https://news.seoul.go.kr/citybuild/moa-housing-town/policy/status) | 2026-03-31 기준 공식 명부의 번호가 부여된 132행(자치구 공모 88, 주민제안 44)을 기초로 사용. 알려진 공동행의 두 번째 주소는 별도로 보존하되 총계에 중복 반영하지 않음. 원문 페이지가 재접속 시 오류 또는 리디렉션을 반환할 수 있음. |
| [서울시 제10차 도시계획위원회 결과](https://www.seoul.go.kr/news/news_report.do?nttNo=459950) · [제12차 결과](https://www.seoul.go.kr/news/news_report.do?nttNo=462973) · 대상지별 공고 | 기준 명부 이후 확인된 선정 개별 기록의 근거. 공고일과 선정일은 다르며, 단순 후보지나 신청만 한 지역은 포함하지 않음. 기록별 출처는 JSON에 기재. |
| [서울시 정비사업 정보몽땅 취소현황](https://cleanup.seoul.go.kr/cleanup/view/moaTown.do) | 취소 자료 11건을 별도 파일에 기록. 기준 명부에서 확인된 광진구 자양2동 681번지는 지도용 명부에서 제외. 나머지 취소 건은 기초 명부에 포함되지 않았음. |
| [서울시 정릉동 공식 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=447946) | 기준 자료의 정릉동 226-1 자치구 표기를 공식 개별 발표에 따라 성북구로 대조 정정. |
| [번동1구역 사업 개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103) · [코오롱 공식 발표](https://www.kolon.com/kr/media/newsDtl?detailsKey=8301) | 초기 개별 구역의 공개 계획과 면적 구간, 시공사 발표를 별개 출처로 기록. 최신 인가 수치·전용 주택형의 세부 타입·최신 계약은 아닐 수 있음. |

서울주거포털의 2026-05-31 기준 요약 집계와 [서울시 2026-08 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=464445)의 ‘추진 중’ 집계는, 각각 시점과 집계 조건이 다를 수 있습니다. 요약 수치만 가지고 최신 명부를 생성하거나 확인되지 않은 대상지 이름을 추정하지 않습니다.

## 2026-11-24 사업 정보 보강

- 서울시 권역별 아카이브 5곳의 승인고시 표를 기존 명부의 자치구·대표 지번과 대조했습니다. 대상지 59곳의 지번별 고시 60건에 고시일, 아카이브에 실린 사업구역 수, 대상지별 원문을 연결했습니다. 공동 선정된 등촌2동 두 지번은 각각 4곳과 2곳으로 기록했습니다. 쌍문동 460, 화곡6동 957-1, 시흥5동 922-16, 목4동 728-1은 명부와 대응이 불명확해 보류했습니다. [동북권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-northeast) · [서남권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-southwest) · [동남권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-southeast) · [서북권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-northwest) · [도심권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-downtown)
- 번동 1~5구역은 정비사업 정보몽땅의 구역별 사업개요에서 분양·임대 전용면적 구간별 세대수, 지상·지하 층수, 높이, 건폐율과 용적률을 확인했습니다. 번동1구역 임대는 40㎡ 초과~50㎡ 이하 12세대, 50㎡ 초과 18세대로 바로잡았습니다. 다섯 사업개요의 합계 1,182세대와 2024년 시공사 발표의 그룹 합계 1,242세대는 차이가 있어, 각 사업개요는 공개 당시 계획으로 표기합니다. [번동1구역 사업개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103) · [코오롱글로벌 수주 발표](https://www.kolon.com/kr/media/newsDtl?detailsKey=8301)
- 면목본동 2·3·5구역은 HS화성의 공사계약 공시에서 계약일과 계약상대를 대조했습니다. 시공사명은 해당 계약 공시 기준입니다. [면목본동2구역](https://kind.krx.co.kr/external/2025/05/12/000236/20250508001227/91370.htm) · [3구역](https://kind.krx.co.kr/external/2025/12/22/000410/20251216001458/91370.htm) · [5구역](https://kind.krx.co.kr/external/2025/05/08/000393/20250429001918/91370.htm)
- 면목역 1·2구역은 중랑구의 2026년 7월 30일 고시와 첨부 주택형표를 대조했습니다. 인가일은 7월 28일입니다. 전용면적 소수점 네 자리와 원문 타입명을 보존하고, 전체 세대수와 별도로 조합원분양·일반분양·보류지 수를 기록했습니다. [면목역1구역 고시](https://eminwon.jungnang.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?context=NTIS&homepage_pbs_yn=Y&jndinm=OfrNotAncmtEJB&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=15567&not_ancmt_se_code=01%2C02%2C04&pageIndex=1&subCheck=Y) · [면목역2구역 고시](https://eminwon.jungnang.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?context=NTIS&homepage_pbs_yn=Y&jndinm=OfrNotAncmtEJB&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=15568&not_ancmt_se_code=01%2C02%2C04&pageIndex=1&subCheck=Y)

## 아직 없는 데이터

- 최신 서울시 선정 명부 전수 대조, 이후 취소·분할·명칭 변경 전체 이력.
- 사업구역별 목표 세대수·층수·전용 주택형·시공사 전수 자료. 모아타운 전체 숫자로 하위 구역 값을 채우지 않습니다.
- 대상지별 미확인 대표 위치·참고 경계, 전 지역의 법정 사업구역 경계. [서울 열린데이터광장 도시계획 GIS](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do)의 도형은 위치 참고용이며, 실제 경계는 관할기관의 최신 지형도면과 맞춰야 합니다. 도로 한정 토지거래허가 경계를 모아타운 사업 경계로 사용하지 않습니다.
- [소규모정비사업 현황](https://data.seoul.go.kr/dataList/OA-23113/S/1/datasetView.do)은 하위 사업구역 자료의 후보입니다. 모아타운 공식 선정 명부를 대체하지 못합니다.

공공 원문의 주소·날짜·면적 등 사실을 정규화하여 저장하며, 원문 문안·지도 이미지·도형 원본은 포함하지 않습니다. 공간데이터를 추가할 때 배포 허용 범위와 출처 표기를 먼저 확인합니다.

## 대표 지번 핀

‘주소 위치 확인’의 마포구 지번 색인은 2026년 8월 28일 지적도에서 만들었습니다. 법정동코드와 PNU의 산·본번·부번을 연결해 고유 필지의 내부 대표점을 EPSG:5174에서 WGS84로 변환하고 소수점 여섯 자리로 저장했습니다. 26개 법정동의 41,156개 지번이 수록되어 있습니다. 좌표 파일은 조회 시에만 불러옵니다. 수록된 대상지 외곽의 선에서 5m 이내면 경계 부근으로 표시합니다. 마포구의 자료 미수록 지번과 다른 구의 주소는 판정에서 제외합니다. [원본 지적도](https://www.data.go.kr/data/15162460/fileData.do) · [행정표준코드관리시스템](https://www.code.go.kr/)

## 사업 단계와 비교 기간

대상지 관리계획과 세부 구역 추진 단계는 각각 검색합니다. 취소 11건은 원문과 날짜가 있는 이력에서 조회합니다. 선정월과 승인고시일이 확인되고 하나의 승인고시가 연결된 대상지 58곳에서 두 시점의 달력 월 차이 평균은 24.6개월입니다. 비교 카드에는 같은 표본의 평균과 크기를 함께 표시합니다. 공동 선정 지번에 복수 고시가 있는 사례는 제외합니다.

번동 1~5구역의 토지등소유자 수는 각 구역별 공개 사업개요에서 확인한 40명, 82명, 58명, 93명, 98명입니다. 소유자당 계획 세대수는 같은 사업개요의 계획 세대수를 토지등소유자 수로 나눈 값입니다. 각 구역의 근거 URL과 확인일은 `field_evidence.metrics`에 있습니다. [번동1구역 공개 사업개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103)

### 대상지 대표 위치의 출처

[마포구 원클릭도시정보 지적도 및 규제정보](https://www.data.go.kr/data/15162460/fileData.do)의 `LP_PA_CBND` 레이어에서 법정동과 지번이 일치하고 필지 도형이 유일한 건만 연결합니다. 자료 이용허락범위는 제한 없음으로 표시되어 있습니다. 원자료에 .prj가 포함되지 않아, 실제 공공시설의 필지와 공개 좌표를 대조해 원본 좌표계(EPSG:5174)를 검증한 뒤 WGS84로 변환했습니다. 각 점은 필지 내부에서 구한 대표점이며 사업구역의 중심점이 아닙니다. 합정동 369는 이 지적도에서 정확히 일치하는 필지가 없어, 아래 서울시 사업지 도형의 참고점을 사용합니다.

미수집 지역의 대표 위치는 null입니다. 서울 전역 확장 후보는 [국토교통부 일별연속지적도형정보](https://www.data.go.kr/data/15045882/fileData.do)입니다. [공식 서울 SHP 다운로드](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=23)에 로그인이 필요해 이번에는 원본을 받지 못했습니다. 두 원본은 좌표계가 다르므로 같은 설정으로 변환하지 않습니다. 이번 위치 수집은 법정 사업구역 경계의 수집과는 별개입니다.


## 서울시 사업지 도형에서 만든 위치 참고점

[서울 열린데이터광장 OA-22712](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do) 2026년 9월 파일의 `UPIS_C_UQ120` 레이어에서 공식 코드 정의표의 `BZ201`(모아타운)을 사용합니다. 데이터셋의 이용허락범위는 제한 없음으로 표시되어 있습니다.

- 확인된 공식 선정 대상지 명부의 자치구와 사업지명·지번을 대조합니다. 도형에만 있고 명부와 확인되지 않은 곳은 이 작업에서 선정 목록에 추가하지 않습니다.
- 원본 `.prj`의 EPSG:5174로 도형 내부의 대표점을 잡고 WGS84 경도·위도로 변환합니다. 반올림한 결과도 원본 도형 안에 있는지 재확인했습니다.
- `representative_point_evidence.kind`가 `official_project_geometry_reference_point`이면 **사업지 위치 참고점**, `representative_parcel_interior`이면 **대표 지번 필지 내부점**입니다. 서로 다른 지표이며, 앞서 검증한 필지점은 유지했습니다.
- 서울시 자료는 참고용입니다. 점과 도형 모두 법정 사업구역 여부나 개별 필지의 구역 포함을 판정하는 근거로 쓰지 않습니다. 대표 위치와 아래 참고 경계는 별도 항목입니다. 법정 경계로 검증된 파일은 아직 없습니다.


## 참고용 외곽과 세부 사업구역 경계

`boundaries.geojson`은 서울 열린데이터광장 OA-22712의 2026년 9월 공간자료를 이 프로젝트의 선정 명부에 대조해 만든 결과입니다. 필지 도형이나 도로에만 적용되는 토지거래허가 경계가 아닙니다.

- `entity_type: town`은 모아타운 전체의 참고용 외곽이고, `entity_type: zone`은 개별 사업구역의 참고용 외곽입니다. 개별 구역은 `parent_town_id`로 상위 모아타운을 가리킵니다.
- 외곽은 선정 명부와 원본 자치구·사업지명·대표 지번이 일치하거나 공식 자료가 같은 사업지임을 확인해 준 곳만 연결했습니다. 전체 명부와 범위가 같지는 않습니다.
- 하위 구역은 공식 사업명에 상위 사업지의 대표 지번이 명시되거나 공식 발표·고시에 상위 사업과의 관계가 나온 곳만 넣었습니다. 원본에서 자치구가 같고 해당 상위 도형과 면적 95% 이상이 겹치는지 확인했습니다. 공간상 겹치기만 한 후보를 소속이 확인된 구역으로 넣지는 않았습니다.
- 공간자료의 원본 CRS(EPSG:5174)를 WGS84 경도·위도 순으로 옮기고, 링 폐합·유효성·중복·상위 참조를 검증했습니다. 원본의 기준 시점과 출처는 각 Feature에 남아 있습니다.
- 모든 도형의 `boundary_status`는 `reference_only`입니다. **실제 법정 경계나 개별 필지의 구역 포함 여부는 관할 기관의 최신 승인 고시·지형도면에서 확인**해야 합니다.

- 추진 단계와 과거 공개 계획 세대수를 추가로 확인한 구역은 필드별 근거를 기록합니다. 자료가 철회되었거나 구역별 값이 명시되지 않은 경우에는 수치로 옮기지 않습니다. 강서구에서 서로 다른 시점의 구역 목록이 일치하지 않는 사례(화곡1동 354의 A2-4·A2-5)는 보류했습니다.
