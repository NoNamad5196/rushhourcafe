import {
  customerDefinitions,
  employeeDefinitions,
  slotDefinitions,
  storeLevels,
  tagLabels,
  workLabels,
  waveDefinitions
} from "./data";
import { createRng, weightedPick } from "./random";
import type {
  ActiveSynergy,
  CostTier,
  CustomerDefinition,
  CustomerOutcome,
  CustomerTask,
  EmployeeDefinition,
  EmployeeInstance,
  FinalGrade,
  FinalResult,
  GameState,
  ReplayWorkerState,
  RewardChoice,
  RoundReport,
  Satisfaction,
  ShopOffer,
  SlotState,
  StoreLevelDefinition,
  SynergyEffects,
  SynergyTag,
  WaveDefinition,
  WorkType
} from "./types";

const STAR_MULTIPLIER: Record<EmployeeInstance["star"], number> = {
  1: 1,
  2: 1.6,
  3: 2.4,
  4: 3.5
};

const COPY_VALUE: Record<EmployeeInstance["star"], number> = {
  1: 1,
  2: 3,
  3: 9,
  4: 27
};

const STARTING_LIFE = 20;
const NORMAL_CUSTOMER_LIFE_PENALTY = 3;
const SPECIAL_CUSTOMER_LIFE_PENALTY = 5;
const EARLY_SAFE_WAVE = 3;
const EARLY_LOW_STAKES_WAVE = 7;
const MID_GAME_WAVE = 12;
const LATE_GAME_WAVE = 17;
const SPECIAL_LIFE_PENALTY_CUSTOMERS = new Set([
  "difficult_customer",
  "reviewer_customer",
  "group_customer"
]);
const EMPLOYEE_UPGRADE_COST: Record<Exclude<EmployeeInstance["star"], 4>, number> = {
  1: 120,
  2: 260,
  3: 600
};
const EMPLOYEE_PRICE_MULTIPLIER = 10;
const SELL_VALUE_RATE = 0.7;
const BASE_ROUND_GOLD = 6;
export const SHOP_REROLL_COST = 20;
export const BUY_EXP_COST = 40;
export const BUY_EXP_AMOUNT = 10;
export const REWARD_WAVES = [3, 6, 9, 12, 15, 18, 21] as const;
const TICK_SECONDS = 0.5;
const CUSTOMER_ARRIVAL_GAP = 2;
const REPLAY_FRAME_SECONDS = 1;
const MAX_SIMULATION_SECONDS = 180;
export const MAX_BENCH_EMPLOYEES = 6;
const SLOT_REWARD_AMOUNT = 0.1;
const SLOT_REWARD_CAP = 0.3;
const WORK_REWARD_AMOUNT = 0.05;
const WORK_REWARD_CAP = 0.2;
const GOLD_REWARD_AMOUNT = 6;
const REPUTATION_REWARD_AMOUNT = 8;
const WORK_TYPES: WorkType[] = ["order", "coffee", "dessert", "serve", "clean", "complaint"];
const FINAL_GRADE_THRESHOLDS: Array<[FinalGrade, number]> = [
  ["S", 90],
  ["A", 78],
  ["B", 65],
  ["C", 50],
  ["D", 0]
];

export function createNewGame(seed = "rush-hour-cafe"): GameState {
  const state: GameState = {
    phase: "preparation",
    seed,
    rollCounter: 0,
    nextInstanceId: 1,
    wave: 1,
    gold: 30,
    reputation: 100,
    life: STARTING_LIFE,
    storeLevel: 1,
    exp: 0,
    shop: [],
    bench: [],
    slots: slotDefinitions.map((slot) => ({
      slotId: slot.id,
      employee: null
    })),
    lastReport: null,
    pendingRewards: [],
    upgrades: {
      workBonuses: {},
      slotBonuses: {}
    }
  };

  return {
    ...state,
    shop: generateShopOffers(state)
  };
}

export function createDebugGameAtWave(wave: number, seed = "debug-wave"): GameState {
  const maxWave = waveDefinitions[waveDefinitions.length - 1].wave;
  const targetWave = Math.max(1, Math.min(maxWave, Math.floor(wave)));
  const storeLevel = targetWave >= 22 ? 9 : targetWave >= 18 ? 8 : targetWave >= 13 ? 6 : targetWave >= 8 ? 5 : targetWave >= 4 ? 4 : 1;
  const gold = targetWave >= 18 ? 240 : targetWave >= 13 ? 180 : targetWave >= 8 ? 120 : 30;

  return refreshShop({
    ...createNewGame(seed),
    wave: targetWave,
    storeLevel,
    gold
  }, true);
}

export function getEmployeeDefinition(id: string): EmployeeDefinition {
  const employee = employeeDefinitions.find((definition) => definition.id === id);
  if (!employee) {
    throw new Error(`Unknown employee: ${id}`);
  }
  return employee;
}

export function getCustomerDefinition(id: string): CustomerDefinition {
  const customer = customerDefinitions.find((definition) => definition.id === id);
  if (!customer) {
    throw new Error(`Unknown customer: ${id}`);
  }
  return customer;
}

