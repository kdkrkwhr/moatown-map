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
- 세부 사업구역 중 조합원분양·일반분양·임대 물량을 모두 대조한 곳은 2곳입니다. 미확인 항목은 [검수 목록](../moatown-data/snapshots/2026-11-24/review.json)에 있습니다.

공공 원문의 주소·날짜·면적 등 사실을 정규화하여 저장하며, 원문 문안·지도 이미지·도형 원본은 포함하지 않습니다. 공간데이터를 추가할 때 배포 허용 범위와 출처 표기를 먼저 확인합니다.

## 대표 지번 핀

서울 25개 자치구의 법정동·지번 896,467개를 조회할 수 있습니다. 2026년 11월 24일 서울부동산정보광장 공개 지도에 쓰이는 WFS의 `landbiz:ln_parcel`에서 자치구별로 정렬·페이지 조회했습니다. 896,694개 원본 피처의 번호와 응답 건수를 대조했습니다. 유효한 19자리 PNU, 법정동코드, 산 구분, 양수 본번, 도형 내부 검증을 통과한 고유 필지점만 저장했습니다. 227개 원본 행을 제외했습니다. 자치구별 수록 건수·제외 사유·서버 응답 시각은 [색인 명세](../moatown-data/addresses/index.json)에 있습니다. [서울부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do) · [행정표준코드관리시스템](https://www.code.go.kr/)

서버가 명시한 EPSG:5179에서 도형 내부 대표점을 계산해 WGS84 경도·위도로 변환하고 소수점 일곱 자리로 반올림했습니다. 역변환한 점이 원본 필지 안에 있는지 다시 확인했습니다. 원 서비스가 필지별 지적 정리일을 제공하지 않아 수집일과 원자료 기준일을 구분했습니다. 자치구가 생략된 동명이 겹치면 자치구 입력을 요청합니다. 조회 결과는 **필지 내부 대표점과 수록된 참고 외곽**의 관계입니다. 경계에서 양방향 5m 이내는 별도로 표시합니다. 참고 외곽을 확보하지 못한 대상지의 필지 판정은 보류합니다.

마포구 2026년 8월 28일 자료의 기존 파일 `addresses/mapo.json`은 이전 자료를 참조하는 사용자를 위해 보존합니다. [마포구 지적도](https://www.data.go.kr/data/15162460/fileData.do)

## 사업 단계와 비교 기간

대상지 관리계획과 세부 구역 추진 단계는 각각 검색합니다. 취소 11건은 원문과 날짜가 있는 이력에서 조회합니다. 선정월과 승인고시일이 확인되고 하나의 승인고시가 연결된 대상지 58곳에서 두 시점의 달력 월 차이 평균은 24.6개월입니다. 비교 카드에는 같은 표본의 평균과 크기를 함께 표시합니다. 공동 선정 지번에 복수 고시가 있는 사례는 제외합니다.

번동 1~5구역의 토지등소유자 수는 각 구역별 공개 사업개요에서 확인한 40명, 82명, 58명, 93명, 98명입니다. 소유자당 계획 세대수는 같은 사업개요의 계획 세대수를 토지등소유자 수로 나눈 값입니다. 각 구역의 근거 URL과 확인일은 `field_evidence.metrics`에 있습니다. [번동1구역 공개 사업개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103)

### 대상지 대표 위치의 출처

[마포구 원클릭도시정보 지적도 및 규제정보](https://www.data.go.kr/data/15162460/fileData.do)의 `LP_PA_CBND` 레이어에서 법정동과 지번이 일치하고 필지 도형이 유일한 건만 연결합니다. 자료 이용허락범위는 제한 없음으로 표시되어 있습니다. 원자료에 .prj가 포함되지 않아, 실제 공공시설의 필지와 공개 좌표를 대조해 원본 좌표계(EPSG:5174)를 검증한 뒤 WGS84로 변환했습니다. 각 점은 필지 내부에서 구한 대표점이며 사업구역의 중심점이 아닙니다. 합정동 369는 이 지적도에서 정확히 일치하는 필지가 없어, 아래 서울시 사업지 도형의 참고점을 사용합니다.

새로 연결한 대표 위치 27개는 선정 명부의 자치구·지번이 서울시 필지 PNU 한 건과 일치합니다. 행정동 명칭을 사용한 명부는 행정안전부 관할관계에서 법정동이 유일할 때 연결했습니다. PNU, 법정동명, 좌표계와 확인일은 대상지별 `representative_point_evidence`에 있습니다. 브이월드 전국 배포본은 서울 ZIP 다운로드에 로그인이 필요해 이번 배포에는 서울시 공개 필지 서비스를 사용했습니다. [행정안전부 행정동·법정동 관할관계](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000052&nttId=130674) · [국토교통부 일별연속지적도](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=23)

## 서울시 사업지 도형에서 만든 위치 참고점

[서울 열린데이터광장 OA-22712](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do) 2026년 9월 파일의 `UPIS_C_UQ120` 레이어에서 공식 코드 정의표의 `BZ201`(모아타운)을 사용합니다. 데이터셋의 이용허락범위는 제한 없음으로 표시되어 있습니다.

- 확인된 공식 선정 대상지 명부의 자치구와 사업지명·지번을 대조합니다. 도형에만 있고 명부와 확인되지 않은 곳은 이 작업에서 선정 목록에 추가하지 않습니다.
- 원본 `.prj`의 EPSG:5174로 도형 내부의 대표점을 잡고 WGS84 경도·위도로 변환합니다. 반올림한 결과도 원본 도형 안에 있는지 재확인했습니다.
- `representative_point_evidence.kind`가 `official_project_geometry_reference_point`이면 **사업지 위치 참고점**, `representative_parcel_interior`이면 **대표 지번 필지 내부점**입니다. 서로 다른 지표이며, 앞서 검증한 필지점은 유지했습니다.
- 서울시 자료는 참고용입니다. 점과 도형 모두 법정 사업구역 여부나 개별 필지의 구역 포함을 판정하는 근거로 쓰지 않습니다. 대표 위치와 아래 참고 경계는 별도 항목입니다. 법정 경계로 검증된 파일은 아직 없습니다.


## 참고용 외곽과 세부 사업구역 경계

`boundaries.geojson`에는 서울 열린데이터광장 OA-22712의 2026년 9월 공간자료와 신월동 고시 도면에서 옮긴 참고 경계가 들어 있습니다.

- `entity_type: town`은 모아타운 전체의 참고용 외곽이고, `entity_type: zone`은 개별 사업구역의 참고용 외곽입니다. 개별 구역은 `parent_town_id`로 상위 모아타운을 가리킵니다.
- 외곽은 선정 명부와 원본 자치구·사업지명·대표 지번이 일치하거나 공식 자료가 같은 사업지임을 확인해 준 곳만 연결했습니다. 전체 명부와 범위가 같지는 않습니다.
- 하위 구역은 공식 사업명에 상위 사업지의 대표 지번이 명시되거나 공식 발표·고시에 상위 사업과의 관계가 나온 곳만 넣었습니다. 원본에서 자치구가 같고 해당 상위 도형과 면적 95% 이상이 겹치는지 확인했습니다. 공간상 겹치기만 한 후보를 소속이 확인된 구역으로 넣지는 않았습니다.
- 공간자료의 원본 CRS(EPSG:5174)를 WGS84 경도·위도 순으로 옮기고, 링 폐합·유효성·중복·상위 참조를 검증했습니다. 원본의 기준 시점과 출처는 각 Feature에 남아 있습니다.
- 모든 도형의 `boundary_status`는 `reference_only`입니다. **실제 법정 경계나 개별 필지의 구역 포함 여부는 관할 기관의 최신 승인 고시·지형도면에서 확인**해야 합니다.

- 추진 단계와 과거 공개 계획 세대수를 추가로 확인한 구역은 필드별 근거를 기록합니다. 자료가 철회되었거나 구역별 값이 명시되지 않은 경우에는 수치로 옮기지 않습니다. 강서구에서 서로 다른 시점의 구역 목록이 일치하지 않는 사례(화곡1동 354의 A2-4·A2-5)는 보류했습니다.


## 세부 사업구역과 매수·보유자 확인 항목

- 서울시 소규모정비사업 1,024행과 9월 도시계획 GIS의 자치구·사업명·세부 대표 지번을 대조했습니다. 새로 연결한 GIS 구역 14곳은 사업장 등록, 상위 대상지와 동일한 대표 지번, 세부 도형 안의 필지점, 상위 참고 외곽 내 면적 비율 95% 이상을 확인했습니다. 다른 후보 도형과 작은 쪽 면적의 10%를 초과해 중복하면 연결을 보류했습니다. 합정동 4곳은 승인고시의 도면번호로 연결했습니다. 다른 시점의 유사한 구역 도형은 붙이지 않았습니다. [서울시 소규모정비사업 현황](https://data.seoul.go.kr/dataList/OA-23113/S/1/datasetView.do) · [서울 도시계획사업 도형](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do) · [정비사업 정보몽땅](https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do?cpage=1&pageSize=2000)
- 시공사 신규 기록은 해당 사업장의 협력업체 표에서 ‘시공자’이면서 계약해제·해지가 ‘아니오’인 업체명을 확인했습니다. OA-23113의 2026년 10월 13일은 데이터셋 게시 기준일입니다. 개별 단계의 발생일은 별도 기록합니다. 소유자당 계획 세대수는 같은 사업계획에서 확인되는 총 세대수와 토지등소유자 수로 계산했습니다. 서울시의 ‘분양’ 합계는 원자료에 배분이 명시된 경우에만 조합원·일반분양으로 나눴습니다. [금천구 시흥동 1005 사업현황](https://www.geumcheon.go.kr/portal/rebuildWebView.do?key=4266&rebuildId=28) · [중랑구 면목역 4·6구역 공람공고 목록](https://news.seoul.go.kr/citybuild/archives/543800)
- 권리산정기준일 고시별로 적용 범위, 명시된 날, 제척 또는 연장 여부, 실효 조건을 기록했습니다. 단일 날짜 배지는 한 가지 기준일을 확인하고 기한 내 관리계획 승인까지 대조한 대상지에 표시합니다. 합정동·중동·고척동은 범위별 이력을 확인할 수 있습니다. [서울특별시 고시 제2024-233호](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20240508132129_68566.pdf) · [서울특별시 고시 제2024-488호, 시보 77~79쪽](https://event.seoul.go.kr/seoulsibo/detailview.do?cn_seq=MjQ4MzE%3D&tr_code=snews)
- 토지거래허가구역은 대상지 지번과 개별 공고가 연결되는 경우 기간·범위·근거를 기록했습니다. 사업지별 공고의 도로 한정 지정과 서울시 전체 지목 도로에 관한 제2026-2810호를 상세에서 각각 확인할 수 있습니다. 개별 필지 적용은 해당 공고의 관계도면·토지조서가 기준입니다. [서울부동산정보광장](https://land.seoul.go.kr/) · [서울시 제2026-2609호](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=641002)
- 용도지역은 2026년 9월 11일 배포된 서울시 `UPIS_C_UQ111`을 사용했습니다. 참고 외곽이 있는 대상지는 경계 안쪽과 용도지역 도형의 교집합에서 내부 여유 5m를 확인한 명칭을 표시합니다. 대표점만 있는 대상지는 용도지역 경계와 5m를 초과해 떨어진 점을 대조하고 단일 명칭일 때만 표시합니다. 가장자리의 좁은 부분은 누락될 수 있습니다. 종상향은 별도의 관리계획 근거를 기록하며, 합정동은 기존·계획 면적과 개별 사업시행인가 시 결정된다는 조건을 함께 표시합니다. [서울시 용도지역 공간정보](https://data.seoul.go.kr/dataList/OA-21136/F/1/datasetView.do) · [합정동 관리계획 고시 제2026-111호](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631937)

필드 출처는 `field_evidence`, 지번 색인은 파일 단위 `evidence`, 범위별 고시는 이력 항목의 `evidence`에 있습니다. 원자료 작성일을 확인할 수 없는 실시간 서비스는 `source_as_of: null`로 두고 `checked_on`에 실제 열람일을 기록합니다. [보강 결과 및 수동 검수 대상](./data-enrichment-2026-11-24.md)

## 세부 사업구역 및 대표 필지

2026년 11월 24일 스냅샷에 61개 대상지의 세부 구역 167개를 연결했습니다. 대상지의 `sub_areas`는 같은 스냅샷 `zones.json`의 ID 목록입니다. 고시의 도면 표시번호, 대표 지번, 면적, 세대수는 개별 행에 연결합니다. 세대수의 관리계획 기준일과 실제 추진단계의 근거일은 각각 기록합니다. 분리안과 개별시행안이 함께 수록된 경우 적용한 시나리오를 기록했습니다. [대상지별 고시와 검수 결과](./sub-area-review-2026-11-24.md)

신월동 102-33의 A1~A4는 서울시 고시 제2023-606호 추진계획표와 임대주택 공급계획표에서 확인했습니다. A1의 세대수는 2026년 11월 심의에서 바뀌었습니다. A2와 A3는 조합 인가 고시의 필지 목록과 면적으로 대조했습니다. A4의 단계에는 확인한 구의회 회의일을 표시합니다. [관리계획 고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584443) · [서울시 통합심의 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=470317) · [A2 인가 고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=644883) · [A3 인가 고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=640660) · [양천구의회 회의록](https://www.ycc.go.kr/record/main?code=E010&uid=8618&view=full_view)

대표 지번 핀은 자치구·법정동·본번·부번이 일치하는 서울시 지적 필지의 내부점입니다. 고시 지번이 색인에 없으면 구역 카드는 유지합니다. 공간자료의 위치, 대표 필지와 사업 면적까지 대조된 구역은 참고 경계를 별도로 제공합니다. [서울 부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do) · [서울시 사업지 공간자료](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do)

### 신월동 고시 도면에서 옮긴 경계 7곳

신월동 102-33의 A2·A3는 양천구 조합설립인가 고시 PDF 3쪽의 붉은 사업시행구역선을 따릅니다. 도면 속 지적선을 서울시 지적 필지에 맞춘 뒤, 좌표 맞춤에서 제외한 A2의 16필지와 A3의 29필지로 위치를 점검했습니다. 검사 필지의 선에서 도면 잉크까지 거리의 95백분위는 각각 0.46m와 0.12m입니다. 이 값은 배경 지적선의 정합 지표입니다. [A2 인가 고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=644883) · [A3 인가 고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=640660) · [서울 부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do)

신월동 102-33의 A4는 승인고시 9쪽 토지이용계획도에서 B1 공원을 포함하는 사업가능구역선을, 신월동 173의 A1~A4는 정정고시 12쪽 토지이용계획도에서 사업가능구역 색면을 읽었습니다. 같은 쪽 관리지역 결정도의 외곽을 서울시 관리지역 공간자료에 맞추고, 네 구역의 대표 필지점이 각각 하나의 구역에만 들어가는지 확인했습니다. [신월동 102-33 관리계획](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584443) · [신월동 173 관리계획 정정고시](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=594579) · [서울시 공간자료](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do)

구역별 `boundary_evidence`에는 고시번호·기준일·PDF 쪽수·원본 해시·좌표 변환 계수를 기록했습니다. 도면 계측 면적과 문서상 면적은 별도로 보관하며 사업규모 카드에는 문서상 면적을 표시합니다. [구역별 면적 대조표](./sub-area-review-2026-11-24.md#신월동-경계-대조)
