import { describe, expect, it } from "vitest";
import {
  applyRoundResult,
  BUY_EXP_AMOUNT,
  BUY_EXP_COST,
  buyEmployee,
  buyExp,
  calculateFinalResult,
  calculateSynergies,
  chooseReward,
  completeCurrentWaveForDebug,
  createDebugGameAtWave,
  createEmployeeInstance,
  createNewGame,
  finishWaveReplay,
  getAvailableSlots,
  generateRewardChoices,
  getCurrentWave,
  getEffectiveSlotBonus,
  getEmployeeBuyPrice,
  getEmployeeSellValue,
  getEmployeeUpgradeCost,
  getCustomerLifePenalty,
  getPlacedEmployees,
  getStoreLevelDefinition,
  MAX_BENCH_EMPLOYEES,
  mergeEmployees,
  placeEmployee,
  refreshShop,
  REWARD_WAVES,
  runCurrentWave,
  SHOP_REROLL_COST,
  sellEmployee,
  simulateWave,
  unplaceEmployee,
  upgradeEmployee
} from "./engine";
import { employeeDefinitions, storeLevels } from "./data";
import type { GameState, RoundReport } from "./types";

describe("shop and growth", () => {
  it("creates the v1.2 starting state", () => {
    const state = createNewGame("test");

    expect(state.gold).toBe(30);
    expect(state.reputation).toBe(100);
    expect(state.storeLevel).toBe(1);
    expect(state.exp).toBe(0);
    expect(state.shop).toHaveLength(5);
    expect(getCurrentWave(state).wave).toBe(1);
  });

  it("randomizes the initial shop and allows duplicate offers", () => {
    const first = createNewGame("shop-random-a");
    const second = createNewGame("shop-random-b");
    const firstEmployeeIds = first.shop.map((offer) => offer?.employeeId);
    const secondEmployeeIds = second.shop.map((offer) => offer?.employeeId);

    expect(first.shop).toHaveLength(5);
    expect(first.shop.every(Boolean)).toBe(true);
    expect(firstEmployeeIds).not.toEqual(secondEmployeeIds);
    expect(new Set(firstEmployeeIds).size).toBeLessThan(firstEmployeeIds.length);
  });

  it("buys and sells employees", () => {
    const state = buyEmployee(createNewGame("test"), 1);
    expect(state.gold).toBe(20);
    expect(state.bench).toHaveLength(1);
    expect(state.shop[1]).toBeNull();

    const sold = sellEmployee(state, state.bench[0].instanceId);
    expect(sold.gold).toBe(27);
    expect(sold.bench).toHaveLength(0);
  });

  it("rejects buying employees when the bench is full", () => {
    const state = {
      ...createNewGame("test"),
      bench: Array.from({ length: MAX_BENCH_EMPLOYEES }, (_, index) =>
        createEmployeeInstance("part_timer", index + 1)
      )
    };
    const nextState = buyEmployee(state, 0);

    expect(nextState).toBe(state);
    expect(nextState.bench).toHaveLength(MAX_BENCH_EMPLOYEES);
    expect(nextState.gold).toBe(state.gold);
  });

  it("calculates sell value for card UI", () => {
    expect(getEmployeeBuyPrice("part_timer")).toBe(10);
    expect(getEmployeeBuyPrice("fast_cashier")).toBe(20);
    expect(getEmployeeBuyPrice("senior_cashier")).toBe(30);
    expect(getEmployeeBuyPrice("head_barista")).toBe(40);
    expect(getEmployeeSellValue(createEmployeeInstance("part_timer", 1))).toBe(7);
    expect(getEmployeeSellValue(createEmployeeInstance("fast_cashier", 1, 2))).toBe(42);
    expect(getEmployeeSellValue(createEmployeeInstance("fast_cashier", 1, 3))).toBe(126);
    expect(getEmployeeSellValue(createEmployeeInstance("senior_cashier", 1))).toBe(21);
    expect(getEmployeeSellValue(createEmployeeInstance("head_barista", 1))).toBe(28);
  });

  it("defines the v1.5 three-cost and four-cost employee pools", () => {
    const costThreeIds = employeeDefinitions
      .filter((employee) => employee.cost === 3)
      .map((employee) => employee.id);
    const costFourIds = employeeDefinitions
      .filter((employee) => employee.cost === 4)
      .map((employee) => employee.id);

    expect(costThreeIds).toEqual(
      expect.arrayContaining([
        "senior_cashier",
        "latte_artist",
        "pastry_chef",
        "floor_lead",
        "review_guard"
      ])
    );
    expect(costFourIds).toEqual(
      expect.arrayContaining([
        "head_barista",
        "dessert_master",
        "operations_manager"
      ])
    );
    expect(costThreeIds).toHaveLength(5);
    expect(costFourIds).toHaveLength(3);
  });

  it("keeps every weighted shop cost backed by at least one employee", () => {
    for (const level of storeLevels) {
      for (const cost of Object.keys(level.costWeights)) {
        expect(employeeDefinitions.some((employee) => employee.cost === Number(cost))).toBe(true);
      }
    }
  });

  it("adds higher-cost shop odds from mid levels onward", () => {
    expect(getStoreLevelDefinition(3).costWeights).toMatchObject({ 1: 70, 2: 28, 3: 2 });
    expect(getStoreLevelDefinition(6).costWeights).toMatchObject({ 1: 32, 2: 45, 3: 20, 4: 3 });
    expect(getStoreLevelDefinition(9).costWeights).toMatchObject({ 1: 10, 2: 25, 3: 45, 4: 20 });
  });

  it("rerolls the shop for the v1.2 reroll cost", () => {
    const state = refreshShop(createNewGame("test"));

    expect(SHOP_REROLL_COST).toBe(20);
    expect(state.gold).toBe(10);
    expect(state.shop).toHaveLength(5);
    expect(state.shop.every(Boolean)).toBe(true);
  });

  it("buys experience with the v1.2 cost and amount", () => {
    const state = buyExp({
      ...createNewGame("test"),
      gold: BUY_EXP_COST
    });

    expect(BUY_EXP_AMOUNT).toBe(10);
    expect(state.gold).toBe(0);
    expect(state.storeLevel).toBe(1);
    expect(state.exp).toBe(10);
  });

  it("uses the expanded level 9 experience table", () => {
    let state: GameState = {
      ...createNewGame("test"),
      gold: 8000
    };

    for (let index = 0; index < 189; index += 1) {
      state = buyExp(state);
    }

    expect(state.storeLevel).toBe(9);
    expect(state.exp).toBe(0);
    expect(getStoreLevelDefinition(1).expToNext).toBe(30);
    expect(getStoreLevelDefinition(8).expToNext).toBe(600);
    expect(getStoreLevelDefinition(9).expToNext).toBeNull();
    const capped = buyExp(state);

    expect(capped).toBe(state);
    expect(getStoreLevelDefinition(state.storeLevel).maxEmployees).toBe(9);
  });

  it("merges three matching one-star employees into a two-star employee", () => {
    const state = mergeEmployees({
      ...createNewGame("test"),
      nextInstanceId: 4,
      bench: [
        createEmployeeInstance("part_timer", 1),
        createEmployeeInstance("part_timer", 2),
        createEmployeeInstance("part_timer", 3)
      ]
    });

    expect(state.bench).toHaveLength(1);
    expect(state.bench[0].definitionId).toBe("part_timer");
    expect(state.bench[0].star).toBe(2);
  });

  it("merges three matching three-star employees into a four-star employee", () => {
    const state = mergeEmployees({
      ...createNewGame("test"),
      nextInstanceId: 4,
      bench: [
        createEmployeeInstance("part_timer", 1, 3),
        createEmployeeInstance("part_timer", 2, 3),
        createEmployeeInstance("part_timer", 3, 3)
      ]
    });

    expect(state.bench).toHaveLength(1);
    expect(state.bench[0].definitionId).toBe("part_timer");
    expect(state.bench[0].star).toBe(4);
  });

  it("does not merge four-star employees any further", () => {
    const state = mergeEmployees({
      ...createNewGame("test"),
      nextInstanceId: 4,
      bench: [
        createEmployeeInstance("part_timer", 1, 4),
        createEmployeeInstance("part_timer", 2, 4),
        createEmployeeInstance("part_timer", 3, 4)
      ]
    });

    expect(state.bench).toHaveLength(3);
    expect(state.bench.every((employee) => employee.star === 4)).toBe(true);
  });

  it("calculates four-star sell value from total copy value", () => {
    expect(getEmployeeSellValue(createEmployeeInstance("fast_cashier", 1, 4))).toBe(378);
  });

  it("upgrades a selected employee directly with gold", () => {
    const state = {
      ...createNewGame("test"),
      gold: 120,
      bench: [createEmployeeInstance("junior_cashier", 1)],
      nextInstanceId: 2
    };
    const upgraded = upgradeEmployee(state, "employee-1");

    expect(getEmployeeUpgradeCost(state.bench[0])).toBe(120);
    expect(upgraded.gold).toBe(0);
    expect(upgraded.bench[0].star).toBe(2);
  });

  it("rejects direct growth when gold is short or employee is four-star", () => {
    const shortGold = {
      ...createNewGame("test"),
      gold: 119,
      bench: [createEmployeeInstance("junior_cashier", 1)],
      nextInstanceId: 2
    };
    const maxStar = {
      ...createNewGame("test"),
      gold: 1000,
      bench: [createEmployeeInstance("junior_cashier", 1, 4)],
      nextInstanceId: 2
    };

    expect(upgradeEmployee(shortGold, "employee-1")).toBe(shortGold);
    expect(getEmployeeUpgradeCost(maxStar.bench[0])).toBeNull();
    expect(upgradeEmployee(maxStar, "employee-1")).toBe(maxStar);
  });
});