export function getCurrentWave(state: GameState): WaveDefinition {
  const wave = waveDefinitions.find((definition) => definition.wave === state.wave);
  if (!wave) {
    throw new Error(`Unknown wave: ${state.wave}`);
  }
  return wave;
}

export function getStoreLevelDefinition(level: number): StoreLevelDefinition {
  const definition = storeLevels.find((item) => item.level === level);
  if (!definition) {
    throw new Error(`Unknown store level: ${level}`);
  }
  return definition;
}

export function getAvailableSlots(state: GameState): SlotState[] {
  return state.slots.filter((slotState) => {
    const definition = slotDefinitions.find((slot) => slot.id === slotState.slotId);
    return definition ? definition.availableWave <= state.wave : false;
  });
}

export function getPlacedEmployees(state: GameState): EmployeeInstance[] {
  return getAvailableSlots(state)
    .map((slot) => slot.employee)
    .filter((employee): employee is EmployeeInstance => Boolean(employee));
}

export function createEmployeeInstance(
  definitionId: string,
  instanceNumber: number,
  star: EmployeeInstance["star"] = 1
): EmployeeInstance {
  return {
    instanceId: `employee-${instanceNumber}`,
    definitionId,
    star
  };
}

export function getEmployeeSellValue(
  employee: Pick<EmployeeInstance, "definitionId" | "star">
): number {
  return Math.floor(
    getEmployeeBuyPrice(employee.definitionId) * COPY_VALUE[employee.star] * SELL_VALUE_RATE +
      1e-9
  );
}

export function getEmployeeBuyPrice(employeeId: string): number {
  const definition = getEmployeeDefinition(employeeId);
  return definition.cost * EMPLOYEE_PRICE_MULTIPLIER;
}

export function getEmployeeUpgradeCost(
  employee: Pick<EmployeeInstance, "star">
): number | null {
  return employee.star === 4 ? null : EMPLOYEE_UPGRADE_COST[employee.star];
}

export function getCustomerLifePenalty(customerId: string, wave?: number): number {
  const basePenalty = SPECIAL_LIFE_PENALTY_CUSTOMERS.has(customerId)
    ? SPECIAL_CUSTOMER_LIFE_PENALTY
    : NORMAL_CUSTOMER_LIFE_PENALTY;

  if (wave === undefined) {
    return basePenalty;
  }

  if (wave <= EARLY_SAFE_WAVE) {
    return 0;
  }

  if (wave <= EARLY_LOW_STAKES_WAVE) {
    return Math.max(1, basePenalty - 2);
  }

  if (wave <= MID_GAME_WAVE) {
    return basePenalty;
  }

  if (wave <= LATE_GAME_WAVE) {
    return basePenalty + 1;
  }

  return SPECIAL_LIFE_PENALTY_CUSTOMERS.has(customerId)
    ? basePenalty + 2
    : basePenalty + 1;
}

function shouldOfferReward(wave: number): boolean {
  return (REWARD_WAVES as readonly number[]).includes(wave);
}

function applyRoundIncomeAndExp(state: GameState, report: RoundReport): GameState {
  return addExp(
    {
      ...state,
      gold: state.gold + report.totalGold,
      reputation: Math.max(0, Math.min(100, state.reputation + report.reputationDelta)),
      life: Math.max(0, state.life + report.lifeDelta)
    },
    report.expGained
  );
}

function advanceToNextWavePreparation(state: GameState): GameState {
  return refreshShop({
    ...state,
    phase: "preparation",
    wave: state.wave + 1,
    lastReport: null,
    pendingRewards: []
  }, true);
}

function getPerformanceReputationDelta(outcomes: CustomerOutcome[]): number {
  if (!outcomes.length || outcomes.some((outcome) => outcome.satisfaction === "Failed")) {
    return 0;
  }

  return outcomes.every((outcome) => outcome.satisfaction === "Perfect") ? 5 : 3;
}

function getPerfectTipGold(outcome: CustomerOutcome): number {
  if (outcome.satisfaction !== "Perfect") {
    return 0;
  }

  return Math.ceil(getCustomerDefinition(outcome.customerId).rewardGold * 0.1);
}

export function refreshShop(state: GameState, free = false): GameState {
  if (!free && state.gold < SHOP_REROLL_COST) {
    return state;
  }

  const nextState: GameState = {
    ...state,
    gold: free ? state.gold : state.gold - SHOP_REROLL_COST,
    rollCounter: state.rollCounter + 1
  };

  return {
    ...nextState,
    shop: generateShopOffers(nextState)
  };
}

export function buyEmployee(state: GameState, offerIndex: number): GameState {
  const offer = state.shop[offerIndex];
  if (!offer) {
    return state;
  }

  const definition = getEmployeeDefinition(offer.employeeId);
  const price = getEmployeeBuyPrice(definition.id);
  if (state.gold < price) {
    return state;
  }

  if (state.bench.length >= MAX_BENCH_EMPLOYEES) {
    return state;
  }

  const employee = createEmployeeInstance(
    definition.id,
    state.nextInstanceId
  );
  const shop = state.shop.map((item, index) => (index === offerIndex ? null : item));

  return mergeEmployees({
    ...state,
    gold: state.gold - price,
    nextInstanceId: state.nextInstanceId + 1,
    bench: [...state.bench, employee],
    shop
  });
}

