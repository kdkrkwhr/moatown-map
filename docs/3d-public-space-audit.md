# 사업계획 3D 공원·도로·보행공간 검수

2026.11.26 기준. 전체 142개 대상지 중 사업계획 3D가 열리는 96곳을 집계했다. 기존 6곳에 86곳을 추가해 92곳에서 시설 위치를 볼 수 있다.

| 표시 범위 | 대상지 수 |
| --- | ---: |
| 부지 또는 경로를 도형으로 표시 | 86 |
| 고시 조서의 대표 지번만 표시 | 6 |
| 시설 위치 보류 | 4 |

전체 242개 항목이다. 한 항목에 나뉜 도로 구간이나 여러 공원 부지가 함께 들어갈 수 있다. 보행통로나 보행자전용도로를 별도 항목으로 표시한 대상지는 19곳이다. [사업계획 3D 전체 수록 현황](./3d-plan-coverage.md)

## 자료와 판독 방법

- 승인·변경 고시, 주민공람안, 서울시 도시계획시설 또는 공식 배치도를 대상지와 대조했다. 시설마다 해당 문서의 날짜와 링크를 수록했다. 주민공람안에서 가져온 배치는 이후 심의·인가에서 달라질 수 있다.
- 도면의 시설 범례와 대상지 경계선을 대조한 후 부지와 보행 경로를 EPSG:5179에서 지도 좌표로 변환했다. 이번에 새로 위치를 맞춘 도면의 경계선 거리 오차는 중앙값 2.1m 이하, 95백분위 6m 이하를 적용했다. 수록 파일의 drawings에 판독한 도면, 변환 계수, 판독 이미지의 SHA-256 및 경계 잔차가 있다. 이 수치는 도면과 수록 경계의 정합 정도다.
- 주거동 가상 배치에서는 수록한 시설 부지와 통로 경로를 비웠다. 도면에 통로 폭이 명시된 경우 그 폭을 적용했다. 시설 면적을 위치로 옮길 근거가 부족하면 고시 조서의 지번을 서울시 지적도에 대조해 필지 내부점에 이름을 표시했다.
- 시흥3동 972는 재공람 결정도의 공공보행통로와 공고문의 폭 6m를 함께 확인했다. 공람안은 통로 선형을 지정 위치 중심에서 양측 10m 범위 내에서 조정할 수 있다고 명시한다. [금천구 재공람 공고가 실린 서울시 자료](https://news.seoul.go.kr/citybuild/archives/543800)

## 위치 확인을 보류한 4곳

| 자치구 · 대상지 | 확인한 내용과 보류 이유 | 자료 |
| --- | --- | --- |
| 중랑구 면목2동 139-52 | 면목역2의1구역의 조합과 사업장은 확인했다. 수록 범위 안 시설을 특정할 배치도나 시설 조서가 필요하다. | [기관 자료](https://cleanup.seoul.go.kr/cleanup/bsnssttus/lsubBsnsSttus.do?cpage=12&pageSize=100) |
| 성동구 응봉동 265 | SH 업무보고에서 두 구역의 계획 규모를 확인했다. 공원·도로의 위치와 형태를 대조할 시설계획도가 필요하다. | [기관 자료](https://ms.smc.seoul.kr/record/appendixDownload.do?key=e25a852e59718208ff328964a368ec2ca59952d5099dd0fff0b7001609f8aad327950e10edaf6fd6) |
| 성북구 종암동 125-1 | 종암동 125-1 조합의 사업개요를 확인했다. 인접 재개발의 공공공지 및 보행축과 구분되는 해당 구역 도면이 필요하다. | [기관 자료](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=290900001405i75&div=sumry&stepSeCode=102) |
| 서대문구 홍은동 11-360 | 구의회 자료에 배치도 수록 기록이 있다. 조합의 배치도 첨부파일은 404를 반환했다. 시설을 구분하고 좌표를 대조할 원본이 필요하다. | [기관 자료](https://cleanup.seoul.go.kr/cafe/mastr-cleanup-bsnsSumry/execute.do?cafeId=410900000979r02&stepSeCode=103&div=posImage) |

## 시설 위치 수록 대상지

| 자치구 · 대상지 | 표시 방법 | 수록 항목 | 출처 |
| --- | --- | --- | --- |
| [강동구 천호동 113-2](https://moatownmap.com/towns/mt-202603-public-057/?view=3d&mode=after) | 부지·경로 | 도로 · 주차장 · C구역 공공보행통로 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260624163152_83531.pdf#page=63) |
| [강동구 천호동 338번지](https://moatownmap.com/towns/mt-202603-resident-027/?view=3d&mode=after) | 부지·경로 및 위치 표시 | 확폭 도로 · 구역 내 구간 · 지하 공영주차장 예정지 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260624163152_83531.pdf#page=90) · [원문 2](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260624163152_83531.pdf#page=81) |
| [강북구 번동 411](https://moatownmap.com/towns/mt-202603-public-036/?view=3d&mode=after) | 부지·경로 | 공원 · A1·A2 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=597544) |
| [강북구 번동 429-114](https://moatownmap.com/towns/mt-202603-public-034/?view=3d&mode=after) | 부지·경로 | 단지 중앙 10m 도로 · 1·2구역 사이 공공보행통로 · 2·3구역 사이 보행자전용도로(입체결정) · 4·5구역 사이 보행자전용도로(입체결정) · 2구역 안뜰 순환 보행로 | [원문 1](https://www.seoul.go.kr/news/news_report.do?nttNo=393720) |
| [강북구 번동 454-61](https://moatownmap.com/towns/mt-202603-public-035/?view=3d&mode=after) | 대표 지번 | 샛강 어린이공원 이전 예정지 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260708113419_91414.pdf#page=48) |
| [강북구 수유동 392-9](https://moatownmap.com/towns/mt-202603-public-038/?view=3d&mode=after) | 부지·경로 | 공원 · 동서 공공보행통로 · 남북 공공보행통로 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260520112133_47006.pdf#page=6) |
| [강북구 수유동 52-1](https://moatownmap.com/towns/mt-202603-public-037/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=619723) |
| [강서구 공항동 55-327](https://moatownmap.com/towns/mt-202603-public-008/?view=3d&mode=after) | 부지·경로 | 공원·주차장 · 공공공지 · 어린이집·경로당 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=615059) |
| [강서구 등촌2동 515-44](https://moatownmap.com/towns/mt-202603-public-005/?view=3d&mode=after) | 부지·경로 | 어린이집 | [원문 1](https://www.gangseo.seoul.kr/comm/getFile?srvcId=MEDIA&upperNo=WEONkR8WSgb*9uvj0hTbBg%3d%3d&fileTy=MEDIA&fileNo=rsuFv6BGM0P1J6eeXHc1QQ%3d%3d) |
| [강서구 방화동 592-1](https://moatownmap.com/towns/mt-202603-public-007/?view=3d&mode=after) | 부지·경로 | 도로 소로 3-22 · 도로 소로 1-38 · 도로 소로 1-23 · 도로 소로 1-33 · 도로 소로 1-2 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=594582) |
| [강서구 화곡6동 1130-7](https://moatownmap.com/towns/mt-202603-public-006/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://news.seoul.go.kr/citybuild/archives/542643) |
| [강서구 화곡6동 957](https://moatownmap.com/towns/mt-202603-public-009/?view=3d&mode=after) | 부지·경로 | 공원 · 주차장 · 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=614147) |
| [강서구 화곡동 1087](https://moatownmap.com/towns/mt-202603-public-001/?view=3d&mode=after) | 부지·경로 | 공원 · 공공시설용지 · 청소년상담시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584446) |
| [강서구 화곡동 354](https://moatownmap.com/towns/mt-202603-public-002/?view=3d&mode=after) | 부지·경로 | 공원·주차장 · 주차장·공공청사 · 도로 · 보행자전용도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=645315) |
| [강서구 화곡동 359](https://moatownmap.com/towns/mt-202603-public-003/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584449) |
| [관악구 난곡동 697-20](https://moatownmap.com/towns/mt-202603-public-077/?view=3d&mode=after) | 부지·경로 | 동측 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=641915) |
| [관악구 성현동 1021](https://moatownmap.com/towns/mt-202603-public-074/?view=3d&mode=after) | 부지·경로 | 공원 · 사회복지시설 · 도로 | [원문 1](https://event.seoul.go.kr/seoulsibo/fileDownload.do?fileName=seoulsibo_20251226131847_53209.pdf#page=109) |
| [관악구 신림동 655-78](https://moatownmap.com/towns/mt-202603-resident-025/?view=3d&mode=after) | 부지·경로 및 위치 표시 | 도로 · 쌈지형공지 위치 표시 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=599593) |
| [관악구 은천동 635-540](https://moatownmap.com/towns/mt-202603-public-075/?view=3d&mode=after) | 부지·경로 | 공공공지 · 사회복지시설 · 공원 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260422155953_77596.pdf#page=65) |
| [관악구 은천동 938-5](https://moatownmap.com/towns/mt-202603-public-076/?view=3d&mode=after) | 부지·경로 | 공공공지 · 공공시설용지 · 공원 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260422155953_77596.pdf#page=83) |
| [관악구 청룡동 1535](https://moatownmap.com/towns/mt-202603-public-073/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631139) |
| [광진구 구의3동 587-58](https://moatownmap.com/towns/mt-202603-resident-008/?view=3d&mode=after) | 부지·경로 | A1·A2 사이 계획도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=644471) |
| [광진구 자양1동 226-1](https://moatownmap.com/towns/mt-202603-resident-006/?view=3d&mode=after) | 대표 지번 | 소공원 2 예정지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=640708) |
| [광진구 자양1동 772-1](https://moatownmap.com/towns/mt-202603-resident-005/?view=3d&mode=after) | 대표 지번 | 소공원 1 예정지 · 노외주차장 예정지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=640709) |
| [광진구 자양1동 799](https://moatownmap.com/towns/mt-202603-public-078/?view=3d&mode=after) | 부지·경로 | 어린이공원 · 남북 계획도로 · 공원 북측 계획도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639881) |
| [광진구 자양2동 649](https://moatownmap.com/towns/mt-202603-public-079/?view=3d&mode=after) | 부지·경로 | 도로 · 공원 · 사회복지시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639882) |
| [구로구 개봉동 270-38](https://moatownmap.com/towns/mt-202603-public-046/?view=3d&mode=after) | 부지·경로 | 공원 · 도로 | [원문 1](https://event.seoul.go.kr/seoulsibo/fileDownload.do?fileName=seoulsibo_20251217162958_75587.pdf#page=328) |
| [구로구 고척동 241](https://moatownmap.com/towns/mt-202603-public-044/?view=3d&mode=after) | 부지·경로 | 확폭 도로 · 공원 · 주차장 · 어린이집 · 단지 횡단 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=601972) |
| [구로구 구로동 511](https://moatownmap.com/towns/mt-202603-public-047/?view=3d&mode=after) | 부지·경로 | 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=628525) |
| [구로구 구로동 728](https://moatownmap.com/towns/mt-202603-public-045/?view=3d&mode=after) | 대표 지번 | 소공원 예정지 · 공영주차장 예정지 · 다목적 체육관 예정지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=602403) |
| [금천구 시흥1동 864](https://moatownmap.com/towns/mt-202603-public-027/?view=3d&mode=after) | 부지·경로 | 공원 · 어린이집 · 구역 간 계획도로 · 남북 계획도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=601822) |
| [금천구 시흥3동 1005](https://moatownmap.com/towns/mt-202603-public-024/?view=3d&mode=after) | 부지·경로 | 소로1류 · 소로2류 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584437) |
| [금천구 시흥3동 950](https://moatownmap.com/towns/mt-202603-public-028/?view=3d&mode=after) | 부지·경로 | 도로 · 공원 · 공공체육시설 · 주민센터 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=594346) |
| [금천구 시흥3동 972](https://moatownmap.com/towns/mt-202603-resident-023/?view=3d&mode=after) | 부지·경로 | 계획도로 · 공공보행통로 | [원문 1](https://news.seoul.go.kr/citybuild/archives/543800) |
| [금천구 시흥4동 817](https://moatownmap.com/towns/mt-202603-public-025/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631492) |
| [금천구 시흥5동 922-61](https://moatownmap.com/towns/mt-202603-public-026/?view=3d&mode=after) | 부지·경로 | 공원 · 주차장·복지시설 · 북측 공공보행통로 · 동측 공공보행통로 · 중앙 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=560543) |
| [노원구 상계2동 177-66](https://moatownmap.com/towns/mt-202603-public-049/?view=3d&mode=after) | 대표 지번 | 어린이공원 예정지 · 소공원 예정지 · 상계2동 공영주차장 (존치) · 상계2동청사 (존치) · 사회복지시설 (존치) | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584823) |
| [노원구 월계동 534](https://moatownmap.com/towns/mt-202603-public-050/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=614146) |
| [도봉구 방학동 618](https://moatownmap.com/towns/mt-202603-public-053/?view=3d&mode=after) | 부지·경로 | 정비기반시설 도로 · 공원 · 공공공지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=610807) |
| [도봉구 쌍문1동 460](https://moatownmap.com/towns/mt-202603-public-054/?view=3d&mode=after) | 부지·경로 | 공원 · 공공공지 · 사회복지시설 · 공공청사 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=610051) |
| [도봉구 쌍문동 494-22](https://moatownmap.com/towns/mt-202603-public-052/?view=3d&mode=after) | 부지·경로 | 공원 · 공공공지 · 남측 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=596684) |
| [도봉구 쌍문동 524-87](https://moatownmap.com/towns/mt-202603-public-051/?view=3d&mode=after) | 부지·경로 | 도로 · 공원 · 남북 공공보행통로 · 동측 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=596685) |
| [도봉구 창3동 501-13](https://moatownmap.com/towns/mt-202603-public-055/?view=3d&mode=after) | 부지·경로 | 사업구역 내 도로 · 사업구역 외 도로 · 전면공지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=618698) |
| [동대문구 답십리동 489](https://moatownmap.com/towns/mt-202603-public-088/?view=3d&mode=after) | 부지·경로 | 확폭 도로 · 소공원·주차장 · A2·A3 사이 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=641694) |
| [동작구 노량진동 221-24](https://moatownmap.com/towns/mt-202603-public-058/?view=3d&mode=after) | 부지·경로 | 보행자전용도로 · 도로 · 공원 · 공공공지 · 공공청사 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=628093) |
| [동작구 사당동 202-29](https://moatownmap.com/towns/mt-202603-public-059/?view=3d&mode=after) | 부지·경로 | 공원 · 도로 · 중앙 계획도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=626238) |
| [동작구 상도동 242](https://moatownmap.com/towns/mt-202603-public-060/?view=3d&mode=after) | 부지·경로 | 도로 · 공공공지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=614691) |
| [동작구 상도동 279](https://moatownmap.com/towns/mt-202603-public-061/?view=3d&mode=after) | 부지·경로 | 소공원 · 완충녹지 · 공공공지 | [원문 1](https://news.seoul.go.kr/citybuild/archives/543946) |
| [마포구 대흥동 535-2](https://moatownmap.com/towns/mt-202603-public-029/?view=3d&mode=after) | 부지·경로 | 소로3류 · 중로2류 · 어린이공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584564) |
| [마포구 망원동 456-6](https://moatownmap.com/towns/mt-202603-public-031/?view=3d&mode=after) | 부지·경로 | 중로1류 · 소로2류 · 소로3류 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=588911) |
| [마포구 성산동 160-4](https://moatownmap.com/towns/mt-202603-public-030/?view=3d&mode=after) | 부지·경로 | 공원 · 복지시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584518) |
| [마포구 중동 78](https://moatownmap.com/towns/mt-202603-public-033/?view=3d&mode=after) | 부지·경로 | 공공공지 · 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=611308) |
| [마포구 창전동 46-1](https://moatownmap.com/towns/mt-202603-resident-020/?view=3d&mode=after) | 부지·경로 | 공원 · 사회복지시설 · 도로 | [원문 1](https://event.seoul.go.kr/seoulsibo/fileDownload.do?fileName=seoulsibo_20251226131847_53209.pdf#page=294) |
| [마포구 합정동 369](https://moatownmap.com/towns/mt-202603-public-032/?view=3d&mode=after) | 부지·경로 | A-3 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631937) |
| [서대문구 천연동 89-16](https://moatownmap.com/towns/mt-202603-public-083/?view=3d&mode=after) | 부지·경로 | 입체결정도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=606937) |
| [서대문구 현저동 1-5](https://moatownmap.com/towns/mt-202603-resident-016/?view=3d&mode=after) | 부지·경로 | 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=616203) |
| [서대문구 홍은동 10-18](https://moatownmap.com/towns/mt-202603-resident-017/?view=3d&mode=after) | 부지·경로 | 도로 · 공공공지 · 도서관 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=626249) |
| [서대문구 홍제동 322](https://moatownmap.com/towns/mt-202603-public-084/?view=3d&mode=after) | 부지·경로 | 확폭·신설 도로 · 공공공지 · 공원 · 어린이공원과 근린공원 사이 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=630320) |
| [서초구 방배동 977](https://moatownmap.com/towns/mt-202603-public-080/?view=3d&mode=after) | 부지·경로 | 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584797) |
| [성동구 금호동1가 129](https://moatownmap.com/towns/mt-202603-resident-003/?view=3d&mode=after) | 부지·경로 | 행당로1길 계획도로 · 입체결정 도로 | [원문 1](https://www.eum.go.kr/web/cp/hr/hrPeopleHearDet.jsp?seq=4681) |
| [성동구 마장동 457](https://moatownmap.com/towns/mt-202603-public-042/?view=3d&mode=after) | 부지·경로 | 공원 · 공공공지 · 중앙 계획도로 · 남동측 공원·주차장 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=607655) |
| [성북구 석관동 261-22](https://moatownmap.com/towns/mt-202603-public-065/?view=3d&mode=after) | 부지·경로 | 주차장 · A3·A4 사이 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584516) |
| [성북구 석관동 334-69](https://moatownmap.com/towns/mt-202603-public-064/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584515) |
| [성북구 정릉동 226-1](https://moatownmap.com/towns/mt-202603-resident-013/?view=3d&mode=after) | 부지·경로 | 북서측 계획도로 · 남서측 계획도로 · 동측 계획도로 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260610160855_86574.pdf#page=185) |
| [성북구 정릉동 559-43](https://moatownmap.com/towns/mt-202603-resident-012/?view=3d&mode=after) | 부지·경로 | 입체결정도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=645471) |
| [송파구 거여동 555](https://moatownmap.com/towns/mt-202603-public-063/?view=3d&mode=after) | 부지·경로 | 공공시설용지 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584607) |
| [송파구 풍납동 483-10](https://moatownmap.com/towns/mt-202603-public-062/?view=3d&mode=after) | 부지·경로 | 도로 · 공원 · 공공청사 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=586349) |
| [양천구 목4동 724-1](https://moatownmap.com/towns/mt-202603-public-068/?view=3d&mode=after) | 부지·경로 | 공공청사·주차장 · 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=625604) |
| [양천구 목동 644-1](https://moatownmap.com/towns/mt-202603-resident-022/?view=3d&mode=after) | 부지·경로 | 확폭 도로 · 어린이집 용지 | [원문 1](https://news.seoul.go.kr/citybuild/archives/530140) |
| [양천구 신월동 102-33](https://moatownmap.com/towns/mt-202603-public-067/?view=3d&mode=after) | 부지·경로 | B1 어린이공원 · B2 사회복지시설 · 곰달래로5길 · 남부순환로57길 · 월정로31길 · 월정로33길 · 곰달래로11길 · A3 공공보행통로 · A4 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584443) |
| [양천구 신월동 173](https://moatownmap.com/towns/mt-202603-public-066/?view=3d&mode=after) | 부지·경로 | 주차장 · 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=594579) |
| [영등포구 대림3동 786](https://moatownmap.com/towns/mt-202603-public-070/?view=3d&mode=after) | 부지·경로 | 공공공지 · 복지시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=601902) |
| [용산구 서계동 116](https://moatownmap.com/towns/mt-202603-resident-002/?view=3d&mode=after) | 부지·경로 | 계획도로 · 공공공지 | [원문 1](https://news.seoul.go.kr/citybuild/archives/532940) |
| [용산구 원효로4가 71](https://moatownmap.com/towns/mt-202603-public-085/?view=3d&mode=after) | 부지·경로 | 공공공지 · 공공청사 · 공공공지 연결 보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=616239) |
| [은평구 대조동 89](https://moatownmap.com/towns/mt-202603-public-072/?view=3d&mode=after) | 부지·경로 | 도로 · 확폭 도로 · 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=601717) |
| [은평구 불광동 170](https://moatownmap.com/towns/mt-202603-public-071/?view=3d&mode=after) | 부지·경로 | 도로 · A3 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=623053) |
| [종로구 구기동 100-48](https://moatownmap.com/towns/mt-202603-public-086/?view=3d&mode=after) | 부지·경로 | 도로 · 사회복지시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=630726) |
| [종로구 숭인동 61](https://moatownmap.com/towns/mt-202603-resident-001/?view=3d&mode=after) | 부지·경로 | 도로 · 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639883) |
| [중랑구 (시범2호)면목동 86-3](https://moatownmap.com/towns/mt-202603-public-010/?view=3d&mode=after) | 부지·경로 | 1·2구역 사이 8m 도로 · 1구역 남측 6m 도로 · 2·4구역 사이 8m 도로 · 2구역 북측 10m 도로 · 어린이공원·주차장 복합 부지 · 1구역 어린이놀이터 · 2·4구역 사이 공개공지 | [원문 1](https://www.seoul.go.kr/news/news_report.do?nttNo=468710) |
| [중랑구 망우3동 427-5](https://moatownmap.com/towns/mt-202603-public-014/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=584263) |
| [중랑구 망우3동 474-29](https://moatownmap.com/towns/mt-202603-public-019/?view=3d&mode=after) | 부지·경로 | 공원 · 주차장·공공청사 · 도로 · 중앙 남북 계획도로 · 동서 계획도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=628097) |
| [중랑구 망우본동 354-2](https://moatownmap.com/towns/mt-202603-public-017/?view=3d&mode=after) | 부지·경로 | 공원 · 주차장 · A-3 공공보행통로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=628523) |
| [중랑구 면목3·8동 44-6](https://moatownmap.com/towns/mt-202603-public-011/?view=3d&mode=after) | 부지·경로 | 공원 · 공공청사 · 주차장 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=604352) |
| [중랑구 면목3·8동 453-1](https://moatownmap.com/towns/mt-202603-public-023/?view=3d&mode=after) | 부지·경로 | 공원 · 공공공지 · 도로 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=645351) |
| [중랑구 면목동 152-1](https://moatownmap.com/towns/mt-202603-public-015/?view=3d&mode=after) | 부지·경로 | 공원 · 경로당 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=605445) |
| [중랑구 면목동 63-1](https://moatownmap.com/towns/mt-202603-public-016/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=613956) |
| [중랑구 면목본동 297-28](https://moatownmap.com/towns/mt-202603-public-012/?view=3d&mode=after) | 부지·경로 | 공원 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=590037) |
| [중랑구 묵2동 243-7](https://moatownmap.com/towns/mt-202603-public-020/?view=3d&mode=after) | 부지·경로 | 경로당·공동육아방 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260513152445_75058.pdf#page=105) |
| [중랑구 신내동 493-13](https://moatownmap.com/towns/mt-202603-resident-009/?view=3d&mode=after) | 부지·경로 | 기존 도로 · 이전 공공시설 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=638669) |
| [중랑구 중화1동 4-30](https://moatownmap.com/towns/mt-202603-public-013/?view=3d&mode=after) | 부지·경로 | 공공청사 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=587169) |
| [중랑구 중화2동 299-8](https://moatownmap.com/towns/mt-202603-public-021/?view=3d&mode=after) | 대표 지번 | 어린이공원 변경 예정지 | [원문 1](https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20260910094304_20028.pdf#page=63) |
| [중랑구 중화동 329-38](https://moatownmap.com/towns/mt-202603-public-018/?view=3d&mode=after) | 부지·경로 | 어린이공원 · 공공공지 · 공영주차장 | [원문 1](https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=618072) |
