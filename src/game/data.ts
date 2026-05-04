import type {
  CustomerDefinition,
  EmployeeDefinition,
  SlotDefinition,
  StoreLevelDefinition,
  SynergyTag,
  WaveDefinition,
  WorkType
} from "./types";

export const workLabels: Record<WorkType, string> = {
  order: "주문 접수",
  coffee: "커피 제작",
  dessert: "디저트 준비",
  serve: "픽업 / 서빙",
  clean: "테이블 정리",
  complaint: "컴플레인 응대"
};

export const tagLabels: Record<SynergyTag, string> = {
  coffee: "커피",
  dessert: "디저트",
  service: "서비스",
  newbie: "신입"
};

export const employeeDefinitions: EmployeeDefinition[] = [
  {
    id: "part_timer",
    name: "알바생",
    cost: 1,
    role: "범용",
    tags: ["newbie", "service"],
    efficiency: {
      order: 80,
      coffee: 80,
      dessert: 80,
      serve: 80,
      clean: 80,
      complaint: 60
    }
  },
  {
    id: "junior_barista",
    name: "초보 바리스타",
    cost: 1,
    role: "커피 특화",
    tags: ["coffee", "newbie"],
    efficiency: {
      order: 60,
      coffee: 110,
      dessert: 50,
      serve: 50,
      clean: 40,
      complaint: 40
    }
  },
  {
    id: "junior_cashier",
    name: "초보 캐셔",
    cost: 1,
    role: "주문 접수",
    tags: ["service", "newbie"],
    efficiency: {
      order: 110,
      coffee: 50,
      dessert: 50,
      serve: 60,
      clean: 50,
      complaint: 60
    }
  },
  {
    id: "junior_dessert",
    name: "초보 디저트 담당",
    cost: 1,
    role: "디저트 특화",
    tags: ["dessert", "newbie"],
    efficiency: {
      order: 50,
      coffee: 50,
      dessert: 110,
      serve: 60,
      clean: 50,
      complaint: 40
    }
  },
  {
    id: "skilled_barista",
    name: "숙련 바리스타",
    cost: 2,
    role: "커피 전문",
    tags: ["coffee"],
    efficiency: {
      order: 60,
      coffee: 140,
      dessert: 60,
      serve: 60,
      clean: 40,
      complaint: 40
    }
  },
  {
    id: "fast_cashier",
    name: "빠른 캐셔",
    cost: 2,
    role: "대기열 관리",
    tags: ["service"],
    efficiency: {
      order: 140,
      coffee: 50,
      dessert: 50,
      serve: 70,
      clean: 50,
      complaint: 70
    }
  },
  {
    id: "baking_assistant",
    name: "제빵 보조",
    cost: 2,
    role: "디저트 전문",
    tags: ["dessert"],
    efficiency: {
      order: 50,
      coffee: 50,
      dessert: 135,
      serve: 60,
      clean: 50,
      complaint: 50
    }
  },
  {
    id: "server_part_timer",
    name: "서빙 알바",
    cost: 2,
    role: "홀 관리",
    tags: ["service"],
    efficiency: {
      order: 70,
      coffee: 50,
      dessert: 50,
      serve: 130,
      clean: 120,
      complaint: 60
    }
  },
  {
    id: "hall_staff",
    name: "홀 스태프",
    cost: 2,
    role: "홀 균형",
    tags: ["service"],
    efficiency: {
      order: 75,
      coffee: 45,
      dessert: 55,
      serve: 125,
      clean: 125,
      complaint: 75
    }
  },
  {
    id: "cleaning_part_timer",
    name: "청소 알바",
    cost: 2,
    role: "테이블 정리",
    tags: ["service", "newbie"],
    efficiency: {
      order: 55,
      coffee: 40,
      dessert: 45,
      serve: 95,
      clean: 150,
      complaint: 65
    }
  },
  {
    id: "complaint_specialist",
    name: "컴플레인 전문가",
    cost: 2,
    role: "평판 방어",
    tags: ["service"],
    efficiency: {
      order: 70,
      coffee: 35,
      dessert: 40,
      serve: 75,
      clean: 70,
      complaint: 155
    }
  },
  {
    id: "cafe_manager",
    name: "카페 매니저",
    cost: 2,
    role: "후반 안정",
    tags: ["service"],
    efficiency: {
      order: 95,
      coffee: 75,
      dessert: 75,
      serve: 120,
      clean: 120,
      complaint: 130
    }
  },
  {
    id: "senior_cashier",
    name: "선임 캐셔",
    cost: 3,
    role: "주문 지휘",
    tags: ["service"],
    efficiency: {
      order: 175,
      coffee: 60,
      dessert: 60,
      serve: 95,
      clean: 70,
      complaint: 95
    }
  },
  {
    id: "latte_artist",
    name: "라떼 아티스트",
    cost: 3,
    role: "커피 고급",
    tags: ["coffee"],
    efficiency: {
      order: 70,
      coffee: 180,
      dessert: 65,
      serve: 80,
      clean: 55,
      complaint: 60
    }
  },
  {
    id: "pastry_chef",
    name: "파티시에",
    cost: 3,
    role: "디저트 고급",
    tags: ["dessert"],
    efficiency: {
      order: 65,
      coffee: 55,
      dessert: 180,
      serve: 85,
      clean: 65,
      complaint: 60
    }
  },
  {
    id: "floor_lead",
    name: "플로어 리더",
    cost: 3,
    role: "홀 리드",
    tags: ["service"],
    efficiency: {
      order: 95,
      coffee: 65,
      dessert: 70,
      serve: 165,
      clean: 155,
      complaint: 95
    }
  },
  {
    id: "review_guard",
    name: "리뷰 케어 담당",
    cost: 3,
    role: "평판 케어",
    tags: ["service"],
    efficiency: {
      order: 95,
      coffee: 55,
      dessert: 60,
      serve: 105,
      clean: 100,
      complaint: 180
    }
  },
  {
    id: "head_barista",
    name: "헤드 바리스타",
    cost: 4,
    role: "커피 최상급",
    tags: ["coffee"],
    efficiency: {
      order: 85,
      coffee: 225,
      dessert: 80,
      serve: 95,
      clean: 65,
      complaint: 75
    }
  },
  {
    id: "dessert_master",
    name: "디저트 마스터",
    cost: 4,
    role: "디저트 최상급",
    tags: ["dessert"],
    efficiency: {
      order: 80,
      coffee: 70,
      dessert: 225,
      serve: 100,
      clean: 75,
      complaint: 75
    }
  },
  {
    id: "operations_manager",
    name: "운영 매니저",
    cost: 4,
    role: "후반 운영",
    tags: ["service"],
    efficiency: {
      order: 155,
      coffee: 95,
      dessert: 95,
      serve: 170,
      clean: 165,
      complaint: 180
    }
  }
];