export function sellEmployee(state: GameState, instanceId: string): GameState {
  const located = findEmployeeLocation(state, instanceId);
  if (!located) {
    return state;
  }

  const refund = getEmployeeSellValue(located.employee);

  if (located.location === "bench") {
    return {
      ...state,
      gold: state.gold + refund,
      bench: state.bench.filter((employee) => employee.instanceId !== instanceId)
    };
  }

  return {
    ...state,
    gold: state.gold + refund,
    slots: state.slots.map((slot) =>
      slot.slotId === located.slotId ? { ...slot, employee: null } : slot
    )
  };
}

export function upgradeEmployee(state: GameState, instanceId: string): GameState {
  if (state.phase !== "preparation") {
    return state;
  }

  const located = findEmployeeLocation(state, instanceId);
  if (!located) {
    return state;
  }

  const cost = getEmployeeUpgradeCost(located.employee);
  if (cost === null || state.gold < cost) {
    return state;
  }

  const upgraded: EmployeeInstance = {
    ...located.employee,
    star: (located.employee.star + 1) as EmployeeInstance["star"]
  };

  if (located.location === "bench") {
    return {
      ...state,
      gold: state.gold - cost,
      bench: state.bench.map((employee) =>
        employee.instanceId === instanceId ? upgraded : employee
      )
    };
  }

  return {
    ...state,
    gold: state.gold - cost,
    slots: state.slots.map((slot) =>
      slot.employee?.instanceId === instanceId
        ? { ...slot, employee: upgraded }
        : slot
    )
  };
}

export function buyExp(state: GameState): GameState {
  if (state.gold < BUY_EXP_COST) {
    return state;
  }

  const currentLevel = getStoreLevelDefinition(state.storeLevel);
  if (currentLevel.expToNext === null) {
    return state;
  }

  return addExp({
    ...state,
    gold: state.gold - BUY_EXP_COST
  }, BUY_EXP_AMOUNT);
}

export function placeEmployee(
  state: GameState,
  instanceId: string,
  slotId: string
): GameState {
  const slotDefinition = slotDefinitions.find((slot) => slot.id === slotId);
  if (!slotDefinition || slotDefinition.availableWave > state.wave) {
    return state;
  }

  const located = findEmployeeLocation(state, instanceId);
  if (!located) {
    return state;
  }

  const targetSlot = state.slots.find((slot) => slot.slotId === slotId);
  if (targetSlot?.employee?.instanceId === instanceId) {
    return state;
  }

  const placedCount = getPlacedEmployees(state).length;
  const movingFromSlot = located.location === "slot";
  const targetOccupied = Boolean(targetSlot?.employee);
  const maxEmployees = getStoreLevelDefinition(state.storeLevel).maxEmployees;

  if (!movingFromSlot && !targetOccupied && placedCount >= maxEmployees) {
    return state;
  }

  let bench = state.bench.filter((employee) => employee.instanceId !== instanceId);
  const displaced = targetSlot?.employee ?? null;
  if (displaced && !movingFromSlot) {
    bench = [...bench, displaced];
  }

  const slots = state.slots.map((slot) => {
    if (slot.employee?.instanceId === instanceId) {
      return {
        ...slot,
        employee: movingFromSlot && displaced ? displaced : null
      };
    }
    if (slot.slotId === slotId) {
      return { ...slot, employee: located.employee };
    }
    return slot;
  });

  return {
    ...state,
    bench,
    slots
  };
}

export function unplaceEmployee(state: GameState, slotId: string): GameState {
  const slot = state.slots.find((item) => item.slotId === slotId);
  if (!slot?.employee) {
    return state;
  }

  if (state.bench.length >= MAX_BENCH_EMPLOYEES) {
    return state;
  }

  return {
    ...state,
    bench: [...state.bench, slot.employee],
    slots: state.slots.map((item) =>
      item.slotId === slotId ? { ...item, employee: null } : item
    )
  };
}

export function mergeEmployees(state: GameState): GameState {
  let nextState = state;
  let merged = true;

  while (merged) {
    merged = false;
    const allEmployees = collectEmployees(nextState);

    for (const definition of employeeDefinitions) {
      for (const star of [1, 2, 3] as const) {
        const matches = allEmployees.filter(
          (item) =>
            item.employee.definitionId === definition.id &&
            item.employee.star === star
        );

        if (matches.length >= 3) {
          const consumed = matches.slice(0, 3);
          const upgraded = createEmployeeInstance(
            definition.id,
            nextState.nextInstanceId,
            (star + 1) as EmployeeInstance["star"]
          );
          const preferredSlot = consumed.find((item) => item.location === "slot");

          nextState = removeEmployees(nextState, consumed.map((item) => item.employee.instanceId));
          nextState = {
            ...nextState,
            nextInstanceId: nextState.nextInstanceId + 1
          };

          if (preferredSlot?.location === "slot") {
            nextState = {
              ...nextState,
              slots: nextState.slots.map((slot) =>
                slot.slotId === preferredSlot.slotId
                  ? { ...slot, employee: upgraded }
                  : slot
              )
            };
          } else {
            nextState = {
              ...nextState,
              bench: [...nextState.bench, upgraded]
            };
          }

          merged = true;
          break;
        }
      }
      if (merged) {
        break;
      }
    }
  }

  return nextState;
}