describe("placement and synergies", () => {
  it("enforces the current placement limit", () => {
    let state = createNewGame("test");
    state = {
      ...state,
      bench: [
        createEmployeeInstance("junior_barista", 1),
        createEmployeeInstance("junior_cashier", 2),
        createEmployeeInstance("junior_dessert", 3)
      ],
      nextInstanceId: 4
    };

    state = placeEmployee(state, "employee-1", "espresso_machine");
    state = placeEmployee(state, "employee-2", "counter");
    const rejected = placeEmployee(state, "employee-3", "pickup");

    expect(getPlacedEmployees(rejected)).toHaveLength(2);
    expect(rejected.bench.map((employee) => employee.instanceId)).toContain("employee-3");
  });

  it("activates MVP synergies from placed employees", () => {
    let state: GameState = {
      ...createNewGame("test"),
      storeLevel: 2,
      bench: [
        createEmployeeInstance("junior_barista", 1),
        createEmployeeInstance("junior_cashier", 2),
        createEmployeeInstance("part_timer", 3)
      ],
      nextInstanceId: 4
    };

    state = placeEmployee(state, "employee-1", "espresso_machine");
    state = placeEmployee(state, "employee-2", "counter");
    state = placeEmployee(state, "employee-3", "pickup");

    const synergies = calculateSynergies(state);
    expect(synergies.find((synergy) => synergy.tag === "service")?.active).toBe(true);
    expect(synergies.find((synergy) => synergy.tag === "newbie")?.active).toBe(true);
  });

  it("swaps employees between occupied slots", () => {
    let state: GameState = {
      ...createNewGame("test"),
      bench: [
        createEmployeeInstance("junior_barista", 1),
        createEmployeeInstance("junior_cashier", 2)
      ],
      nextInstanceId: 3
    };

    state = placeEmployee(state, "employee-1", "espresso_machine");
    state = placeEmployee(state, "employee-2", "counter");
    const swapped = placeEmployee(state, "employee-1", "counter");

    expect(swapped.slots.find((slot) => slot.slotId === "counter")?.employee?.instanceId).toBe("employee-1");
    expect(swapped.slots.find((slot) => slot.slotId === "espresso_machine")?.employee?.instanceId).toBe("employee-2");
    expect(swapped.bench).toHaveLength(0);
  });

  it("moves a displaced slot employee to bench when a bench employee is dropped onto an occupied slot", () => {
    let state: GameState = {
      ...createNewGame("test"),
      storeLevel: 2,
      bench: [
        createEmployeeInstance("junior_barista", 1),
        createEmployeeInstance("junior_cashier", 2),
        createEmployeeInstance("part_timer", 3)
      ],
      nextInstanceId: 4
    };

    state = placeEmployee(state, "employee-1", "espresso_machine");
    const displaced = placeEmployee(state, "employee-2", "espresso_machine");

    expect(displaced.slots.find((slot) => slot.slotId === "espresso_machine")?.employee?.instanceId).toBe("employee-2");
    expect(displaced.bench.map((employee) => employee.instanceId)).toContain("employee-1");
    expect(displaced.bench.map((employee) => employee.instanceId)).toContain("employee-3");
  });

  it("returns a placed employee to bench", () => {
    let state: GameState = {
      ...createNewGame("test"),
      bench: [createEmployeeInstance("junior_barista", 1)],
      nextInstanceId: 2
    };

    state = placeEmployee(state, "employee-1", "espresso_machine");
    const returned = unplaceEmployee(state, "espresso_machine");

    expect(returned.slots.find((slot) => slot.slotId === "espresso_machine")?.employee).toBeNull();
    expect(returned.bench.map((employee) => employee.instanceId)).toContain("employee-1");
  });

  it("rejects returning a placed employee when the bench is full", () => {
    let state: GameState = {
      ...createNewGame("test"),
      storeLevel: 2,
      bench: [
        createEmployeeInstance("junior_barista", 1),
        ...Array.from({ length: MAX_BENCH_EMPLOYEES }, (_, index) =>
          createEmployeeInstance("part_timer", index + 2)
        )
      ],
      nextInstanceId: MAX_BENCH_EMPLOYEES + 2
    };
    state = placeEmployee(state, "employee-1", "espresso_machine");
    const returned = unplaceEmployee(state, "espresso_machine");

    expect(returned).toBe(state);
    expect(returned.slots.find((slot) => slot.slotId === "espresso_machine")?.employee?.instanceId).toBe("employee-1");
    expect(returned.bench).toHaveLength(MAX_BENCH_EMPLOYEES);
  });

  it("rejects placement into locked slots", () => {
    const state: GameState = {
      ...createNewGame("test"),
      bench: [createEmployeeInstance("junior_dessert", 1)],
      nextInstanceId: 2
    };

    const rejected = placeEmployee(state, "employee-1", "dessert_station");

    expect(rejected.slots.find((slot) => slot.slotId === "dessert_station")?.employee).toBeNull();
    expect(rejected.bench.map((employee) => employee.instanceId)).toContain("employee-1");
  });
});