export const customerDefinitions: CustomerDefinition[] = [
  {
    id: "normal_coffee",
    name: "일반 커피 손님",
    tasks: [
      { type: "order", amount: 30 },
      { type: "coffee", amount: 80 },
      { type: "serve", amount: 20 }
    ],
    patience: 24,
    rewardGold: 4,
    failPenalty: 5
  },
  {
    id: "heavy_coffee",
    name: "커피 주문 많은 손님",
    tasks: [
      { type: "order", amount: 35 },
      { type: "coffee", amount: 130 },
      { type: "serve", amount: 25 }
    ],
    patience: 21,
    rewardGold: 5,
    failPenalty: 7
  },
  {
    id: "dessert_customer",
    name: "디저트 손님",
    tasks: [
      { type: "order", amount: 30 },
      { type: "dessert", amount: 85 },
      { type: "serve", amount: 20 }
    ],
    patience: 18,
    rewardGold: 4,
    failPenalty: 5
  },
  {
    id: "simple_set",
    name: "간단 세트 손님",
    tasks: [
      { type: "order", amount: 30 },
      { type: "coffee", amount: 70 },
      { type: "dessert", amount: 70 },
      { type: "serve", amount: 30 }
    ],
    patience: 23,
    rewardGold: 6,
    failPenalty: 8
  },
  {
    id: "commuter_rush",
    name: "급한 출근 손님",
    tasks: [
      { type: "order", amount: 24 },
      { type: "coffee", amount: 70 },
      { type: "serve", amount: 18 }
    ],
    patience: 13,
    rewardGold: 4,
    failPenalty: 9
  },
  {
    id: "complex_order",
    name: "복합 주문 손님",
    tasks: [
      { type: "order", amount: 38 },
      { type: "coffee", amount: 95 },
      { type: "dessert", amount: 90 },
      { type: "serve", amount: 36 }
    ],
    patience: 24,
    rewardGold: 6,
    failPenalty: 9
  },
  {
    id: "takeout_customer",
    name: "포장 손님",
    tasks: [
      { type: "order", amount: 30 },
      { type: "coffee", amount: 80 },
      { type: "dessert", amount: 55 },
      { type: "serve", amount: 45 }
    ],
    patience: 18,
    rewardGold: 5,
    failPenalty: 8
  },
  {
    id: "dine_in_customer",
    name: "테이블 이용 손님",
    tasks: [
      { type: "order", amount: 35 },
      { type: "coffee", amount: 80 },
      { type: "dessert", amount: 75 },
      { type: "serve", amount: 35 },
      { type: "clean", amount: 84 }
    ],
    patience: 32,
    rewardGold: 7,
    failPenalty: 10
  },
  {
    id: "difficult_customer",
    name: "진상 손님",
    tasks: [
      { type: "order", amount: 35 },
      { type: "complaint", amount: 165 },
      { type: "serve", amount: 25 }
    ],
    patience: 20,
    rewardGold: 4,
    failPenalty: 16
  },
  {
    id: "reviewer_customer",
    name: "리뷰어 손님",
    tasks: [
      { type: "order", amount: 35 },
      { type: "coffee", amount: 75 },
      { type: "serve", amount: 25 },
      { type: "complaint", amount: 175 }
    ],
    patience: 24,
    rewardGold: 5,
    failPenalty: 22
  },
  {
    id: "group_customer",
    name: "단체 손님",
    tasks: [
      { type: "order", amount: 80 },
      { type: "coffee", amount: 155 },
      { type: "dessert", amount: 150 },
      { type: "serve", amount: 95 },
      { type: "clean", amount: 135 }
    ],
    patience: 45,
    rewardGold: 10,
    failPenalty: 18
  }
];