export function calculateSynergies(state: GameState): ActiveSynergy[] {
  const counts: Record<SynergyTag, number> = {
    coffee: 0,
    dessert: 0,
    service: 0,
    newbie: 0
  };

  for (const employee of getPlacedEmployees(state)) {
    const definition = getEmployeeDefinition(employee.definitionId);
    for (const tag of definition.tags) {
      counts[tag] += 1;
    }
  }

  return [
    {
      tag: "coffee",
      label: tagLabels.coffee,
      count: counts.coffee,
      required: 2,
      active: counts.coffee >= 2,
      description: "커피 제작 속도 +15%"
    },
    {
      tag: "dessert",
      label: tagLabels.dessert,
      count: counts.dessert,
      required: 2,
      active: counts.dessert >= 2,
      description: "디저트 처리 속도 +20%"
    },
    {
      tag: "service",
      label: tagLabels.service,
      count: counts.service,
      required: 2,
      active: counts.service >= 2,
      description: "손님 인내심 감소 속도 -10%"
    },
    {
      tag: "newbie",
      label: tagLabels.newbie,
      count: counts.newbie,
      required: 3,
      active: counts.newbie >= 3,
      description: "1코스트 직원 처리 속도 +25%"
    }
  ];
}

export function getSynergyEffects(state: GameState): SynergyEffects {
  const synergies = calculateSynergies(state);
  const isActive = (tag: SynergyTag) =>
    synergies.some((synergy) => synergy.tag === tag && synergy.active);
  const workBonus = Object.fromEntries(
    WORK_TYPES.map((workType) => {
      const synergyBonus =
        workType === "coffee" && isActive("coffee")
          ? 0.15
          : workType === "dessert" && isActive("dessert")
            ? 0.2
            : 0;
      return [workType, synergyBonus + (state.upgrades.workBonuses[workType] ?? 0)];
    })
  ) as Record<WorkType, number>;

  return {
    workBonus,
    costOneEfficiencyBonus: isActive("newbie") ? 0.25 : 0,
    patienceDecayMultiplier: isActive("service") ? 0.9 : 1
  };
}

export function getEffectiveSlotBonus(state: GameState, slotId: string): number {
  const slotDefinition = slotDefinitions.find((slot) => slot.id === slotId);
  return (slotDefinition?.efficiencyBonus ?? 0) + (state.upgrades.slotBonuses[slotId] ?? 0);
}

export function simulateWave(state: GameState): RoundReport {
  const wave = getCurrentWave(state);
  const customers = createSimulationCustomers(wave);
  const workers = getAvailableSlots(state).filter((slot) => slot.employee);
  const effects = getSynergyEffects(state);
  const replayFrames: RoundReport["replayFrames"] = [];
  const bottleneckScore: Record<WorkType, number> = {
    order: 0,
    coffee: 0,
    dessert: 0,
    serve: 0,
    clean: 0,
    complaint: 0
  };

  let elapsed = 0;
  let nextReplayAt = 0;

  while (
    elapsed <= MAX_SIMULATION_SECONDS &&
    customers.some((customer) => customer.status === "waiting" || customer.status === "active")
  ) {
    const workerReplayStates: ReplayWorkerState[] = workers.map((worker) => ({
      employeeId: worker.employee!.instanceId,
      employeeName: getEmployeeDefinition(worker.employee!.definitionId).name,
      slotId: worker.slotId,
      targetCustomerId: null,
      workType: null,
      throughput: 0
    }));

    for (const customer of customers) {
      if (customer.status === "waiting" && customer.arrivalAt <= elapsed) {
        customer.status = "active";
      }
    }

    for (const customer of customers) {
      if (customer.status !== "active") {
        continue;
      }

      const task = getCurrentTask(customer);
      if (task) {
        bottleneckScore[task.type] += TICK_SECONDS;
      }

      customer.remainingPatience -= TICK_SECONDS * effects.patienceDecayMultiplier;
      if (customer.remainingPatience <= 0) {
        customer.status = "failed";
      }
    }

    for (const [workerIndex, worker] of workers.entries()) {
      if (!worker.employee) {
        continue;
      }

      const target = findTargetCustomer(customers, worker.employee);
      if (!target) {
        continue;
      }

      const task = getCurrentTask(target);
      if (!task) {
        continue;
      }

      const throughput = calculateThroughput(state, worker, task.type, effects);
      workerReplayStates[workerIndex] = {
        employeeId: worker.employee.instanceId,
        employeeName: getEmployeeDefinition(worker.employee.definitionId).name,
        slotId: worker.slotId,
        targetCustomerId: target.id,
        workType: task.type,
        throughput
      };
      task.remaining = Math.max(0, task.remaining - throughput * TICK_SECONDS);

      if (target.tasks.every((item) => item.remaining <= 0)) {
        target.status = "succeeded";
        target.completedAt = elapsed;
      }
    }

    if (elapsed >= nextReplayAt) {
      replayFrames.push(
        createReplayFrame(nextReplayAt, customers, workerReplayStates, bottleneckScore)
      );
      nextReplayAt += REPLAY_FRAME_SECONDS;
    }

    elapsed += TICK_SECONDS;
  }

  for (const customer of customers) {
    if (customer.status === "waiting" || customer.status === "active") {
      customer.status = "failed";
    }
  }

  replayFrames.push(
    createReplayFrame(Math.ceil(elapsed), customers, createIdleWorkerStates(workers), bottleneckScore)
  );

  const outcomes = customers.map(toOutcome);
  const successfulCustomers = outcomes.filter(
    (outcome) => outcome.satisfaction !== "Failed"
  ).length;
  const failedCustomers = outcomes.length - successfulCustomers;
  const customerGold = outcomes.reduce(
    (sum, outcome) => sum + outcome.rewardGold,
    0
  );
  const tipGold = outcomes.reduce(
    (sum, outcome) => sum + getPerfectTipGold(outcome),
    0
  );
  const outcomeReputationDelta = outcomes.reduce(
    (sum, outcome) => sum + outcome.reputationDelta,
    0
  );
  const lifePenalty = outcomes.reduce(
    (sum, outcome) =>
      outcome.satisfaction === "Failed"
        ? sum + getCustomerLifePenalty(outcome.customerId, wave.wave)
        : sum,
    0
  );
  const lifeDelta = lifePenalty === 0 ? 0 : -lifePenalty;
  const reputationDelta = outcomeReputationDelta + getPerformanceReputationDelta(outcomes);
  const reputationAfterWave = Math.max(0, Math.min(100, state.reputation + reputationDelta));
  const reputationBonusGold =
    reputationAfterWave >= 80 ? 2 : reputationAfterWave >= 60 ? 1 : 0;
  const bottlenecks = getTopBottlenecks(bottleneckScore);

  return {
    wave: wave.wave,
    stage: wave.stage,
    successfulCustomers,
    failedCustomers,
    baseGold: BASE_ROUND_GOLD,
    customerGold,
    tipGold,
    reputationBonusGold,
    totalGold: BASE_ROUND_GOLD + customerGold + tipGold + reputationBonusGold,
    reputationDelta,
    lifeDelta,
    expGained: failedCustomers === 0 ? 2 : 1,
    bottlenecks,
    outcomes,
    replayFrames,
    duration: elapsed
  };
}