describe("wave simulation", () => {
  it("clears wave 1 with a cashier and barista setup", () => {
    const state = createReadyWaveOneState();

    const report = simulateWave(state);
    expect(report.wave).toBe(1);
    expect(report.failedCustomers).toBe(0);
    expect(report.successfulCustomers).toBe(3);
    expect(report.totalGold).toBeGreaterThan(15);
  });

  it("reports coffee as a bottleneck when coffee coverage is weak", () => {
    let state: GameState = {
      ...createNewGame("test"),
      wave: 3,
      bench: [createEmployeeInstance("junior_dessert", 1)],
      nextInstanceId: 2
    };
    state = placeEmployee(state, "employee-1", "counter");

    const report = simulateWave(state);
    expect(report.failedCustomers).toBeGreaterThan(0);
    expect(report.bottlenecks).toContain("coffee");
    expect(report.reputationDelta).toBeLessThan(0);
  });

  it("scales life penalties from safe early waves into harsher late waves", () => {
    const waveOneReport = simulateWave(createNewGame("test"));
    const specialReport = simulateWave({ ...createNewGame("test"), wave: 18 });

    expect(getCustomerLifePenalty("normal_coffee", 1)).toBe(0);
    expect(getCustomerLifePenalty("normal_coffee", 4)).toBe(1);
    expect(getCustomerLifePenalty("normal_coffee", 8)).toBe(3);
    expect(getCustomerLifePenalty("normal_coffee", 13)).toBe(4);
    expect(getCustomerLifePenalty("difficult_customer", 18)).toBe(7);
    expect(waveOneReport.lifeDelta).toBe(0);
    expect(specialReport.lifeDelta).toBeLessThanOrEqual(-7);
  });

  it("uses four-star throughput in wave simulation", () => {
    const oneStarState: GameState = {
      ...createNewGame("test"),
      bench: [],
      slots: createNewGame("test").slots.map((slot) => ({
        ...slot,
        employee: slot.slotId === "counter" ? createEmployeeInstance("part_timer", 1) : null
      })),
      nextInstanceId: 2
    };
    const fourStarState: GameState = {
      ...oneStarState,
      slots: oneStarState.slots.map((slot) => ({
        ...slot,
        employee: slot.slotId === "counter" ? createEmployeeInstance("part_timer", 1, 4) : null
      }))
    };

    expect(simulateWave(fourStarState).successfulCustomers).toBeGreaterThan(
      simulateWave(oneStarState).successfulCustomers
    );
  });

  it("applies higher throughput from four-cost specialists", () => {
    const lowCostState: GameState = {
      ...createNewGame("test"),
      wave: 8,
      bench: [],
      slots: createNewGame("test").slots.map((slot) => ({
        ...slot,
        employee: slot.slotId === "espresso_machine"
          ? createEmployeeInstance("junior_barista", 1)
          : null
      })),
      nextInstanceId: 2
    };
    const highCostState: GameState = {
      ...lowCostState,
      slots: lowCostState.slots.map((slot) => ({
        ...slot,
        employee: slot.slotId === "espresso_machine"
          ? createEmployeeInstance("head_barista", 1)
          : null
      }))
    };

    const lowCostReport = simulateWave(lowCostState);
    const highCostReport = simulateWave(highCostState);

    expect(highCostReport.successfulCustomers).toBeGreaterThanOrEqual(
      lowCostReport.successfulCustomers
    );
    expect(highCostReport.failedCustomers).toBeLessThanOrEqual(lowCostReport.failedCustomers);
    expect(highCostReport.totalGold).toBeGreaterThanOrEqual(lowCostReport.totalGold);
  });

  it("includes dessert customers from wave 4 onward", () => {
    const state = {
      ...createNewGame("test"),
      wave: 4
    };

    expect(getCurrentWave(state).customerCounts.dessert_customer).toBe(2);
  });

  it("extends wave 8 with commuter rush pressure", () => {
    const state = {
      ...createNewGame("test"),
      wave: 8
    };
    const wave = getCurrentWave(state);
    const report = simulateWave(state);

    expect(wave.customerCounts.commuter_rush).toBe(2);
    expect(wave.arrivalGap).toBeLessThan(2);
    expect(report.outcomes.some((outcome) => outcome.customerId === "commuter_rush")).toBe(true);
  });

  it("extends waves 13 through 17 with hall management customers", () => {
    expect(getCurrentWave({ ...createNewGame("test"), wave: 13 }).customerCounts.complex_order).toBe(3);
    expect(getCurrentWave({ ...createNewGame("test"), wave: 14 }).customerCounts.takeout_customer).toBe(3);
    expect(getCurrentWave({ ...createNewGame("test"), wave: 17 }).customerCounts.dine_in_customer).toBe(5);
  });

  it("introduces clean tasks with dine-in customers from wave 15", () => {
    const wave = getCurrentWave({ ...createNewGame("test"), wave: 15 });
    const state: GameState = {
      ...createNewGame("test"),
      wave: 15,
      storeLevel: 6,
      slots: createNewGame("test").slots.map((slot) => {
        const employees: Record<string, ReturnType<typeof createEmployeeInstance>> = {
          counter: createEmployeeInstance("fast_cashier", 1),
          espresso_machine: createEmployeeInstance("skilled_barista", 2),
          dessert_station: createEmployeeInstance("baking_assistant", 3),
          pickup: createEmployeeInstance("server_part_timer", 4),
          table_station: createEmployeeInstance("cleaning_part_timer", 5)
        };
        return {
          ...slot,
          employee: employees[slot.slotId] ?? null
        };
      }),
      nextInstanceId: 6
    };
    const report = simulateWave(state);

    expect(wave.customerCounts.dine_in_customer).toBe(4);
    expect(
      report.replayFrames.some((frame) =>
        frame.customers.some((customer) => customer.customerId === "dine_in_customer" && customer.currentTask === "clean")
      )
    ).toBe(true);
  });

  it("unlocks the table station at wave 15", () => {
    const lockedState = {
      ...createNewGame("test"),
      wave: 14,
      bench: [createEmployeeInstance("cleaning_part_timer", 1)],
      nextInstanceId: 2
    };
    const unlockedState = {
      ...lockedState,
      wave: 15
    };

    expect(getAvailableSlots(lockedState).some((slot) => slot.slotId === "table_station")).toBe(false);
    expect(placeEmployee(lockedState, "employee-1", "table_station").slots.find((slot) => slot.slotId === "table_station")?.employee).toBeNull();
    expect(getAvailableSlots(unlockedState).some((slot) => slot.slotId === "table_station")).toBe(true);
    expect(placeEmployee(unlockedState, "employee-1", "table_station").slots.find((slot) => slot.slotId === "table_station")?.employee?.definitionId).toBe("cleaning_part_timer");
  });

  it("reports clean as a bottleneck in wave 16 without a table cleaner", () => {
    const state: GameState = {
      ...createNewGame("test"),
      wave: 16,
      storeLevel: 6,
      slots: createNewGame("test").slots.map((slot) => {
        const employees: Record<string, ReturnType<typeof createEmployeeInstance>> = {
          counter: createEmployeeInstance("fast_cashier", 1),
          espresso_machine: createEmployeeInstance("skilled_barista", 2),
          dessert_station: createEmployeeInstance("baking_assistant", 3),
          pickup: createEmployeeInstance("junior_cashier", 4),
          hall_center: createEmployeeInstance("part_timer", 5)
        };
        return {
          ...slot,
          employee: employees[slot.slotId] ?? null
        };
      }),
      nextInstanceId: 6
    };

    expect(simulateWave(state).bottlenecks).toContain("clean");
  });

  it("extends waves 18 through 24 with special reputation pressure", () => {
    expect(getCurrentWave({ ...createNewGame("test"), wave: 18 }).customerCounts.difficult_customer).toBe(1);
    expect(getCurrentWave({ ...createNewGame("test"), wave: 20 }).customerCounts.reviewer_customer).toBe(1);
    expect(getCurrentWave({ ...createNewGame("test"), wave: 24 }).customerCounts.group_customer).toBe(2);
  });

  it("introduces complaint tasks with difficult customers from wave 18", () => {
    const state: GameState = {
      ...createNewGame("test"),
      wave: 18,
      storeLevel: 7,
      slots: createNewGame("test").slots.map((slot) => {
        const employees: Record<string, ReturnType<typeof createEmployeeInstance>> = {
          counter: createEmployeeInstance("fast_cashier", 1),
          espresso_machine: createEmployeeInstance("skilled_barista", 2),
          dessert_station: createEmployeeInstance("baking_assistant", 3),
          pickup: createEmployeeInstance("server_part_timer", 4),
          complaint_desk: createEmployeeInstance("complaint_specialist", 5)
        };
        return {
          ...slot,
          employee: employees[slot.slotId] ?? null
        };
      }),
      nextInstanceId: 6
    };
    const report = simulateWave(state);

    expect(getCurrentWave(state).customerCounts.difficult_customer).toBe(1);
    expect(
      report.replayFrames.some((frame) =>
        frame.customers.some((customer) => customer.customerId === "difficult_customer" && customer.currentTask === "complaint")
      )
    ).toBe(true);
  });

  it("unlocks the complaint desk at wave 18", () => {
    const lockedState = {
      ...createNewGame("test"),
      wave: 17,
      bench: [createEmployeeInstance("complaint_specialist", 1)],
      nextInstanceId: 2
    };
    const unlockedState = {
      ...lockedState,
      wave: 18
    };

    expect(getAvailableSlots(lockedState).some((slot) => slot.slotId === "complaint_desk")).toBe(false);
    expect(placeEmployee(lockedState, "employee-1", "complaint_desk").slots.find((slot) => slot.slotId === "complaint_desk")?.employee).toBeNull();
    expect(getAvailableSlots(unlockedState).some((slot) => slot.slotId === "complaint_desk")).toBe(true);
    expect(placeEmployee(unlockedState, "employee-1", "complaint_desk").slots.find((slot) => slot.slotId === "complaint_desk")?.employee?.definitionId).toBe("complaint_specialist");
  });

  it("reports complaint as a bottleneck in wave 19 without a specialist", () => {
    const state: GameState = {
      ...createNewGame("test"),
      wave: 19,
      storeLevel: 7,
      slots: createNewGame("test").slots.map((slot) => {
        const employees: Record<string, ReturnType<typeof createEmployeeInstance>> = {
          counter: createEmployeeInstance("fast_cashier", 1),
          espresso_machine: createEmployeeInstance("skilled_barista", 2),
          dessert_station: createEmployeeInstance("baking_assistant", 3),
          pickup: createEmployeeInstance("server_part_timer", 4),
          table_station: createEmployeeInstance("cleaning_part_timer", 5),
          hall_center: createEmployeeInstance("hall_staff", 6)
        };
        return {
          ...slot,
          employee: employees[slot.slotId] ?? null
        };
      }),
      nextInstanceId: 7
    };

    expect(simulateWave(state).bottlenecks).toContain("complaint");
  });

  it("creates replay frames for wave 1", () => {
    const state = createReadyWaveOneState();

    const report = simulateWave(state);

    expect(report.replayFrames.length).toBeGreaterThan(1);
    expect(report.replayFrames[0].time).toBe(0);
    expect(report.replayFrames[0].customers).toHaveLength(report.outcomes.length);
    expect(report.replayFrames.some((frame) => frame.workers.some((worker) => worker.workType))).toBe(true);
  });

  it("keeps final replay counts aligned with the round report", () => {
    const state = createReadyWaveOneState();

    const report = simulateWave(state);
    const finalFrame = report.replayFrames.at(-1)!;

    expect(finalFrame.successfulCustomers).toBe(report.successfulCustomers);
    expect(finalFrame.failedCustomers).toBe(report.failedCustomers);
    expect(finalFrame.customers.every((customer) => customer.status === "succeeded" || customer.status === "failed")).toBe(true);
  });

  it("runs the wave into replay mode before showing the report", () => {
    const state = createReadyWaveOneState();

    const running = runCurrentWave(state);

    expect(running.phase).toBe("running");
    expect(running.lastReport?.replayFrames.length).toBeGreaterThan(1);
  });

  it("finishes replay before applying round rewards", () => {
    const state = createReadyWaveOneState();

    const running = runCurrentWave(state);
    const ignored = applyRoundResult(running);
    const report = finishWaveReplay(running);

    expect(ignored.phase).toBe("running");
    expect(ignored.wave).toBe(1);
    expect(report.phase).toBe("report");
    const nextWave = applyRoundResult(report);
    expect(nextWave.phase).toBe("preparation");
    expect(nextWave.wave).toBe(2);
    expect(nextWave.pendingRewards).toHaveLength(0);
  });
});