export const slotDefinitions: SlotDefinition[] = [
  {
    id: "counter",
    name: "계산대",
    workType: "order",
    efficiencyBonus: 0.3,
    availableWave: 1
  },
  {
    id: "espresso_machine",
    name: "커피머신",
    workType: "coffee",
    efficiencyBonus: 0.3,
    availableWave: 1
  },
  {
    id: "pickup",
    name: "픽업대",
    workType: "serve",
    efficiencyBonus: 0.3,
    availableWave: 1
  },
  {
    id: "dessert_station",
    name: "디저트대",
    workType: "dessert",
    efficiencyBonus: 0.3,
    availableWave: 4
  },
  {
    id: "hall_center",
    name: "홀 중앙",
    workType: "serve",
    efficiencyBonus: 0.2,
    availableWave: 13
  },
  {
    id: "table_station",
    name: "테이블 관리석",
    workType: "clean",
    efficiencyBonus: 0.25,
    availableWave: 15
  },
  {
    id: "cleaning_zone",
    name: "청소 구역",
    workType: "clean",
    efficiencyBonus: 0.35,
    availableWave: 18
  },
  {
    id: "complaint_desk",
    name: "컴플레인 응대석",
    workType: "complaint",
    efficiencyBonus: 0.4,
    availableWave: 18
  },
  {
    id: "manager_station",
    name: "매니저석",
    workType: "complaint",
    efficiencyBonus: 0.2,
    availableWave: 22
  }
];

export const storeLevels: StoreLevelDefinition[] = [
  {
    level: 1,
    expToNext: 30,
    maxEmployees: 2,
    shopSlots: 5,
    costWeights: { 1: 100 }
  },
  {
    level: 2,
    expToNext: 60,
    maxEmployees: 3,
    shopSlots: 5,
    costWeights: { 1: 85, 2: 15 }
  },
  {
    level: 3,
    expToNext: 90,
    maxEmployees: 3,
    shopSlots: 5,
    costWeights: { 1: 70, 2: 28, 3: 2 }
  },
  {
    level: 4,
    expToNext: 150,
    maxEmployees: 4,
    shopSlots: 5,
    costWeights: { 1: 55, 2: 38, 3: 7 }
  },
  {
    level: 5,
    expToNext: 210,
    maxEmployees: 5,
    shopSlots: 5,
    costWeights: { 1: 45, 2: 42, 3: 13 }
  },
  {
    level: 6,
    expToNext: 300,
    maxEmployees: 6,
    shopSlots: 5,
    costWeights: { 1: 32, 2: 45, 3: 20, 4: 3 }
  },
  {
    level: 7,
    expToNext: 450,
    maxEmployees: 7,
    shopSlots: 5,
    costWeights: { 1: 22, 2: 42, 3: 28, 4: 8 }
  },
  {
    level: 8,
    expToNext: 600,
    maxEmployees: 8,
    shopSlots: 5,
    costWeights: { 1: 14, 2: 34, 3: 38, 4: 14 }
  },
  {
    level: 9,
    expToNext: null,
    maxEmployees: 9,
    shopSlots: 5,
    costWeights: { 1: 10, 2: 25, 3: 45, 4: 20 }
  }
];