export function runCurrentWave(state: GameState): GameState {
  if (state.phase !== "preparation") {
    return state;
  }

  const report = simulateWave(state);
  return {
    ...state,
    phase: "running",
    lastReport: report
  };
}

export function finishWaveReplay(state: GameState): GameState {
  if (state.phase !== "running" || !state.lastReport) {
    return state;
  }

  return {
    ...state,
    phase: "report"
  };
}

export function applyRoundResult(state: GameState): GameState {
  if (state.phase !== "report" || !state.lastReport) {
    return state;
  }

  const report = state.lastReport;
  const settledState = applyRoundIncomeAndExp(state, report);
  const reputation = settledState.reputation;
  const life = settledState.life;

  if (reputation <= 0 || life <= 0) {
    return {
      ...settledState,
      phase: "gameOver"
    };
  }

  if (state.wave >= waveDefinitions[waveDefinitions.length - 1].wave) {
    return {
      ...settledState,
      phase: "cleared"
    };
  }

  if (!shouldOfferReward(state.wave)) {
    return advanceToNextWavePreparation(settledState);
  }

  return {
    ...settledState,
    phase: "reward",
    pendingRewards: generateRewardChoices(settledState, report)
  };
}

export function completeCurrentWaveForDebug(
  state: GameState,
  overrides: Partial<Pick<RoundReport, "successfulCustomers" | "failedCustomers" | "totalGold" | "reputationDelta" | "lifeDelta">> = {}
): GameState {
  if (state.phase !== "preparation") {
    return state;
  }

  const wave = getCurrentWave(state);
  const report: RoundReport = {
    wave: wave.wave,
    stage: wave.stage,
    successfulCustomers: overrides.successfulCustomers ?? 1,
    failedCustomers: overrides.failedCustomers ?? 0,
    baseGold: BASE_ROUND_GOLD,
    customerGold: Math.max(0, (overrides.totalGold ?? BASE_ROUND_GOLD) - BASE_ROUND_GOLD),
    tipGold: 0,
    reputationBonusGold: 0,
    totalGold: overrides.totalGold ?? BASE_ROUND_GOLD,
    reputationDelta: overrides.reputationDelta ?? 0,
    lifeDelta: overrides.lifeDelta ?? 0,
    expGained: 2,
    bottlenecks: [],
    outcomes: [],
    replayFrames: [],
    duration: 0
  };

  return applyRoundResult({
    ...state,
    phase: "report",
    lastReport: report
  });
}