describe("reward choices", () => {
  it("creates three category-diverse rewards on reward waves", () => {
    const reportState = finishWaveReplay(runCurrentWave({
      ...createReadyWaveOneState(),
      wave: 3
    }));
    const rewardState = applyRoundResult(reportState);

    expect(rewardState.phase).toBe("reward");
    expect(rewardState.pendingRewards).toHaveLength(3);
    expect(new Set(rewardState.pendingRewards.map((reward) => reward.category))).toEqual(
      new Set(["slot", "unit", "stat"])
    );
    expect(rewardState.wave).toBe(3);
    expect(REWARD_WAVES).toContain(3);
  });

  it("advances to preparation only after choosing a reward", () => {
    const rewardState = applyRoundResult(finishWaveReplay(runCurrentWave({
      ...createReadyWaveOneState(),
      wave: 3
    })));
    const nextState = chooseReward(rewardState, rewardState.pendingRewards[0].id);

    expect(nextState.phase).toBe("preparation");
    expect(nextState.wave).toBe(4);
    expect(nextState.pendingRewards).toHaveLength(0);
    expect(nextState.lastReport).toBeNull();
  });

  it("applies slot upgrades up to the slot cap", () => {
    const state = {
      ...createNewGame("test"),
      phase: "reward" as const,
      pendingRewards: [
        {
          id: "slot-reward",
          kind: "slot_upgrade" as const,
          category: "slot" as const,
          title: "계산대 강화",
          description: "테스트",
          amount: 0.1,
          slotId: "counter",
          workType: "order" as const
        }
      ],
      upgrades: {
        workBonuses: {},
        slotBonuses: { counter: 0.25 }
      }
    };

    const nextState = chooseReward(state, "slot-reward");

    expect(nextState.upgrades.slotBonuses.counter).toBe(0.3);
    expect(getEffectiveSlotBonus(nextState, "counter")).toBeCloseTo(0.6);
  });

  it("adds an employee reward to the bench", () => {
    const state = {
      ...createNewGame("test"),
      phase: "reward" as const,
      pendingRewards: [
        {
          id: "employee-reward",
          kind: "employee" as const,
          category: "unit" as const,
          title: "알바생 합류",
          description: "테스트",
          amount: 1,
          employeeId: "part_timer"
        }
      ]
    };

    const nextState = chooseReward(state, "employee-reward");

    expect(nextState.bench.some((employee) => employee.definitionId === "part_timer")).toBe(true);
    expect(nextState.nextInstanceId).toBe(2);
  });

  it("applies gold, reputation, and work bonus rewards", () => {
    const base = {
      ...createNewGame("test"),
      phase: "reward" as const,
      reputation: 70
    };

    const goldState = chooseReward({
      ...base,
      pendingRewards: [{
        id: "gold",
        kind: "gold" as const,
        category: "stat" as const,
        title: "추가 매출",
        description: "테스트",
        amount: 6
      }]
    }, "gold");
    const reputationState = chooseReward({
      ...base,
      pendingRewards: [{
        id: "reputation",
        kind: "reputation" as const,
        category: "stat" as const,
        title: "평판 회복",
        description: "테스트",
        amount: 8
      }]
    }, "reputation");
    const workState = chooseReward({
      ...base,
      pendingRewards: [{
        id: "work",
        kind: "work_bonus" as const,
        category: "stat" as const,
        title: "커피 훈련",
        description: "테스트",
        amount: 0.05,
        workType: "coffee" as const
      }]
    }, "work");

    expect(goldState.gold).toBe(36);
    expect(reputationState.reputation).toBe(78);
    expect(workState.upgrades.workBonuses.coffee).toBe(0.05);
  });

  it("does not create unit rewards when the bench is full", () => {
    const state = {
      ...createNewGame("test"),
      bench: Array.from({ length: MAX_BENCH_EMPLOYEES }, (_, index) =>
        createEmployeeInstance("part_timer", index + 1)
      )
    };
    const rewards = generateRewardChoices(state, simulateWave(createReadyWaveOneState()));

    expect(rewards.some((reward) => reward.category === "unit")).toBe(false);
    expect(rewards).toHaveLength(3);
  });

  it("skips rewards on non-reward waves", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 7,
      storeLevel: 4,
      lastReport: createTestReport({ wave: 7, successfulCustomers: 8, failedCustomers: 0 })
    };
    const advanced = applyRoundResult(reportState);

    expect(advanced.phase).toBe("preparation");
    expect(advanced.wave).toBe(8);
    expect(advanced.pendingRewards).toHaveLength(0);
  });

  it("keeps wave 12 in the reward loop now that hall waves exist", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 12,
      lastReport: {
        wave: 12,
        stage: "출근길 러시",
        successfulCustomers: 10,
        failedCustomers: 0,
        baseGold: 6,
        customerGold: 100,
        tipGold: 0,
        reputationBonusGold: 0,
        totalGold: 106,
        reputationDelta: 0,
        lifeDelta: 0,
        expGained: 2,
        bottlenecks: [],
        outcomes: [],
        replayFrames: [],
        duration: 30
      }
    };
    const rewarded = applyRoundResult(reportState);

    expect(rewarded.phase).toBe("reward");
    expect(rewarded.pendingRewards).toHaveLength(3);
  });

  it("skips wave 17 rewards and advances into the final reward band", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 17,
      lastReport: {
        wave: 17,
        stage: "복합 주문 / 홀 관리",
        successfulCustomers: 12,
        failedCustomers: 0,
        baseGold: 6,
        customerGold: 180,
        tipGold: 0,
        reputationBonusGold: 0,
        totalGold: 186,
        reputationDelta: 0,
        lifeDelta: 0,
        expGained: 2,
        bottlenecks: [],
        outcomes: [],
        replayFrames: [],
        duration: 40
      }
    };
    const advanced = applyRoundResult(reportState);

    expect(advanced.phase).toBe("preparation");
    expect(advanced.wave).toBe(18);
    expect(advanced.pendingRewards).toHaveLength(0);
  });

  it("keeps wave 18 in the reward loop", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 18,
      lastReport: createTestReport({ wave: 18 })
    };
    const rewarded = applyRoundResult(reportState);

    expect(rewarded.phase).toBe("reward");
    expect(rewarded.pendingRewards).toHaveLength(3);
  });

  it("clears wave 24 without opening reward choices", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 24,
      lastReport: createTestReport({ wave: 24, successfulCustomers: 15, failedCustomers: 0, totalGold: 265 })
    };
    const cleared = applyRoundResult(reportState);

    expect(cleared.phase).toBe("cleared");
    expect(cleared.pendingRewards).toHaveLength(0);
  });

  it("keeps game over ahead of final wave clear", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 24,
      reputation: 10,
      lastReport: createTestReport({
        wave: 24,
        successfulCustomers: 0,
        failedCustomers: 8,
        totalGold: 5,
        reputationDelta: -80
      })
    };
    const result = applyRoundResult(reportState);

    expect(result.phase).toBe("gameOver");
  });

  it("keeps life zero game over ahead of final wave clear", () => {
    const reportState: GameState = {
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 24,
      life: 5,
      lastReport: createTestReport({
        wave: 24,
        successfulCustomers: 8,
        failedCustomers: 2,
        lifeDelta: -6
      })
    };
    const result = applyRoundResult(reportState);

    expect(result.phase).toBe("gameOver");
    expect(result.life).toBe(0);
  });

  it("keeps clean and complaint upgrades eligible as late-game rewards", () => {
    const state = {
      ...createNewGame("test"),
      wave: 19
    };
    const cleanRewards = generateRewardChoices(
      state,
      createTestReport({ wave: 19, bottlenecks: ["clean"] })
    );
    const complaintRewards = generateRewardChoices(
      state,
      createTestReport({ wave: 19, bottlenecks: ["complaint"] })
    );

    expect(cleanRewards.some((reward) => reward.workType === "clean")).toBe(true);
    expect(complaintRewards.some((reward) => reward.workType === "complaint")).toBe(true);
  });
});

