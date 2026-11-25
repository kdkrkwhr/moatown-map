# 네이버 지도와 참고 경계

배경은 네이버 지도 JavaScript API v3의 일반 지도와 위성 지도(HYBRID)입니다. 지적편집도는 두 지도에서 독립적으로 켤 수 있습니다. 위성·지적편집도 설정은 `?map=hybrid&cadastral=1`로 공유할 수 있습니다. 기존 도로 지도 링크는 일반 지도로 연결됩니다.

줌 12까지는 자치구별 수록 대상지 수와 하위 구역의 단계별 비율을 보여줍니다. 줌 13부터는 구역명과 단계별 폴리곤이 나타납니다. 경계는 서울시 공개 공간자료에 기반한 참고 외곽입니다. 필지의 법정 포함 여부는 관할 기관의 최신 고시에서 확인하세요.

거리 재기는 두 지점의 직선거리를 네이버 지도 투영 좌표로 계산합니다. 도보 시간은 분당 67m를 적용한 추정값입니다. 실제 보행 경로와 소요 시간은 달라질 수 있습니다.

카카오 우편번호 서비스에서 선택한 서울 주소는 네이버 Geocoding으로 좌표를 조회합니다. 좌표가 있는 주소는 Turf로 수록된 서울 전체 대상지 외곽과 비교하며 경계 5m 이내를 구분합니다. 마포구 지번은 자체 색인을 먼저 조회합니다. 공개 Maps Client ID의 Web 서비스 URL에 배포 주소 `https://moatownmap.com`을 등록하고 Dynamic Map과 Geocoding 사용 권한을 각각 설정합니다. [네이버 Maps 애플리케이션 설정](https://guide.ncloud-docs.com/docs/maps-app/) · [네이버 지도 SDK](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)

## 서울 지도 원자료

- 자치구 참고 배경과 한글 자치구 이름: [서울시 도로굴착 관리구 경계 공간정보](https://data.seoul.go.kr/dataList/OA-21184/F/1/datasetView.do), 공식 목록에 이용허락범위 제한 없음으로 표시(서울특별시 출처를 표기). 위치 라벨은 구 도형 내부에 두었습니다.
- 도로 및 물 표면: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. [OSM Korea의 서울 추출 데이터](https://tiles.osm.kr/download/), 도로·물은 지도를 위한 일부 형상만 단순화했습니다. 한강 수면은 같은 배포처의 전국 추출에서 [관계 152336](https://www.openstreetmap.org/relation/152336)과 [관계 3769500](https://www.openstreetmap.org/relation/3769500)을 합쳐 서울 시야로 잘라 사용합니다.

GeoJSON 안에서도 행정구역과 배경 도로·물은 별도 기능으로 구분합니다. OpenStreetMap에서 가공한 도로·물 기능은 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)으로 제공하며, 서울특별시 행정구역 데이터는 별도 출처입니다.