export function calculateFinalResult(
  reputation: number,
  gold: number,
  report: RoundReport
): FinalResult {
  const totalCustomers = report.successfulCustomers + report.failedCustomers;
  const successRate = totalCustomers > 0 ? report.successfulCustomers / totalCustomers : 0;
  const reputationScore = clamp01(reputation / 100) * 45;
  const goldScore = clamp01(gold / 700) * 25;
  const successScore = successRate * 30;
  const score = Math.round(reputationScore + goldScore + successScore);
  const grade = FINAL_GRADE_THRESHOLDS.find(([, threshold]) => score >= threshold)?.[0] ?? "D";

  return {
    grade,
    score,
    successRate
  };
}

export function generateRewardChoices(
  state: GameState,
  report: RoundReport
): RewardChoice[] {
  const rng = createRng(
    `${state.seed}:reward:${state.wave}:${report.successfulCustomers}:${report.failedCustomers}:${report.totalGold}`
  );
  const rewards: RewardChoice[] = [];
  const slotReward = createSlotReward(state, report, rng, rewards.length);
  if (slotReward) {
    rewards.push(slotReward);
  }

  const employeeReward = createEmployeeReward(state, rng, rewards.length);
  if (employeeReward) {
    rewards.push(employeeReward);
  }

  rewards.push(createStatReward(state, report, rng, rewards.length));

  while (rewards.length < 3) {
    rewards.push(createStatReward(state, report, rng, rewards.length));
  }

  return rewards.slice(0, 3);
}

export function chooseReward(state: GameState, rewardId: string): GameState {
  if (state.phase !== "reward") {
    return state;
  }

  const reward = state.pendingRewards.find((item) => item.id === rewardId);
  if (!reward) {
    return state;
  }

  const rewarded = applyRewardChoice(state, reward);
  const advanced: GameState = {
    ...rewarded,
    phase: "preparation",
    wave: state.wave + 1,
    lastReport: null,
    pendingRewards: []
  };

  return refreshShop(advanced, true);
}

function createSlotReward(
  state: GameState,
  report: RoundReport,
  rng: () => number,
  index: number
): RewardChoice | null {
  const candidates = slotDefinitions.filter(
    (slot) =>
      slot.availableWave <= state.wave &&
      (state.upgrades.slotBonuses[slot.id] ?? 0) < SLOT_REWARD_CAP
  );
  if (!candidates.length) {
    return null;
  }

  const preferred =
    report.bottlenecks
      .map((workType) => candidates.find((slot) => slot.workType === workType))
      .find((slot): slot is typeof candidates[number] => Boolean(slot)) ??
    candidates[Math.floor(rng() * candidates.length)];
  const currentBonus = state.upgrades.slotBonuses[preferred.id] ?? 0;
  const amount = Math.min(SLOT_REWARD_AMOUNT, SLOT_REWARD_CAP - currentBonus);

  return {
    id: `reward-${state.wave}-${index}-slot-${preferred.id}`,
    kind: "slot_upgrade",
    category: "slot",
    title: `${preferred.name} 강화`,
    description: `${workLabels[preferred.workType]} 포지션 효율 +${formatPercent(amount)}${lateWorkHint(preferred.workType)}`,
    amount,
    slotId: preferred.id,
    workType: preferred.workType
  };
}

function createEmployeeReward(
  state: GameState,
  rng: () => number,
  index: number
): RewardChoice | null {
  if (state.bench.length >= MAX_BENCH_EMPLOYEES) {
    return null;
  }

  const employee = pickEmployeeForLevel(state.storeLevel, rng);
  return {
    id: `reward-${state.wave}-${index}-employee-${employee.id}`,
    kind: "employee",
    category: "unit",
    title: `${employee.name} 합류`,
    description: `${employee.cost}코스트 ${employee.role} 직원을 벤치에 추가`,
    amount: 1,
    employeeId: employee.id
  };
}

function createStatReward(
  state: GameState,
  report: RoundReport,
  rng: () => number,
  index: number
): RewardChoice {
  const candidates: RewardChoice[] = [
    {
      id: `reward-${state.wave}-${index}-gold`,
      kind: "gold",
      category: "stat",
      title: "추가 매출",
      description: `즉시 +${GOLD_REWARD_AMOUNT}G`,
      amount: GOLD_REWARD_AMOUNT
    }
  ];

  if (state.reputation < 100) {
    candidates.push({
      id: `reward-${state.wave}-${index}-reputation`,
      kind: "reputation",
      category: "stat",
      title: "평판 회복",
      description: `평판 +${REPUTATION_REWARD_AMOUNT}`,
      amount: REPUTATION_REWARD_AMOUNT
    });
  }

  const workType = pickWorkTypeForReward(state, report, rng);
  if (workType) {
    const currentBonus = state.upgrades.workBonuses[workType] ?? 0;
    const amount = Math.min(WORK_REWARD_AMOUNT, WORK_REWARD_CAP - currentBonus);
    candidates.push({
      id: `reward-${state.wave}-${index}-work-${workType}`,
      kind: "work_bonus",
      category: "stat",
      title: `${workLabels[workType]} 훈련`,
      description: `${workLabels[workType]} 전체 효율 +${formatPercent(amount)}${lateWorkHint(workType)}`,
      amount,
      workType
    });
  }

  return candidates[Math.floor(rng() * candidates.length)];
}