describe("final result and QA helpers", () => {
  it("calculates final grades from reputation, gold, and success rate", () => {
    const sResult = calculateFinalResult(
      95,
      720,
      createTestReport({ wave: 24, successfulCustomers: 15, failedCustomers: 0 })
    );
    const dResult = calculateFinalResult(
      20,
      80,
      createTestReport({ wave: 24, successfulCustomers: 3, failedCustomers: 7 })
    );

    expect(sResult.grade).toBe("S");
    expect(sResult.successRate).toBe(1);
    expect(dResult.grade).toBe("D");
  });

  it("creates final grade data after wave 24 clear", () => {
    const cleared = applyRoundResult({
      ...createReadyWaveOneState(),
      phase: "report",
      wave: 24,
      gold: 500,
      lastReport: createTestReport({ wave: 24, successfulCustomers: 12, failedCustomers: 3, totalGold: 180 })
    });

    expect(cleared.phase).toBe("cleared");
    expect(cleared.lastReport).not.toBeNull();
    expect(calculateFinalResult(cleared.reputation, cleared.gold, cleared.lastReport!).grade).toMatch(/[A-D]|S/);
  });

  it("creates debug states at a requested wave without exposing UI controls", () => {
    const debugState = createDebugGameAtWave(18, "debug-test");
    const completed = completeCurrentWaveForDebug(debugState, {
      successfulCustomers: 4,
      failedCustomers: 0,
      totalGold: 60
    });

    expect(debugState.wave).toBe(18);
    expect(debugState.storeLevel).toBe(8);
    expect(completed.phase).toBe("reward");
    expect(completed.wave).toBe(18);
  });

  it("smoke tests representative release-candidate wave bands", () => {
    for (const wave of [1, 8, 13, 18, 24]) {
      const state = createRepresentativeWaveState(wave);
      const report = simulateWave(state);
      const expectedCustomers = Object.values(getCurrentWave(state).customerCounts).reduce(
        (sum, count) => sum + count,
        0
      );

      expect(report.wave).toBe(wave);
      expect(report.outcomes).toHaveLength(expectedCustomers);
      expect(report.replayFrames.length).toBeGreaterThan(0);
    }
  });

  it("keeps wave 24 clearable for a well-prepared release-candidate state", () => {
    const state = createRepresentativeWaveState(24);
    const report = simulateWave(state);
    const result = applyRoundResult({
      ...state,
      phase: "report",
      lastReport: report
    });

    expect(report.successfulCustomers).toBeGreaterThan(0);
    expect(result.phase).toBe("cleared");
    expect(result.lastReport).toBe(report);
  });
});

