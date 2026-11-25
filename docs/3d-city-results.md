# 서울 모아타운 기존 건물 3D 수록 현황

2026.11.24 스냅샷의 138개 대상지 중 참고 외곽이 있는 23개 자치구 108곳을 수록했다. GIS건물통합정보의 건물 기준일은 2024.12.31이다. 건축물대장 및 보충 층수의 원자료 날짜는 건물별 기록을 따른다. 조회일은 2026.11.25다. [GIS건물통합정보](https://www.data.go.kr/data/15083092/fileData.do) · [서울시 건축물대장 표제부](https://data.seoul.go.kr/dataList/OA-22424/S/1/datasetView.do) · [건물 자료 색인](../moatown-data/buildings/index.json)

## 수록 기준

참고 외곽에서 150m까지의 건물을 수집했다. 인접 대상지 간 중복을 제외한 74,966동 중 공식 높이가 있는 건물은 36,464동, 확인된 층수로 높이를 환산한 건물은 29,805동이다. 층수 환산에는 서울시 수치지도와 도로명주소 건물 도형으로 보충한 1,049동이 포함된다. 대장 속성은 65,257동, 지붕 분류는 57,926동에서 확인했다. 높이 미확인 8,697동은 외곽을 평면으로 표시한다. 이 중 7,444동은 층수·승인연도·대장 상세도 비어 있다. 아래 표는 각 대상지에서 보이는 건수를 센다.

용도·구조·지붕 분류로 외관의 차이를 표현한다. 창문 배치와 마감색은 유형별 예시다. 공식 높이가 없으면 확인된 층수에 3m를 곱한다. 정비 이후의 현장 상태나 개별 건물의 철거 여부는 건물 원자료의 시점과 다를 수 있다.

층수 대비 높이 등의 검수 조건에 해당한 36동을 별도로 대조했다. 양재동 397-11은 표제부의 13.418m를 적용했다. 31동은 두 자료의 높이가 같았고, 일치하는 표제부를 찾지 못한 4동에는 원자료 값과 검수 상태를 함께 표시한다. 중복 식별자나 도형 오류로 보류된 자료는 대상지별 색인의 `audit.withheld`에 있다. [높이 검수 기준·대조 내역](../moatown-data/buildings/height-review.json)

서울시의 정비 전 사진이나 현황 자료는 57곳에 연결했다. 신월동·번동·면목동은 출처와 이용 조건을 확인한 원본을 표시한다. 나머지 54곳은 주소·현황 사진을 확인한 서울시 원문으로 연결한다. [공식 현황 자료 목록](../moatown-data/plans/current-site-sources.json)

## 대상지별 수록 건물

| 대상지 | 내부 | 경계 걸침 | 주변 150m | 공식 높이 | 층수 환산 | 높이 미확인 | 대장 속성 | 지붕 분류 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [강동구 둔촌동 77-41](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-056&view=3d) | 258 | 21 | 398 | 483 | 144 | 50 | 623 | 593 |
| [강동구 천호동 113-2](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-057&view=3d) | 281 | 20 | 653 | 678 | 223 | 53 | 900 | 864 |
| [강동구 천호동 338번지](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-027&view=3d) | 74 | 12 | 355 | 266 | 137 | 38 | 402 | 391 |
| [강북구 번동 411](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-036&view=3d) | 433 | 23 | 886 | 895 | 371 | 76 | 1,265 | 1,191 |
| [강북구 번동 429-114](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-034&view=3d) | 259 | 2 | 533 | 457 | 262 | 75 | 716 | 414 |
| [강북구 번동 454-61](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-035&view=3d) | 366 | 6 | 878 | 843 | 351 | 56 | 1,192 | 974 |
| [강북구 번동 469](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-040&view=3d) | 514 | 50 | 797 | 889 | 398 | 74 | 1,286 | 1,238 |
| [강북구 수유동 31-10](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-041&view=3d) | 348 | 39 | 993 | 816 | 338 | 226 | 1,152 | 1,107 |
| [강북구 수유동 52-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-037&view=3d) | 384 | 23 | 955 | 675 | 403 | 284 | 1,072 | 1,017 |
| [강북구 수유동 141](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-039&view=3d) | 330 | 39 | 787 | 712 | 335 | 109 | 1,045 | 998 |
| [강북구 수유동 392-9](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-038&view=3d) | 373 | 23 | 1,086 | 813 | 436 | 233 | 1,247 | 1,205 |
| [강서구 공항동 55-327](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-008&view=3d) | 390 | 22 | 714 | 769 | 212 | 145 | 978 | 774 |
| [강서구 등촌2동 515-44](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-005&view=3d) | 179 | 12 | 233 | 257 | 99 | 68 | 356 | 297 |
| [강서구 방화동 592-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-007&view=3d) | 236 | 22 | 661 | 548 | 245 | 126 | 792 | 696 |
| [강서구 화곡6동 957](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-009&view=3d) | 329 | 10 | 519 | 613 | 188 | 57 | 800 | 720 |
| [강서구 화곡6동 1130-7](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-006&view=3d) | 145 | 15 | 457 | 382 | 183 | 52 | 565 | 481 |
| [강서구 화곡동 354](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-002&view=3d) | 289 | 15 | 774 | 796 | 234 | 48 | 1,030 | 842 |
| [강서구 화곡동 359](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-003&view=3d) | 217 | 13 | 701 | 523 | 362 | 46 | 877 | 701 |
| [강서구 화곡동 424](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-004&view=3d) | 182 | 17 | 672 | 661 | 167 | 43 | 827 | 648 |
| [강서구 화곡동 1087](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-001&view=3d) | 199 | 26 | 656 | 609 | 227 | 45 | 828 | 696 |
| [관악구 난곡동 697-20](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-077&view=3d) | 187 | 19 | 482 | 247 | 386 | 55 | 631 | 594 |
| [관악구 성현동 1021](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-074&view=3d) | 269 | 15 | 423 | 354 | 241 | 112 | 592 | 519 |
| [관악구 신림동 655-78](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-025&view=3d) | 80 | 5 | 490 | 200 | 355 | 20 | 555 | 511 |
| [관악구 은천동 635-540](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-075&view=3d) | 367 | 24 | 734 | 649 | 429 | 47 | 1,077 | 1,003 |
| [관악구 은천동 938-5](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-076&view=3d) | 352 | 24 | 752 | 617 | 408 | 103 | 1,019 | 943 |
| [관악구 청룡동 1535](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-073&view=3d) | 381 | 37 | 774 | 475 | 416 | 301 | 888 | 772 |
| [광진구 구의3동 587-58](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-008&view=3d) | 47 | 6 | 158 | 114 | 67 | 30 | 156 | 98 |
| [광진구 자양1동 226-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-006&view=3d) | 75 | 7 | 281 | 198 | 128 | 37 | 308 | 275 |
| [광진구 자양1동 772-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-005&view=3d) | 183 | 17 | 351 | 328 | 160 | 63 | 469 | 401 |
| [광진구 자양1동 799](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-078&view=3d) | 337 | 20 | 777 | 724 | 352 | 58 | 1,065 | 920 |
| [광진구 자양2동 593](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-036&view=3d) | 297 | 33 | 653 | 691 | 242 | 50 | 926 | 813 |
| [광진구 자양2동 649](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-079&view=3d) | 386 | 22 | 619 | 762 | 198 | 67 | 946 | 826 |
| [광진구 자양동 663](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-044&view=3d) | 127 | 9 | 612 | 504 | 199 | 45 | 693 | 562 |
| [구로구 개봉동 20](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-048&view=3d) | 172 | 20 | 430 | 286 | 279 | 57 | 565 | 548 |
| [구로구 개봉동 270-38](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-046&view=3d) | 126 | 1 | 398 | 316 | 188 | 21 | 501 | 468 |
| [구로구 고척동 241](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-044&view=3d) | 332 | 10 | 409 | 335 | 357 | 59 | 686 | 660 |
| [구로구 구로동 511](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-047&view=3d) | 373 | 17 | 939 | 645 | 561 | 123 | 1,193 | 1,135 |
| [구로구 구로동 728](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-045&view=3d) | 410 | 42 | 908 | 537 | 670 | 153 | 1,192 | 934 |
| [금천구 시흥1동 864](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-027&view=3d) | 303 | 32 | 1,096 | 1,001 | 407 | 23 | 1,402 | 1,332 |
| [금천구 시흥3동 950](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-028&view=3d) | 164 | 3 | 280 | 255 | 144 | 48 | 388 | 369 |
| [금천구 시흥3동 972](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-023&view=3d) | 28 | 5 | 154 | 36 | 81 | 70 | 89 | 85 |
| [금천구 시흥3동 1005](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-024&view=3d) | 209 | 25 | 309 | 309 | 170 | 64 | 453 | 435 |
| [금천구 시흥4동 817](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-025&view=3d) | 100 | 17 | 520 | 470 | 148 | 19 | 613 | 586 |
| [금천구 시흥5동 922-61](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-026&view=3d) | 396 | 9 | 775 | 733 | 358 | 89 | 1,071 | 1,036 |
| [노원구 상계2동 177-66](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-049&view=3d) | 427 | 21 | 486 | 466 | 360 | 108 | 825 | 799 |
| [노원구 월계동 534](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-050&view=3d) | 173 | 18 | 162 | 103 | 162 | 88 | 264 | 249 |
| [도봉구 방학동 618](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-053&view=3d) | 309 | 26 | 762 | 722 | 288 | 87 | 1,006 | 928 |
| [도봉구 쌍문1동 460](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-054&view=3d) | 352 | 28 | 349 | 327 | 253 | 149 | 577 | 482 |
| [도봉구 쌍문동 494-22](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-052&view=3d) | 152 | 19 | 460 | 246 | 228 | 157 | 473 | 410 |
| [도봉구 쌍문동 524-87](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-051&view=3d) | 334 | 27 | 394 | 258 | 334 | 163 | 588 | 510 |
| [도봉구 창3동 501-13](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-055&view=3d) | 238 | 29 | 642 | 531 | 302 | 76 | 830 | 666 |
| [동대문구 답십리동 489](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-088&view=3d) | 265 | 33 | 710 | 314 | 277 | 417 | 588 | 507 |
| [동작구 노량진동 221-24](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-058&view=3d) | 116 | 23 | 566 | 278 | 358 | 69 | 570 | 478 |
| [동작구 사당동 202-29](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-059&view=3d) | 280 | 18 | 216 | 221 | 238 | 55 | 437 | 392 |
| [동작구 상도동 242](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-060&view=3d) | 304 | 30 | 1,060 | 537 | 775 | 82 | 1,290 | 1,072 |
| [동작구 상도동 279](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-061&view=3d) | 144 | 17 | 945 | 248 | 370 | 488 | 607 | 493 |
| [마포구 대흥동 535-2](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-029&view=3d) | 67 | 6 | 138 | 115 | 63 | 33 | 177 | 163 |
| [마포구 망원동 456-6](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-031&view=3d) | 214 | 41 | 469 | 333 | 256 | 135 | 585 | 562 |
| [마포구 성산동 160-4](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-030&view=3d) | 303 | 18 | 376 | 325 | 301 | 71 | 624 | 605 |
| [마포구 중동 78](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-033&view=3d) | 56 | 12 | 87 | 45 | 51 | 59 | 93 | 88 |
| [마포구 창전동 46-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-020&view=3d) | 51 | 5 | 137 | 104 | 44 | 45 | 144 | 129 |
| [마포구 합정동 369](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-032&view=3d) | 405 | 20 | 450 | 387 | 360 | 128 | 749 | 674 |
| [서대문구 천연동 89-16](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-083&view=3d) | 112 | 9 | 532 | 289 | 327 | 37 | 519 | 473 |
| [서대문구 현저동 1-5](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-016&view=3d) | 87 | 17 | 53 | 15 | 122 | 20 | 38 | 29 |
| [서대문구 홍은동 10-18](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-017&view=3d) | 85 | 12 | 449 | 127 | 278 | 141 | 350 | 333 |
| [서대문구 홍은동 11-360](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-018&view=3d) | 99 | 18 | 641 | 91 | 351 | 316 | 329 | 239 |
| [서대문구 홍제동 322](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-084&view=3d) | 122 | 20 | 175 | 73 | 123 | 121 | 164 | 157 |
| [서초구 방배동 977](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-080&view=3d) | 13 | 4 | 397 | 213 | 197 | 4 | 407 | 156 |
| [서초구 양재2동 374](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-081&view=3d) | 118 | 16 | 532 | 588 | 48 | 30 | 628 | 563 |
| [서초구 양재2동 382](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-082&view=3d) | 171 | 4 | 394 | 516 | 28 | 25 | 542 | 493 |
| [서초구 우면동 2](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-026&view=3d) | 94 | 1 | 59 | 119 | 12 | 23 | 130 | 112 |
| [성동구 금호동1가 129](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-003&view=3d) | 81 | 9 | 111 | 120 | 30 | 51 | 150 | 137 |
| [성동구 마장동 457](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-042&view=3d) | 535 | 8 | 553 | 425 | 298 | 373 | 722 | 656 |
| [성동구 응봉동 265](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-043&view=3d) | 185 | 20 | 74 | 192 | 41 | 46 | 232 | 229 |
| [성북구 석관동 261-22](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-065&view=3d) | 341 | 32 | 600 | 385 | 499 | 89 | 882 | 801 |
| [성북구 석관동 334-69](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-064&view=3d) | 454 | 30 | 720 | 500 | 604 | 100 | 1,103 | 1,041 |
| [성북구 정릉동 226-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-013&view=3d) | 84 | 16 | 590 | 330 | 320 | 40 | 647 | 616 |
| [성북구 정릉동 559-43](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-012&view=3d) | 52 | 12 | 373 | 80 | 131 | 226 | 209 | 178 |
| [성북구 종암동 125-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-011&view=3d) | 9 | 5 | 163 | 72 | 59 | 46 | 129 | 120 |
| [송파구 거여동 555](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-063&view=3d) | 67 | 31 | 285 | 188 | 163 | 32 | 350 | 313 |
| [송파구 풍납동 483-10](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-062&view=3d) | 243 | 31 | 643 | 473 | 352 | 92 | 823 | 742 |
| [양천구 목2동 231-27](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-069&view=3d) | 185 | 19 | 383 | 329 | 217 | 41 | 544 | 516 |
| [양천구 목4동 724-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-068&view=3d) | 85 | 11 | 468 | 306 | 215 | 43 | 522 | 472 |
| [양천구 목동 644-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-022&view=3d) | 75 | 12 | 400 | 249 | 206 | 32 | 452 | 392 |
| [양천구 신월동 102-33](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-067&view=3d) | 294 | 23 | 744 | 433 | 589 | 39 | 995 | 924 |
| [양천구 신월동 173](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-066&view=3d) | 584 | 31 | 737 | 522 | 786 | 44 | 1,275 | 1,174 |
| [영등포구 대림3동 786](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-070&view=3d) | 124 | 15 | 157 | 57 | 195 | 44 | 251 | 239 |
| [용산구 서계동 116](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-002&view=3d) | 67 | 26 | 501 | 277 | 246 | 71 | 432 | 378 |
| [용산구 원효로4가 71](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-085&view=3d) | 111 | 22 | 393 | 261 | 150 | 115 | 410 | 325 |
| [은평구 대조동 89](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-072&view=3d) | 169 | 21 | 648 | 434 | 363 | 41 | 796 | 768 |
| [은평구 불광동 170](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-071&view=3d) | 199 | 17 | 367 | 256 | 291 | 36 | 535 | 523 |
| [종로구 구기동 100-48](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-086&view=3d) | 122 | 21 | 273 | 146 | 216 | 54 | 362 | 304 |
| [종로구 숭인동 61](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-001&view=3d) | 190 | 17 | 663 | 175 | 453 | 242 | 627 | 471 |
| [중랑구 (시범2호)면목동 86-3](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-010&view=3d) | 487 | 20 | 1,077 | 587 | 898 | 99 | 1,484 | 1,302 |
| [중랑구 망우3동 427-5](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-014&view=3d) | 421 | 26 | 659 | 464 | 577 | 65 | 1,040 | 951 |
| [중랑구 망우3동 474-29](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-019&view=3d) | 386 | 23 | 879 | 435 | 787 | 66 | 1,220 | 1,057 |
| [중랑구 망우본동 354-2](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-017&view=3d) | 361 | 32 | 403 | 300 | 400 | 96 | 696 | 622 |
| [중랑구 면목2동 139-52](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-022&view=3d) | 337 | 23 | 720 | 455 | 575 | 50 | 1,027 | 930 |
| [중랑구 면목3·8동 44-6](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-011&view=3d) | 249 | 6 | 905 | 399 | 709 | 52 | 1,105 | 982 |
| [중랑구 면목3·8동 453-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-023&view=3d) | 455 | 23 | 983 | 482 | 883 | 96 | 1,363 | 1,186 |
| [중랑구 면목동 63-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-016&view=3d) | 454 | 13 | 1,047 | 516 | 925 | 73 | 1,439 | 1,261 |
| [중랑구 면목동 152-1](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-015&view=3d) | 381 | 29 | 759 | 476 | 637 | 56 | 1,111 | 924 |
| [중랑구 면목본동 297-28](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-012&view=3d) | 208 | 25 | 973 | 424 | 710 | 72 | 1,132 | 982 |
| [중랑구 묵2동 243-7](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-020&view=3d) | 284 | 34 | 620 | 406 | 484 | 48 | 884 | 759 |
| [중랑구 신내동 493-13](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-resident-009&view=3d) | 212 | 0 | 318 | 195 | 278 | 57 | 473 | 419 |
| [중랑구 중화1동 4-30](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-013&view=3d) | 310 | 7 | 800 | 472 | 551 | 94 | 1,021 | 904 |
| [중랑구 중화2동 299-8](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-021&view=3d) | 360 | 13 | 642 | 285 | 691 | 39 | 975 | 816 |
| [중랑구 중화동 329-38](https://kdkrkwhr.github.io/moatown-map/?town=mt-202603-public-018&view=3d) | 534 | 28 | 844 | 382 | 978 | 46 | 1,360 | 1,001 |
| **대상지별 합계** | 26,273 | 2,052 | 60,148 | 43,550 | 35,272 | 9,651 | 77,743 | 68,849 |

## 참고 외곽 확인 대기

아래 30곳은 대상지 참고 외곽과 공식 명부의 대조가 필요하다. 일원동 619-641, 광장동 264-1, 구의3동 224-54는 서울플랜+ 도형과 명부·고시의 면적이 달라 보류했다.

| 자치구 | 대상지 |
| --- | --- |
| 강남구 | 일원동 619-641, 삼성동 84 |
| 강동구 | 암사동 495 |
| 강북구 | 미아동 791-1134 |
| 관악구 | 신림동 661-2 |
| 광진구 | 광장동 264-1, 구의3동 224-54 |
| 구로구 | 개봉2동 304, 개봉2동 305 |
| 동작구 | 동작동 102-8, 사당동 449, 노량진동 84-24 |
| 마포구 | 망원동 464-1 |
| 서대문구 | 연희동 520 |
| 서초구 | 서초동 1506-6, 양재동 77 |
| 성북구 | 정릉동 199-1, 하월곡동 40-107, 장위동 219-15, 삼선동3가 42-7, 장위동 65-107, 석관동 207-1 |
| 송파구 | 잠실동 329, 방이동 162 |
| 양천구 | 신월동 480-1 |
| 용산구 | 신창동 76-1 |
| 은평구 | 응암동 227 |
| 중랑구 | 망우동 509, 면목동 127-26, 면목동 377-4 |