function applyRewardChoice(state: GameState, reward: RewardChoice): GameState {
  if (reward.kind === "gold") {
    return {
      ...state,
      gold: state.gold + reward.amount
    };
  }

  if (reward.kind === "reputation") {
    return {
      ...state,
      reputation: Math.min(100, state.reputation + reward.amount)
    };
  }

  if (reward.kind === "work_bonus" && reward.workType) {
    const currentBonus = state.upgrades.workBonuses[reward.workType] ?? 0;
    return {
      ...state,
      upgrades: {
        ...state.upgrades,
        workBonuses: {
          ...state.upgrades.workBonuses,
          [reward.workType]: Math.min(WORK_REWARD_CAP, currentBonus + reward.amount)
        }
      }
    };
  }

  if (reward.kind === "slot_upgrade" && reward.slotId) {
    const currentBonus = state.upgrades.slotBonuses[reward.slotId] ?? 0;
    return {
      ...state,
      upgrades: {
        ...state.upgrades,
        slotBonuses: {
          ...state.upgrades.slotBonuses,
          [reward.slotId]: Math.min(SLOT_REWARD_CAP, currentBonus + reward.amount)
        }
      }
    };
  }

  if (reward.kind === "employee" && reward.employeeId && state.bench.length < MAX_BENCH_EMPLOYEES) {
    return mergeEmployees({
      ...state,
      nextInstanceId: state.nextInstanceId + 1,
      bench: [
        ...state.bench,
        createEmployeeInstance(reward.employeeId, state.nextInstanceId)
      ]
    });
  }

  return state;
}

function pickEmployeeForLevel(level: number, rng: () => number): EmployeeDefinition {
  const levelDefinition = getStoreLevelDefinition(level);
  const costEntries = Object.entries(levelDefinition.costWeights).map(([cost, weight]) => [
    Number(cost) as CostTier,
    weight ?? 0
  ] as [CostTier, number]);
  const cost = weightedPick(costEntries, rng);
  const candidates = employeeDefinitions.filter((employee) => employee.cost === cost);
  return candidates[Math.floor(rng() * candidates.length)];
}