function createReadyWaveOneState() {
  let state = createGameWithShop(["junior_barista", "junior_cashier"]);
  state = buyEmployee(state, 0);
  state = buyEmployee(state, 1);
  state = placeEmployee(state, state.bench[0].instanceId, "espresso_machine");
  state = placeEmployee(state, state.bench[0].instanceId, "counter");
  return state;
}

function createGameWithShop(employeeIds: string[], seed = "test-shop"): GameState {
  return {
    ...createNewGame(seed),
    shop: employeeIds.map((employeeId, index) => ({
      offerId: `test-offer-${index}`,
      employeeId
    }))
  };
}

function createRepresentativeWaveState(wave: number): GameState {
  const state = createDebugGameAtWave(wave, `rc-smoke-${wave}`);
  const star = wave >= 23 ? 3 : wave >= 8 ? 2 : 1;
  const employees: Partial<Record<string, ReturnType<typeof createEmployeeInstance>>> = {};
  let nextInstanceId = 1;
  const assign = (slotId: string, definitionId: string) => {
    employees[slotId] = createEmployeeInstance(definitionId, nextInstanceId, star);
    nextInstanceId += 1;
  };

  assign("counter", wave >= 8 ? "fast_cashier" : "junior_cashier");
  assign("espresso_machine", wave >= 8 ? "skilled_barista" : "junior_barista");

  if (wave >= 4) {
    assign("dessert_station", "baking_assistant");
    assign("pickup", "server_part_timer");
  }

  if (wave >= 13) {
    assign("hall_center", "hall_staff");
  }

  if (wave >= 15 && wave < 18) {
    assign("table_station", "cleaning_part_timer");
  }

  if (wave >= 18) {
    assign("cleaning_zone", "cleaning_part_timer");
    assign("complaint_desk", "complaint_specialist");
  }

  if (wave >= 22) {
    assign("manager_station", "cafe_manager");
  }

  return {
    ...state,
    nextInstanceId,
    slots: state.slots.map((slot) => ({
      ...slot,
      employee: employees[slot.slotId] ?? null
    })),
    upgrades: {
      slotBonuses: wave >= 18
        ? {
            espresso_machine: 0.1,
            dessert_station: 0.1,
            pickup: 0.1,
            cleaning_zone: 0.2,
            complaint_desk: 0.2
          }
        : {},
      workBonuses: wave >= 18
        ? {
            coffee: 0.05,
            dessert: 0.05,
            serve: 0.05,
            clean: 0.1,
            complaint: 0.1
          }
        : wave >= 13
          ? {
              serve: 0.05,
              clean: 0.05
            }
          : {}
    }
  };
}

function createTestReport(overrides: Partial<RoundReport> = {}): RoundReport {
  return {
    wave: 24,
    stage: "마감 피크",
    successfulCustomers: 10,
    failedCustomers: 0,
    baseGold: 6,
    customerGold: 100,
    tipGold: 0,
    reputationBonusGold: 0,
    totalGold: 106,
    reputationDelta: 0,
    lifeDelta: 0,
    expGained: 2,
    bottlenecks: [],
    outcomes: [],
    replayFrames: [],
    duration: 30,
    ...overrides
  };
}