export const waveDefinitions: WaveDefinition[] = [
  {
    wave: 1,
    stage: "기본 커피 운영",
    title: "오픈 준비",
    customerCounts: { normal_coffee: 3 },
    preview: {
      coffee: "보통",
      dessert: "낮음",
      queue: "낮음",
      note: "일반 커피 손님 중심"
    }
  },
  {
    wave: 2,
    stage: "기본 커피 운영",
    title: "첫 손님 증가",
    customerCounts: { normal_coffee: 5 },
    preview: {
      coffee: "많음",
      dessert: "낮음",
      queue: "보통",
      note: "처리 속도 점검"
    }
  },
  {
    wave: 3,
    stage: "기본 커피 운영",
    title: "커피 러시",
    customerCounts: { normal_coffee: 5, heavy_coffee: 1 },
    preview: {
      coffee: "많음",
      dessert: "낮음",
      queue: "보통",
      note: "커피 제작 병목 주의"
    }
  },
  {
    wave: 4,
    stage: "디저트 메뉴 추가",
    title: "디저트 첫 등장",
    customerCounts: { normal_coffee: 4, dessert_customer: 2 },
    preview: {
      coffee: "보통",
      dessert: "보통",
      queue: "보통",
      note: "디저트대 해금"
    }
  },
  {
    wave: 5,
    stage: "디저트 메뉴 추가",
    title: "디저트 비중 증가",
    customerCounts: { normal_coffee: 4, dessert_customer: 4 },
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "보통",
      note: "디저트 담당 가치 상승"
    }
  },
  {
    wave: 6,
    stage: "디저트 메뉴 추가",
    title: "간단 세트 주문",
    customerCounts: { normal_coffee: 3, dessert_customer: 3, simple_set: 2 },
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "보통",
      note: "복합 작업 첫 점검"
    }
  },
  {
    wave: 7,
    stage: "디저트 메뉴 추가",
    title: "디저트 피크",
    customerCounts: { normal_coffee: 4, dessert_customer: 5, simple_set: 2 },
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "높음",
      note: "수직 슬라이스 최종 검증"
    }
  },
  {
    wave: 8,
    stage: "출근길 러시",
    title: "테이크아웃 급증",
    customerCounts: { normal_coffee: 4, heavy_coffee: 2, commuter_rush: 2 },
    arrivalGap: 1.6,
    preview: {
      coffee: "많음",
      dessert: "낮음",
      queue: "높음",
      note: "급한 출근 손님이 등장합니다"
    }
  },
  {
    wave: 9,
    stage: "출근길 러시",
    title: "짧은 대기 시간",
    customerCounts: { normal_coffee: 3, heavy_coffee: 3, commuter_rush: 3 },
    arrivalGap: 1.4,
    preview: {
      coffee: "많음",
      dessert: "낮음",
      queue: "높음",
      note: "주문 접수와 커피 제작 병목을 동시에 압박"
    }
  },
  {
    wave: 10,
    stage: "출근길 러시",
    title: "출근 세트 주문",
    customerCounts: { normal_coffee: 2, heavy_coffee: 2, dessert_customer: 2, commuter_rush: 3 },
    arrivalGap: 1.3,
    preview: {
      coffee: "많음",
      dessert: "보통",
      queue: "높음",
      note: "급한 손님 사이에 디저트 주문이 섞입니다"
    }
  },
  {
    wave: 11,
    stage: "출근길 러시",
    title: "홀 픽업 혼잡",
    customerCounts: { heavy_coffee: 3, dessert_customer: 3, simple_set: 2, commuter_rush: 3 },
    arrivalGap: 1.2,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "픽업과 서빙 속도가 부족하면 이탈이 빠르게 늘어납니다"
    }
  },
  {
    wave: 12,
    stage: "출근길 러시",
    title: "모닝 피크",
    customerCounts: { heavy_coffee: 3, dessert_customer: 3, simple_set: 3, commuter_rush: 4 },
    arrivalGap: 1.08,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "Wave 12 최종 러시. 강화와 배치 완성도를 검증합니다"
    }
  },
  {
    wave: 13,
    stage: "복합 주문 / 홀 관리",
    title: "복합 주문 본격 등장",
    customerCounts: { complex_order: 3, normal_coffee: 4, dessert_customer: 3 },
    arrivalGap: 1.4,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "홀 중앙이 열리고 복합 주문 처리 순서가 중요해집니다"
    }
  },
  {
    wave: 14,
    stage: "복합 주문 / 홀 관리",
    title: "포장 손님 등장",
    customerCounts: { complex_order: 3, takeout_customer: 3, commuter_rush: 3 },
    arrivalGap: 1.3,
    preview: {
      coffee: "많음",
      dessert: "보통",
      queue: "높음",
      note: "포장 손님은 픽업 / 서빙 처리량을 강하게 요구합니다"
    }
  },
  {
    wave: 15,
    stage: "복합 주문 / 홀 관리",
    title: "테이블 이용 손님 등장",
    customerCounts: { dine_in_customer: 4, complex_order: 3, normal_coffee: 3 },
    arrivalGap: 1.4,
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "높음",
      note: "테이블 관리석이 열리고 테이블 정리 업무가 시작됩니다"
    }
  },
  {
    wave: 16,
    stage: "복합 주문 / 홀 관리",
    title: "홀 관리 압박",
    customerCounts: { dine_in_customer: 5, takeout_customer: 3, simple_set: 3 },
    arrivalGap: 1.25,
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "높음",
      note: "서빙과 테이블 정리가 동시에 밀리기 쉬운 구간입니다"
    }
  },
  {
    wave: 17,
    stage: "복합 주문 / 홀 관리",
    title: "점심 피크",
    customerCounts: { complex_order: 5, dine_in_customer: 5, commuter_rush: 3, dessert_customer: 3 },
    arrivalGap: 1.18,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "Wave 17 점심 피크. 홀 관리와 복합 주문 대응을 검증합니다"
    }
  },
  {
    wave: 18,
    stage: "특수 손님 / 평판 관리",
    title: "진상 손님 첫 등장",
    customerCounts: { difficult_customer: 1, complex_order: 4, normal_coffee: 4 },
    arrivalGap: 1.35,
    preview: {
      coffee: "많음",
      dessert: "보통",
      queue: "높음",
      note: "컴플레인 응대석과 청소 구역이 열립니다"
    }
  },
  {
    wave: 19,
    stage: "특수 손님 / 평판 관리",
    title: "컴플레인 증가",
    customerCounts: { difficult_customer: 2, dine_in_customer: 4, takeout_customer: 3 },
    arrivalGap: 1.25,
    preview: {
      coffee: "보통",
      dessert: "많음",
      queue: "높음",
      note: "평판 손실이 커지는 구간입니다"
    }
  },
  {
    wave: 20,
    stage: "특수 손님 / 평판 관리",
    title: "리뷰어 방문",
    customerCounts: { reviewer_customer: 1, complex_order: 5, commuter_rush: 4 },
    arrivalGap: 1.2,
    preview: {
      coffee: "많음",
      dessert: "보통",
      queue: "높음",
      note: "리뷰어 실패는 평판을 크게 깎습니다"
    }
  },
  {
    wave: 21,
    stage: "특수 손님 / 평판 관리",
    title: "단체 손님 등장",
    customerCounts: { group_customer: 1, difficult_customer: 1, dessert_customer: 4, normal_coffee: 4 },
    arrivalGap: 1.25,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "단체 손님은 모든 업무 처리량을 요구합니다"
    }
  },
  {
    wave: 22,
    stage: "특수 손님 / 평판 관리",
    title: "저녁 피크",
    customerCounts: { group_customer: 1, reviewer_customer: 1, difficult_customer: 2, complex_order: 4 },
    arrivalGap: 1.1,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "매니저석이 열리고 평판 관리가 최우선이 됩니다"
    }
  },
  {
    wave: 23,
    stage: "마감 피크",
    title: "마감 전 몰림",
    customerCounts: { group_customer: 2, complex_order: 5, commuter_rush: 4, dine_in_customer: 4 },
    arrivalGap: 1,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "마감 전 대량 주문과 테이블 정리가 동시에 몰립니다"
    }
  },
  {
    wave: 24,
    stage: "마감 피크",
    title: "최종 러시",
    customerCounts: { group_customer: 2, reviewer_customer: 1, difficult_customer: 3, complex_order: 5, dine_in_customer: 4 },
    arrivalGap: 1.05,
    preview: {
      coffee: "많음",
      dessert: "많음",
      queue: "높음",
      note: "마지막 Wave. 컴플레인과 단체 주문을 넘기면 운영을 마감합니다"
    }
  }
];