function pickWorkTypeForReward(
  state: GameState,
  report: RoundReport,
  rng: () => number
): WorkType | null {
  const eligible = WORK_TYPES.filter(
    (workType) => (state.upgrades.workBonuses[workType] ?? 0) < WORK_REWARD_CAP
  );
  if (!eligible.length) {
    return null;
  }

  return (
    report.bottlenecks.find((workType) => eligible.includes(workType)) ??
    eligible[Math.floor(rng() * eligible.length)]
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function lateWorkHint(workType: WorkType): string {
  if (workType === "clean") {
    return " · 후반 홀 회전 핵심";
  }
  if (workType === "complaint") {
    return " · 후반 평판 방어 핵심";
  }
  return "";
}

function generateShopOffers(state: GameState): Array<ShopOffer | null> {
  const level = getStoreLevelDefinition(state.storeLevel);
  const rng = createRng(`${state.seed}:${state.rollCounter}`);
  const offers: ShopOffer[] = [];

  for (let index = 0; index < level.shopSlots; index += 1) {
    const employee = pickEmployeeForLevel(state.storeLevel, rng);
    offers.push({
      offerId: `shop-${state.rollCounter}-${index}`,
      employeeId: employee.id
    });
  }

  return offers;
}

function addExp(state: GameState, amount: number): GameState {
  let storeLevel = state.storeLevel;
  let exp = state.exp + amount;
  let currentLevel = getStoreLevelDefinition(storeLevel);

  while (currentLevel.expToNext !== null && exp >= currentLevel.expToNext) {
    exp -= currentLevel.expToNext;
    storeLevel += 1;
    currentLevel = getStoreLevelDefinition(storeLevel);
  }

  return {
    ...state,
    storeLevel,
    exp
  };
}

function collectEmployees(state: GameState) {
  return [
    ...state.bench.map((employee) => ({
      location: "bench" as const,
      employee
    })),
    ...state.slots
      .filter((slot) => slot.employee)
      .map((slot) => ({
        location: "slot" as const,
        slotId: slot.slotId,
        employee: slot.employee!
      }))
  ];
}

function findEmployeeLocation(state: GameState, instanceId: string) {
  return collectEmployees(state).find(
    (item) => item.employee.instanceId === instanceId
  );
}

function removeEmployees(state: GameState, instanceIds: string[]): GameState {
  const idSet = new Set(instanceIds);
  return {
    ...state,
    bench: state.bench.filter((employee) => !idSet.has(employee.instanceId)),
    slots: state.slots.map((slot) =>
      slot.employee && idSet.has(slot.employee.instanceId)
        ? { ...slot, employee: null }
        : slot
    )
  };
}

interface SimulationTask extends CustomerTask {
  remaining: number;
}

interface SimulationCustomer {
  id: string;
  definition: CustomerDefinition;
  arrivalAt: number;
  remainingPatience: number;
  status: "waiting" | "active" | "succeeded" | "failed";
  tasks: SimulationTask[];
  completedAt: number | null;
}

function createSimulationCustomers(wave: WaveDefinition): SimulationCustomer[] {
  const customerIds = Object.entries(wave.customerCounts).flatMap(([id, count]) =>
    Array.from({ length: count }, () => id)
  );
  const arrivalGap = wave.arrivalGap ?? CUSTOMER_ARRIVAL_GAP;

  return customerIds.map((customerId, index) => {
    const definition = getCustomerDefinition(customerId);
    return {
      id: `customer-${index + 1}`,
      definition,
      arrivalAt: index * arrivalGap,
      remainingPatience: definition.patience,
      status: "waiting",
      completedAt: null,
      tasks: definition.tasks.map((task) => ({
        ...task,
        remaining: task.amount
      }))
    };
  });
}

function getCurrentTask(customer: SimulationCustomer): SimulationTask | null {
  return customer.tasks.find((task) => task.remaining > 0) ?? null;
}

function findTargetCustomer(
  customers: SimulationCustomer[],
  employee: EmployeeInstance
): SimulationCustomer | null {
  const definition = getEmployeeDefinition(employee.definitionId);
  const candidates = customers.filter((customer) => {
    if (customer.status !== "active") {
      return false;
    }
    const task = getCurrentTask(customer);
    return task ? definition.efficiency[task.type] > 0 : false;
  });

  candidates.sort((a, b) => {
    const aTask = getCurrentTask(a)!;
    const bTask = getCurrentTask(b)!;
    const aScore = a.remainingPatience - definition.efficiency[aTask.type] / 100;
    const bScore = b.remainingPatience - definition.efficiency[bTask.type] / 100;
    return aScore - bScore;
  });

  return candidates[0] ?? null;
}

function calculateThroughput(
  state: GameState,
  slot: SlotState,
  workType: WorkType,
  effects: SynergyEffects
): number {
  if (!slot.employee) {
    return 0;
  }

  const employee = slot.employee;
  const definition = getEmployeeDefinition(employee.definitionId);
  const slotDefinition = slotDefinitions.find((item) => item.id === slot.slotId);
  const slotBonus =
    slotDefinition?.workType === workType ? getEffectiveSlotBonus(state, slot.slotId) : 0;
  const workBonus = effects.workBonus[workType] ?? 0;
  const costBonus = definition.cost === 1 ? effects.costOneEfficiencyBonus : 0;
  const multiplier =
    STAR_MULTIPLIER[employee.star] * (1 + slotBonus + workBonus + costBonus);

  return (definition.efficiency[workType] * multiplier) / 10;
}

function createIdleWorkerStates(workers: SlotState[]): ReplayWorkerState[] {
  return workers.map((worker) => ({
    employeeId: worker.employee!.instanceId,
    employeeName: getEmployeeDefinition(worker.employee!.definitionId).name,
    slotId: worker.slotId,
    targetCustomerId: null,
    workType: null,
    throughput: 0
  }));
}

function createReplayFrame(
  time: number,
  customers: SimulationCustomer[],
  workers: ReplayWorkerState[],
  bottleneckScore: Record<WorkType, number>
): RoundReport["replayFrames"][number] {
  return {
    time,
    customers: customers.map((customer) => {
      const currentTask = getCurrentTask(customer);
      const totalAmount = customer.tasks.reduce((sum, task) => sum + task.amount, 0);
      const remainingAmount = customer.tasks.reduce((sum, task) => sum + task.remaining, 0);
      const currentTaskProgress = currentTask
        ? 1 - currentTask.remaining / currentTask.amount
        : 1;

      return {
        id: customer.id,
        customerId: customer.definition.id,
        customerName: customer.definition.name,
        status: customer.status,
        currentTask: currentTask?.type ?? null,
        taskProgress: clamp01(currentTaskProgress),
        totalProgress: clamp01(1 - remainingAmount / totalAmount),
        remainingPatience: Math.max(0, customer.remainingPatience),
        patienceRatio: clamp01(customer.remainingPatience / customer.definition.patience)
      };
    }),
    workers,
    successfulCustomers: customers.filter((customer) => customer.status === "succeeded").length,
    failedCustomers: customers.filter((customer) => customer.status === "failed").length,
    activeCustomers: customers.filter((customer) => customer.status === "active").length,
    bottlenecks: getTopBottlenecks(bottleneckScore)
  };
}

function getTopBottlenecks(bottleneckScore: Record<WorkType, number>): WorkType[] {
  return Object.entries(bottleneckScore)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type as WorkType);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toOutcome(customer: SimulationCustomer): CustomerOutcome {
  const definition = customer.definition;

  if (customer.status === "failed") {
    return {
      customerId: definition.id,
      customerName: definition.name,
      satisfaction: "Failed",
      remainingPatience: 0,
      rewardGold: 0,
      reputationDelta: -definition.failPenalty
    };
  }

  const ratio = customer.remainingPatience / definition.patience;
  const satisfaction: Satisfaction =
    ratio >= 0.7 ? "Perfect" : ratio >= 0.35 ? "Good" : "Late";

  return {
    customerId: definition.id,
    customerName: definition.name,
    satisfaction,
    remainingPatience: Math.max(0, customer.remainingPatience),
    rewardGold: definition.rewardGold,
    reputationDelta: satisfaction === "Late" ? -1 : 0
  };
}
