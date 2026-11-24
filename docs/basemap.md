# 배경지도 출처와 표시 원칙

**서울 지도**는 사업 경계가 눈에 잘 띄도록 행정구역, 한강 및 주요 도로만 보여 주는 간략 배경입니다. 사업 데이터 스냅샷과 별도로 moatown-data/basemap/seoul-context.geojson에 보관합니다. 화면의 출처 표시는 배경에 사용된 원자료에 따라 달라집니다.

**기존 지도**는 [OpenFreeMap](https://openfreemap.org/) Positron, [OpenMapTiles](https://openmaptiles.org/) 및 [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) 데이터를 사용합니다. 상세 배경이 로드되지 않으면 OSM 래스터로 전환할 수 있습니다. 서울 지도는 사이트 내부 정적 파일만 읽고 외부 타일을 요청하지 않습니다.

상단 버튼은 카메라와 선택한 대상지·사업구역을 그대로 둔 채 배경만 바꿉니다. 서울 지도 비교 링크는 저장소 경로 아래의 ?map=quiet입니다. 지도에서 보이는 어떤 경계도 법정 고시 원문을 대신하지 않습니다.

## 서울 지도 원자료

- 자치구 참고 배경과 한글 자치구 이름: [서울시 도로굴착 관리구 경계 공간정보](https://data.seoul.go.kr/dataList/OA-21184/F/1/datasetView.do), 공식 목록에 이용허락범위 제한 없음으로 표시(서울특별시 출처를 표기). 위치 라벨은 구 도형 내부에 두었습니다.
- 도로 및 물 표면: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. [OSM Korea의 서울 추출 데이터](https://tiles.osm.kr/download/), 도로·물은 지도를 위한 일부 형상만 단순화했습니다. 한강 수면은 같은 배포처의 전국 추출에서 [관계 152336](https://www.openstreetmap.org/relation/152336)과 [관계 3769500](https://www.openstreetmap.org/relation/3769500)을 합쳐 서울 시야로 잘라 사용합니다.

GeoJSON 안에서도 행정구역과 배경 도로·물은 별도 기능으로 구분합니다. OpenStreetMap에서 가공한 도로·물 기능은 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)으로 제공하며, 서울특별시 행정구역 데이터는 별도 출처입니다.
