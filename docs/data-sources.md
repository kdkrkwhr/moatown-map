# 데이터 출처와 수집 범위

2026.11.25 기준 지도에는 대상지·후보지 142곳, 세부 사업구역 224곳을 수록했다. 상세 화면의 사업성 지표는 해당 고시·공람안·사업개요의 적용 범위와 기준일을 따른다. 주택 공급표, 용도지역 결정조서, 권리산정 고시, 사업시행인가와 폐지 고시를 대조했고, 공고에 명시된 신규 후보지 4곳은 선정일을 비워 두었다. [11월 25일 검수 결과와 전후 비교](data-audit-2026-11-25.md) · [서울시보](https://event.seoul.go.kr/seoulsibo/) · [토지거래허가구역 지정현황](https://land.seoul.go.kr/land/other/appointStatusSeoul.do)

세부 사업구역의 색은 각 구역 원자료의 추진 단계를 따릅니다. 확인일과 단계 변경일은 구분합니다. 번동 429-114의 통합심의 통과, 사업시행계획인가, 착공 행사 연월은 [서울시 2024년 12월 16일 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=424981)에 근거한 번동 모아주택 1~5구역 공동 이력입니다. 기간은 연월 단위 차이로 계산합니다.

이 저장소의 데이터는 시·구 공식 원문에 연결되는 **초기 부분 스냅샷**입니다. 행 수는 이 저장소에서 대조해 넣은 기록 수이며, 오늘 서울시에서 추진 중인 전체 사업 수나 최신 확정 수가 아닙니다.

## 사업 소식 아카이브

2026.11.25 기준 공식자료 122건과 언론 보도 48건을 수록했다. 가장 이른 자료는 2022.01.14 서울시의 모아주택 시범사업 발표다. 토지이음의 관리계획·세부구역 고시 90건은 원문에서 제목, 발령기관, 고시번호, 고시일을 대조했다. 서울시와 강남구의 발표·주민공람, 연합뉴스·뉴시스·아시아경제·한국경제의 과거 기사도 발행처에서 확인했다. [사업 소식](https://moatownmap.com/news.html) · [서울시 시범사업 발표](https://mediahub.seoul.go.kr/archives/2003618) · [대청마을 주민의견조사](https://www.gangnam.go.kr/board/union6/42/view.do?mid=ID02_01130505)

소식의 날짜는 원문 게시일 또는 고시·공고일이다. 이번에 추가한 자료에는 원문 확인일도 기록했다. 한 자료가 여러 지역을 다루면 한 번만 수록하고, 원문에서 대상지나 세부구역을 식별할 수 있는 곳에 연결했다. 기사 제목에 등장하는 계획과 전망은 보도 당시의 내용이다. [번동 착공 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=424981) · [신월동 1구역 시공사 선정 보도](https://www.yna.co.kr/view/AKR20250831022500003)

## 어떤 자료를 사용했나

### 참고 노후도와 권리산정기준일

2026년 기준 대상지 108곳과 세부구역 62곳의 20년·30년 이상 비율을 계산했다. 분모는 참고 경계에 건물 전체가 들어오는 수록 건물 수다. 경계를 걸치는 건물과 반경 150m 주변 건물은 분모에서 제외한다. 사용승인연도 미상은 분모에만 포함하므로 연식이 확인된 노후 건물의 최소 비율이다. 구역별 사용승인연도 미상·전체·20년 이상·30년 이상 동수를 함께 보관한다. 예를 들어 신월동 102-33은 내부 294동 중 30년 이상 245동(83.3%), 20년 이상 272동(92.5%), 연식 미상 9동이다. 기존 3D 통계의 연식 확인 285동을 분모로 쓰는 86.0%와 기준이 다르다. 고시에 발표된 법정 노후도는 별도 항목이다. [GIS건물통합정보](https://www.data.go.kr/data/15083092/fileData.do) · [건축물대장 표제부](https://data.seoul.go.kr/dataList/OA-22424/S/1/datasetView.do)

대상지 마스터의 `rights_base_date`와 `rights_notice_no`는 전체 대상지에 적용되는 검수된 단일 기준일과 근거 고시다. 실효·제척·추가 편입·기한 연장 이력은 규제 탭의 적용 범위별 기록으로 제공한다. 시보 기준일 후보는 검수용 CSV에만 저장한다. 시보 본문의 텍스트 추출이 가능한 범위에서 구역명·지번과 기준일 문구를 대조하며 스캔본이나 표의 행이 섞일 수 있는 경우 원문 검토가 필요하다. [서울시보](https://event.seoul.go.kr/seoulsibo/) · [검수 후보 CSV](../data/rights_base_date_draft.csv)

로컬에서 `uv run --with geopandas python scripts/calculate_aging_rate.py`를 실행하면 현재 스냅샷의 대상지·세부구역 파일을 갱신한다. `--check`는 결과만 대조한다. 권리산정 자료는 `uv run --with pymupdf --with beautifulsoup4 python scripts/fetch_rights_date.py`로 검색한다. `--url`로 정보몽땅 등 기관의 HTML·PDF를 추가할 수 있고 `--catalog`, `--text-dir`로 시보 목차와 추출된 본문을 재사용할 수 있다. 후보 CSV 사본에서 날짜와 근거 고시를 확인한 뒤 전체 대상지에 적용되는 행만 `scope=전체`, `review=승인`으로 표시한다. `python scripts/fetch_rights_date.py --merge 검수본.csv`로 병합하거나 `--sync`로 기존 검증값을 동기화한다. 마스터 갱신 후 `node scripts/sync-pilot.mjs`, `node scripts/build-sitemap.mjs`, `node --test`를 실행한다.

2026.11.26에 사업계획 3D 96곳 중 92곳에서 시설 위치를 볼 수 있도록 갱신했다. 86곳은 부지·경로를 표시하며, 6곳은 고시 조서의 대표 지번을 서울시 지적도에 대조해 위치만 표시한다. 4곳은 위치를 보류했다. 시설 도면과 기준일, 공람안의 적용 범위, 도면 좌표를 맞춘 방법 및 대상지별 보류 근거를 기록했다. [96곳 검수 결과](./3d-public-space-audit.md) · [시흥3동 972 재공람 자료](https://news.seoul.go.kr/citybuild/archives/543800)

초기 수록 6곳에는 36개 도형이 있다. 신월동 102-33의 10개에 번동 429-114의 5개, 면목동 86-3의 7개를 더했다. 번동과 면목동은 주거동을 판독한 동일한 배치도와 좌표 변환을 사용했다. 도면에 폭이 없는 보행로는 중심선으로 표시한다. 면목동 어린이공원·주차장은 복합 부지의 지상 위치를 표시한다. [번동 서울시 배치도](https://www.seoul.go.kr/news/news_report.do?nttNo=393720) · [면목동 서울시 배치도](https://www.seoul.go.kr/news/news_report.do?nttNo=468710)

시흥3동 1005의 도로 2개, 대흥동 535-2의 도로 2개와 어린이공원 1개, 망원동 456-6의 도로 9개는 서울시 시설 도형을 참고 경계로 잘랐다. 서울 전체 142곳의 관리계획 기록을 기준으로, 도시계획 결정고시 자료의 발령기관·고시번호·고시일과 시설의 고시관리코드를 연결하고 경계 교차를 확인했다. 2026년 9월 공개본의 도로·공간시설·공공문화체육시설·도로외 교통시설을 대조했다. 경계가 있는 곳은 108곳이다. 10㎡ 미만의 경계 접촉은 제외했다. 시설 도형·자료 기준일·출처는 대상지별 파일에 있다. 자동 배치에서는 이 부지를 비워 둔다. [시설 파일](../moatown-data/plans/public-spaces/) · [도시계획 결정고시](https://data.seoul.go.kr/dataList/OA-20283/S/1/datasetView.do) · [도시계획시설 도로](https://data.seoul.go.kr/dataList/OA-21134/F/1/datasetView.do) · [공간시설](https://data.seoul.go.kr/dataList/OA-21129/F/1/datasetView.do)

건축 후 3D의 초기 수록지는 신월동·번동·면목동이다. 번동은 2023.07.31 서울시 사업인가 발표의 배치도 6쪽에서 주거동 13동을, 면목동은 2026.10.23 통합심의 발표의 건축배치도에서 19동을 판독했다. 각 도형에 동별 도면 최고 층수를 기록하고 파일에 출처, 기준일, 지도 좌표로 변환한 방식과 원본 이미지 해시를 보관했다. 면목 4·6구역의 표시 층수는 2026.10.29 후속 공람 상한까지로 제한했다. [번동 사업인가 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=393720) · [면목동 통합심의 배치도](https://www.seoul.go.kr/news/news_report.do?nttNo=468710) · [중랑구 후속 공람](https://news.seoul.go.kr/citybuild/archives/543800) · [구역별 검수 결과](3d-pilot-results.md)

서울 전역 건축 후 예상 3D는 대상지별 참고 외곽, 개별 사업구역 도형, 서울시 대상지 기록 및 승인·변경고시, 통합심의, 조합 사업개요를 대조해 생성한다. 대상지 전체 계획과 세부구역별 계획은 각각 별도 장면을 사용한다. 세대수·최고 층수·동 수의 기준일과 근거 URL은 각 자료에 기록하며, 공개 층수를 확인할 수 없는 경우 뷰어에 20층 예시 상한을 명시한다. 새 계획과 기존 도형의 적용 범위가 달라진 구역은 상세 패널에 계획 원문과 보류 이유를 표시한다. [전체 대상지 수록·보류 현황](3d-plan-coverage.md) · [서울시 대상지 기록](../moatown-data/plans/citywide-town-programs.json) · [변경고시·통합심의 등 추가 원문](../moatown-data/plans/supplemental-town-programs.json) · [개별 사업구역 계획 원문](../moatown-data/plans/citywide-zone-programs.json)

기존 건물 3D는 참고 경계가 있는 서울 108곳을 수록한다. 대상지와 150m 주변의 GIS건물통합정보 외곽에 서울시 표제부를 건물 단위로 연결하고, 원본 도형을 양방향으로 대조해 층수를 보충했다. 이웃 대상지의 중복을 제외한 74,966동 중 65,257동에서 대장 속성, 57,926동에서 지붕 분류를 확인했다. 건물 원자료 기준일은 2024.12.31이다. [대상지별 높이·누락·보류 목록](3d-city-results.md) · [건물 도형 색인과 원본 해시](../moatown-data/buildings/index.json)

2026.11.25에 지번·등록 면적·공식 명부와 대조한 참고 외곽 5곳을 추가했다. 화곡6동 957은 고시의 957-1, 시흥5동 922-61은 고시의 922-16과 연결된다. 시흥5동은 변경고시에서 관리지역 면적 89,944㎡와 세부구역 8곳을 확인했다. 광진구 구의3동 587-58은 관리지역 고시, 자양2동 593과 자양동 663은 대상지 선정 단계의 외곽이다. 각 도형의 공식 자료 주소·기준일·식별자·대조 근거는 경계 파일에 기록했다. [서울시 도시계획사업 공간자료](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do) · [서울도시공간포털](https://urban.seoul.go.kr/view/html/PMNU1140000001) · [등록한 경계](../moatown-data/snapshots/2026-11-24/boundaries.geojson)

도로명주소 건물의 지상층수(`tl_sdw_buld.gro_flo_co`)는 두 원자료에서 도형이 서로 하나씩 대응하고 겹침 비율(교집합 면적 ÷ 합집합 면적)이 90%를 넘는 경우 사용했다. 원천 건물번호의 유일성과 다른 도형·수치지도의 충돌도 확인했다. 건물별 원자료 기록일과 응답 해시는 보충 자료에 있다. 기존 103곳의 높이 미확인 건물 6동에 층수를 추가했다. 이 중 3동은 외곽 외에 층수·승인연도·대장 상세가 모두 비어 있었다. [서울시 부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do) · [건물별 보충 근거](../moatown-data/buildings/heights)

둔촌동 446-2는 공간자료에 높이가 비어 있었지만, 필지·대장 식별자·도로명주소와 건물 도형을 대조해 같은 건물의 표제부 높이 11.8m를 확인했다. 도로명주소 자료의 4층도 일치한다. 뷰어에는 표제부 높이를 우선 표시하며 원자료 기록과 해시를 보존한다. [서울시 건축물대장 표제부](https://data.seoul.go.kr/dataList/OA-22424/S/1/datasetView.do) · [건물별 대조 근거](../moatown-data/buildings/registry-heights.json)

신월동 102-33 기존 건물은 GIS건물통합정보 건물 식별자로 995동에 용도·구조·사용승인일·지하층 수를 연결했다. 건축물대장 표제부와 일치한 924동에는 지붕 코드명과 행별 자료 수집일을 수록했다. 서울시 지도에서 도형을 대조해 27동의 층수와 환산 높이를 추가했다. 높이를 확인하지 못한 39동은 평면으로 표시한다. [자료별 기준일과 수집 결과](3d-pilot-results.md#신월동-정비-전-건물-보강) · [GIS건물통합정보](https://www.data.go.kr/data/15083092/fileData.do) · [서울시 건축물대장 표제부](https://data.seoul.go.kr/dataList/OA-22424/S/1/datasetView.do)

신월동 102-33의 ‘공식 조감도’는 서울시 관리계획 소개 페이지(2026.05.22 수정)에 실린 A1~A4 원본을 표시한다. A1 후속 통합심의 조감도는 2026.11.13 서울시 보도자료 PDF 4쪽 왼쪽에 있다. 시공사 선정안(5동·368세대)과 통합심의안(지하 3층·최고 13층·354세대)은 별도 기록으로 보관한다. [서울시 관리계획 소개](https://news.seoul.go.kr/citybuild/archives/538493) · [서울시 통합심의 보도자료](https://www.seoul.go.kr/news/news_report.do?nttNo=470317) · [그림별 이용 조건](../moatown-data/plans/sinwol/visuals.json)

신월 A3은 신월1동 99-1번지 일원 가로주택정비사업조합이 정보몽땅에 공개한 배치도에서 주거동 7개 형태의 위치와 날개 방향을 판독했다. 기준일 미표기인 조합 건축계획에는 지상 14층·지하 2층·642세대(분양 509·임대 133)가 기재돼 있다. 2026.09 공람안의 A3 592세대와 구분한다. 동별 층수와 입면은 추정해 표시한다. [조합 배치도](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=470900001596X74&div=posImage&stepSeCode=103) · [계획별 근거](../moatown-data/plans/sinwol/design-evidence.json) · [위치 판독 자료](../moatown-data/plans/sinwol/a3-layout.geojson)

신월 B1 어린이공원(3,000㎡), B2 사회복지시설(1,600㎡), 도로 6개 구간과 공공보행통로 2개 구간은 2023.12.28 승인고시 도면을 서울시 공간자료에 맞춰 좌표화했다. 면적·폭은 고시 수치를 기록했다. 도면 쪽수와 위치 검증 방법은 각 도형과 자료 파일의 메타데이터에 있다. [서울시 고시 제2023-606호](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584443) · [공간자료와 검증 기록](../moatown-data/plans/sinwol/public-space.geojson)

3D 시범 뷰어는 서울부동산정보광장의 GIS건물통합정보 도형과 대장 속성을 사용합니다. 건물의 원자료 기준일은 2024.12.31입니다. 사용승인연도를 확인한 내부 건물로 30년 이상 비율을 계산하고, 계획 높이와 용적률은 공고·심의안·사업개요 등 실제 근거 단위로 표시합니다. [건물 수집·검증 결과](3d-pilot-results.md) · [구역별 계획 근거](pilot-plan-sources.md) · [서울부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do)

| 자료 | 반영 기준 |
| --- | --- |
| [서울시 모아타운 추진 현황](https://news.seoul.go.kr/citybuild/moa-housing-town/policy/status) | 2026-03-31 기준 공식 명부의 번호가 부여된 132행(자치구 공모 88, 주민제안 44)을 기초로 사용. 알려진 공동행의 두 번째 주소는 별도로 보존하되 총계에 중복 반영하지 않음. 원문 페이지가 재접속 시 오류 또는 리디렉션을 반환할 수 있음. |
| [서울시 제10차 도시계획위원회 결과](https://www.seoul.go.kr/news/news_report.do?nttNo=459950) · [제12차 결과](https://www.seoul.go.kr/news/news_report.do?nttNo=462973) · 대상지별 공고 | 기준 명부 이후 확인된 선정 개별 기록의 근거. 공고일과 선정일은 다르며, 단순 후보지나 신청만 한 지역은 포함하지 않음. 기록별 출처는 JSON에 기재. |
| [서울시 정비사업 정보몽땅 취소현황](https://cleanup.seoul.go.kr/cleanup/view/moaTown.do) | 취소 자료 11건을 별도 파일에 기록. 기준 명부에서 확인된 광진구 자양2동 681번지는 지도용 명부에서 제외. 나머지 취소 건은 기초 명부에 포함되지 않았음. |
| [서울시 정릉동 공식 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=447946) | 기준 자료의 정릉동 226-1 자치구 표기를 공식 개별 발표에 따라 성북구로 대조 정정. |
| [번동1구역 사업 개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103) · [코오롱 공식 발표](https://www.kolon.com/kr/media/newsDtl?detailsKey=8301) | 초기 개별 구역의 공개 계획과 면적 구간, 시공사 발표를 별개 출처로 기록. 최신 인가 수치·전용 주택형의 세부 타입·최신 계약은 아닐 수 있음. |

서울주거포털의 2026-05-31 기준 요약 집계와 [서울시 2026-08 발표](https://www.seoul.go.kr/news/news_report.do?nttNo=464445)의 ‘추진 중’ 집계는, 각각 시점과 집계 조건이 다를 수 있습니다. 요약 수치만 가지고 최신 명부를 생성하거나 확인되지 않은 대상지 이름을 추정하지 않습니다.

## 2026-11-24 사업 정보 보강

- 서울시 권역별 아카이브 5곳의 승인고시 표를 기존 명부의 자치구·대표 지번과 대조했습니다. 대상지 59곳의 지번별 고시 60건에 고시일, 아카이브에 실린 사업구역 수, 대상지별 원문을 연결했습니다. 공동 선정된 등촌2동 두 지번은 각각 4곳과 2곳으로 기록했습니다. 당시 보류한 네 곳 중 화곡6동 957-1과 시흥5동 922-16은 2026.11.25 대조에서 명부 지번과 연결했습니다. 쌍문동 460과 목4동 728-1은 보류했습니다. [동북권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-northeast) · [서남권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-southwest) · [동남권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-southeast) · [서북권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-northwest) · [도심권](https://news.seoul.go.kr/citybuild/moa-housing-town/archive/seoul-downtown)
- 번동 1~5구역은 정비사업 정보몽땅의 구역별 사업개요에서 분양·임대 전용면적 구간별 세대수, 지상·지하 층수, 높이, 건폐율과 용적률을 확인했습니다. 번동1구역 임대는 40㎡ 초과~50㎡ 이하 12세대, 50㎡ 초과 18세대로 바로잡았습니다. 다섯 사업개요의 합계 1,182세대와 2024년 시공사 발표의 그룹 합계 1,242세대는 차이가 있어, 각 사업개요는 공개 당시 계획으로 표기합니다. [번동1구역 사업개요](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=305900000750u59&div=sumry&stepSeCode=103) · [코오롱글로벌 수주 발표](https://www.kolon.com/kr/media/newsDtl?detailsKey=8301)
- 면목본동 2·3·5구역은 HS화성의 공사계약 공시에서 계약일과 계약상대를 대조했습니다. 시공사명은 해당 계약 공시 기준입니다. [면목본동2구역](https://kind.krx.co.kr/external/2025/05/12/000236/20250508001227/91370.htm) · [3구역](https://kind.krx.co.kr/external/2025/12/22/000410/20251216001458/91370.htm) · [5구역](https://kind.krx.co.kr/external/2025/05/08/000393/20250429001918/91370.htm)
- 면목역 1·2구역은 중랑구의 2026년 7월 30일 고시와 첨부 주택형표를 대조했습니다. 인가일은 7월 28일입니다. 전용면적 소수점 네 자리와 원문 타입명을 보존하고, 전체 세대수와 별도로 조합원분양·일반분양·보류지 수를 기록했습니다. [면목역1구역 고시](https://eminwon.jungnang.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?context=NTIS&homepage_pbs_yn=Y&jndinm=OfrNotAncmtEJB&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=15567&not_ancmt_se_code=01%2C02%2C04&pageIndex=1&subCheck=Y) · [면목역2구역 고시](https://eminwon.jungnang.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?context=NTIS&homepage_pbs_yn=Y&jndinm=OfrNotAncmtEJB&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=15568&not_ancmt_se_code=01%2C02%2C04&pageIndex=1&subCheck=Y)

## 2026-11-24 2차 보강

`coverage.towns_with_plan_zoning`은 용도지역별 계획 면적(`zoning.areas[].planned_sqm`)이 한 건 이상 수록된 대상지 수입니다. 한 대상지에 용도지역이 여러 개 있어도 한 번만 셉니다. 기존 합정동 369 한 곳에 이번에 보강한 쌍문동 524-87과 쌍문동 494-22를 더해 총 3곳입니다.

- **관리계획 승인·변경 고시 연결.** [토지이음 고시정보](https://www.eum.go.kr/web/gs/gv/gvGosiList.jsp)에서 서울특별시 고시 제목 “모아타운 관리계획” 100건(2022-12-22~2026-10-29)을 받아, 고시일·고시번호와 제목의 자치구·동·본번·부번을 명부 지번과 대조해 78곳에 연결했습니다. 기존 68곳 가운데 48곳은 화면에 고시번호가 없던 기록에 고시번호와 고시 원문 주소를 채웠고, 나머지는 표기가 달라 그대로 두었습니다. 고시가 확인됐는데 추진 단계가 비어 있던 10곳은 `관리계획 승인고시`로 채우고 근거 고시를 `field_evidence.management_plan_stage`에 남겼습니다. 고시 제목이 “면목38동 44-6”, “중화1동 4-30”처럼 행정동 표기가 다르거나 “번지”를 생략한 4건은 제목과 지번을 직접 대조해 따로 연결했습니다. 화곡6동 957은 고시·공간자료 지번이 957-1이고 사업 면적이 같아 같은 사업으로 보고 연결 사유를 필드에 적었습니다.
- **토지거래허가구역 법정동 단위 지정.** [서울부동산정보광장 토지거래허가구역 지정현황(서울시)](https://land.seoul.go.kr/land/other/appointStatusSeoul.do) 2026-11-03 기준 표에서 “모아타운 및 인근지역” 138개소·지목 도로 한정 지정(최초 지정 2024-09-10)이 유지되고 있음을 확인하고, [서울특별시 공고 제2024-2557호](https://land.seoul.go.kr/land/other/downloadAppointPbancFile.do?fileUuid=59d9172df7b50038e063621d0f8d00381085122) 공고문의 자치구별 법정동 열거표(22개 구 59개 법정동)를 대조했습니다. 사업지 개별 공고가 없는 73곳에 대해 `designation_level: legal_dong`, 지정기간 2024-09-10~2029-09-09, 범위 “모아타운 및 인근지역 내 지목이 도로인 토지”로 기록했습니다. 이는 사업지 단위 지정이 아니며 개별 필지의 포함 여부는 공고 관계도면과 토지조서로 확인해야 합니다. 같은 표에서 2026-09-11·08-27·06-25·08-06 공고의 모아타운 후보지 목록도 확인했으나, 이후 추가 수집한 11개 항목의 범위와 대표 지번은 11월 25일 검수에 반영했습니다.
- **대표 위치 2곳 추가.** [서울 열린데이터광장 OA-22712](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do) 2026년 9월 배포본(`532_UQ120_도시계획사업(서울플랜+)_202609.zip`)을 내려받아 `UPIS_C_UQ120`의 `BZ200`(모아타운) 도형에서 화곡6동 957-1 일대(94,080.0㎡)와 일원동 대청마을 북측구역(90,992.0㎡)을 찾았습니다. 두 사업의 등록 면적을 명부·고시와 대조하고, EPSG:5174 도형 내부 대표점을 WGS84로 옮겨 대표 위치로 삼았습니다. 일원동은 등록 면적 90,992㎡와 도형 측정 면적 93,494.5㎡가 달라 대표 위치만 제공합니다. 명부 지번(본번만)은 지적도에 단독 필지가 없고 부번 필지만 있어 필지 내부점을 만들지 않았습니다. 남은 5곳은 본번 단독 필지도, 2026년 9월 공간자료의 사업 도형도 없습니다.
- **계획 용도지역 2곳.** [서울시보 제4016호](https://event.seoul.go.kr/seoulsibo/fileDownload.do?fileName=seoulsibo_20241017085543_69127.pdf)(2024-10-17) 고시 전문에서 쌍문동 494-22(고시 제2024-491호, 107쪽)와 쌍문동 524-87(고시 제2024-492호, 131쪽)의 「용도지역·용도지구의 지정 및 변경 계획(안)」표를 옮겨 기정·변경후 면적을 `zoning.areas`와 `zoning.plan_totals`에 넣었습니다. 두 고시 모두 “사업시행구역 내 개별 사업시행계획인가 시 결정” 조건이 붙어 있어 `zoning.condition`에 함께 적었습니다. 나머지 관리계획 고시의 계획 용도지역은 토지이음 첨부 PDF 내려받기가 서버 오류(HTTP 500)로 막혀 전수 파싱하지 못했습니다. 같은 이유로 종상향 여부도 확인된 2곳 외에는 비워 두었습니다.

## 아직 없는 데이터

- 최신 서울시 선정 명부 전수 대조, 이후 취소·분할·명칭 변경 전체 이력.
- 사업구역별 목표 세대수·층수·전용 주택형·시공사 전수 자료. 모아타운 전체 숫자로 하위 구역 값을 채우지 않습니다.
- 대상지별 미확인 대표 위치·참고 경계, 전 지역의 법정 사업구역 경계. [서울 열린데이터광장 도시계획 GIS](https://data.seoul.go.kr/dataList/OA-22712/F/1/datasetView.do)의 도형은 위치 참고용이며, 실제 경계는 관할기관의 최신 지형도면과 맞춰야 합니다. 도로 한정 토지거래허가 경계를 모아타운 사업 경계로 사용하지 않습니다. 2026-11-24 기준 대표 위치가 없는 대상지는 5곳입니다.
- 관리계획 고시에 붙은 계획 용도지역·종상향 표는 확인된 2곳 외에는 옮기지 않았습니다. 고시 원문은 토지이음 첨부 PDF에 있는데 내려받기가 서버 오류를 반환합니다.
- 토지거래허가구역은 121곳 가운데 48곳이 사업지 개별 공고, 73곳이 법정동 단위 지정 기록입니다. 법정동 단위 기록은 개별 필지 포함 여부를 판정하지 않습니다. 나머지 17곳은 공고문 법정동 목록 밖이거나 법정동을 확정하지 못했습니다.
- 세부 사업구역 중 조합원분양·일반분양·임대 물량을 모두 대조한 곳은 2곳입니다. 미확인 항목은 [검수 목록](../moatown-data/snapshots/2026-11-24/review.json)에 있습니다.

공공 원문의 주소·날짜·면적 등 사실을 정규화하여 저장하며, 원문 문안·지도 이미지·도형 원본은 포함하지 않습니다. 공간데이터를 추가할 때 배포 허용 범위와 출처 표기를 먼저 확인합니다.

## 대표 지번 핀

서울 25개 자치구의 법정동·지번 896,467개를 조회할 수 있습니다. 2026년 11월 24일 서울부동산정보광장 공개 지도에 쓰이는 WFS의 `landbiz:ln_parcel`에서 자치구별로 정렬·페이지 조회했습니다. 896,694개 원본 피처의 번호와 응답 건수를 대조했습니다. 유효한 19자리 PNU, 법정동코드, 산 구분, 양수 본번, 도형 내부 검증을 통과한 고유 필지점만 저장했습니다. 227개 원본 행을 제외했습니다. 자치구별 수록 건수·제외 사유·서버 응답 시각은 [색인 명세](../moatown-data/addresses/index.json)에 있습니다. [서울부동산정보광장](https://land.seoul.go.kr/land/map/land/map.do) · [행정표준코드관리시스템](https://www.code.go.kr/)

서버가 명시한 EPSG:5179에서 도형 내부 대표점을 계산해 WGS84 경도·위도로 변환하고 소수점 일곱 자리로 반올림했습니다. 역변환한 점이 원본 필지 안에 있는지 다시 확인했습니다. 원 서비스가 필지별 지적 정리일을 제공하지 않아 수집일과 원자료 기준일을 구분했습니다. 자치구가 생략된 동명이 겹치면 자치구 입력을 요청합니다. 조회 결과는 **필지 내부 대표점과 수록된 참고 외곽**의 관계입니다. 경계에서 양방향 5m 이내는 별도로 표시합니다. 참고 외곽을 확보하지 못한 대상지의 필지 판정은 보류합니다.

마포구 2026년 8월 28일 자료의 기존 파일 `addresses/mapo.json`은 이전 자료를 참조하는 사용자를 위해 보존합니다. [마포구 지적도](https://www.data.go.kr/data/15162460/fileData.do)

## 사업 단계와 비교 기간

대상지 관리계획과 세부 구역 추진 단계는 각각 검색합니다. 취소 11건은 원문과 날짜가 있는 이력에서 조회합니다. 선정월과 승인고시일이 확인되고 하나의 승인고시가 연결된 대상지 57곳에서 두 시점의 달력 월 차이 평균은 24.1개월입니다. 2026-11-24 2차 보강으로 고시가 추가 연결되면서 단일 고시 표본이 67곳에서 57곳으로 바뀌어 값을 다시 계산했습니다. 비교 카드에는 같은 표본의 평균과 크기를 함께 표시합니다. 공동 선정 지번에 복수 고시가 있는 사례는 제외합니다.

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

## 시공사 선정자료 대조 (2026.11.24)

세부 구역 167곳 중 시공사를 수록한 곳이 22곳에서 42곳으로 늘었다. 기존 미입력 145곳을 서울시 사업장 목록과 대조하고, 주소 등으로 연결된 후보 37곳의 공개 협력업체·추진경과와 별도 수주 발표·공시·선정총회 보도를 확인했다. 구역별 근거와 원자료 기준일은 `field_evidence.selected_contractor`에, 남은 125곳은 검수 목록에 기록했다. 대상지 화면에는 시공사가 확인된 세부 구역 수와 업체명을 표시한다. [서울시 사업장 목록](https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do?cpage=1&pageSize=2000) · [검수 목록](../moatown-data/snapshots/2026-11-24/review.json)

| 대상지 | 이번에 확인한 세부 구역과 시공사 | 대표 근거 |
|---|---|---|
| 양천구 신월동 102-33 | A1 호반건설. 2025.08.30 조합총회 선정 | [호반건설 홍보센터](https://www.ihoban.co.kr/pr/news-list/web?searchCondition=subject&searchKeyword=%EC%8B%A0%EC%9B%94%EB%8F%99) · [선정총회 보도](https://www.yna.co.kr/view/AKR20250831022500003) |
| 중랑구 중화동 329-38 | 2-1·2-2·2-3 DL건설, 2-5 계룡건설산업 | [DL건설 발표](https://dlconstruction.co.kr/mobile/zInformation/sh_news_view.asp?SE_IDX=1483) · [2-5 도급계약](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250321801394) |
| 마포구 성산동 160-4 | A-1·A-3·A-4 대우건설 | [대우건설 발표](https://daewooenc.com/news/news-view?idx=15642) |
| 구로구 고척동 241 | A-1·A-2 계룡건설산업, A-4·A-5·A-6 동부건설 | [A-1 공시](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260917800214) · [고척2구역 인가](https://www.guro.go.kr/www/selectBbsNttGosiView.do?bbsNo=663&nttNo=46445) · [4·5·6구역 공사도급약정](https://kind.krx.co.kr/external/2025/06/30/000586/20250627000569/91370.htm) |
| 은평구 대조동 89 | A2·A3 한신공영 | [A2 선정 이력](https://cleanup.seoul.go.kr/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId=380900001231S07&bsnsPk=11380-900001231) · [A3 선정 이력](https://cleanup.seoul.go.kr/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId=380900001330r41&bsnsPk=11380-900001330) |
| 중랑구 면목동 152-1 및 139-52 | 면목역 3의1 코오롱글로벌, 면목역 2의1 BS한양 | [3의1 선정 이력](https://cleanup.seoul.go.kr/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId=260900000969R96&bsnsPk=11260-900000969) · [2의1 선정 이력](https://cleanup.seoul.go.kr/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId=260900001221s83&bsnsPk=11260-900001221) |
| 성북구 석관동 334-69 | 석관1의1 ㈜한화 건설부문. 재선정 업체를 확인 | [조합 선정 이력](https://cleanup.seoul.go.kr/cafe/mainIndx/cleanup-prtnelapse/vscr.do?cafeId=290900000962y86&bsnsPk=11290-900000962) · [한화 발표](https://www.hanwha.co.kr/newsroom/media_center/news/news_view.do?seq=16446) |
| 강서구 화곡1동 354 | A2-2 제일건설. 2026.08.22 선정총회 | [조합 공개 현황](https://cleanup.seoul.go.kr/assc/bbs/lscrKyulOpenDataList.do?cafeId=500900001447U62) · [선정 결과 보도](https://news.nate.com/view/20260824n11563) |
| 금천구 시흥3동 1005 | 중앙시흥하이츠 한화. 2025년 2월 업무계획의 업체 표기 기준 | [금천구의회 업무계획 PDF 76쪽](https://council.geumcheon.go.kr/council/viewer/minutes/pdf.do?group=appendix&uid=5722) |

고척 A-2는 구로구 고시의 고척2구역 조합명과 사업 대표 지번(241-23)을 확인하고 관리계획 지번(241-177)의 필지점이 서울시 해당 사업 도형 내부에 있는지 확인했다. 고척 4·5·6구역은 공시 계약명에 세 구역이 명시되어 있다. 석관1-2·1-7의 한화 수주와 화곡 제2-4의 제일건설 선정은 원문 사업장 단위로 확인했으나, 현재 지도 구역번호와 계약 적용 범위를 더 대조해야 하는 건을 `contractor_scope_review`에 남겼다.
