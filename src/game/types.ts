export type WorkType =
  | "order"
  | "coffee"
  | "dessert"
  | "serve"
  | "clean"
  | "complaint";

export type SynergyTag = "coffee" | "dessert" | "service" | "newbie";

export type Satisfaction = "Perfect" | "Good" | "Late" | "Failed";

export type FinalGrade = "S" | "A" | "B" | "C" | "D";

export type GamePhase =
  | "preparation"
  | "running"
  | "report"
  | "reward"
  | "gameOver"
  | "cleared";

export type CostTier = 1 | 2 | 3 | 4;

export interface EmployeeDefinition {
  id: string;
  name: string;
  cost: CostTier;
  role: string;
  tags: SynergyTag[];
  efficiency: Record<WorkType, number>;
}

export interface EmployeeInstance {
  instanceId: string;
  definitionId: string;
  star: 1 | 2 | 3 | 4;
}

export interface CustomerTask {
  type: WorkType;
  amount: number;
}

export interface CustomerDefinition {
  id: string;
  name: string;
  tasks: CustomerTask[];
  patience: number;
  rewardGold: number;
  failPenalty: number;
}

export interface SlotDefinition {
  id: string;
  name: string;
  workType: WorkType;
  efficiencyBonus: number;
  availableWave: number;
}

export interface WaveDefinition {
  wave: number;
  stage: string;
  title: string;
  customerCounts: Record<string, number>;
  arrivalGap?: number;
  preview: {
    coffee: "낮음" | "보통" | "많음";
    dessert: "낮음" | "보통" | "많음";
    queue: "낮음" | "보통" | "높음";
    note: string;
  };
}

export interface StoreLevelDefinition {
  level: number;
  expToNext: number | null;
  maxEmployees: number;
  shopSlots: number;
  costWeights: Partial<Record<CostTier, number>>;
}

export interface ShopOffer {
  offerId: string;
  employeeId: string;
}

export interface SlotState {
  slotId: string;
  employee: EmployeeInstance | null;
}

export interface GameState {
  phase: GamePhase;
  seed: string;
  rollCounter: number;
  nextInstanceId: number;
  wave: number;
  gold: number;
  reputation: number;
  life: number;
  storeLevel: number;
  exp: number;
  shop: Array<ShopOffer | null>;
  bench: EmployeeInstance[];
  slots: SlotState[];
  lastReport: RoundReport | null;
  pendingRewards: RewardChoice[];
  upgrades: GameUpgrades;
}

export interface ActiveSynergy {
  tag: SynergyTag;
  label: string;
  count: number;
  required: number;
  active: boolean;
  description: string;
}

export interface SynergyEffects {
  workBonus: Partial<Record<WorkType, number>>;
  costOneEfficiencyBonus: number;
  patienceDecayMultiplier: number;
}

export type RewardKind =
  | "slot_upgrade"
  | "employee"
  | "gold"
  | "reputation"
  | "work_bonus";

export type RewardCategory = "slot" | "unit" | "stat";

export interface RewardChoice {
  id: string;
  kind: RewardKind;
  category: RewardCategory;
  title: string;
  description: string;
  amount: number;
  slotId?: string;
  employeeId?: string;
  workType?: WorkType;
}

export interface GameUpgrades {
  workBonuses: Partial<Record<WorkType, number>>;
  slotBonuses: Record<string, number>;
}

export interface CustomerOutcome {
  customerId: string;
  customerName: string;
  satisfaction: Satisfaction;
  remainingPatience: number;
  rewardGold: number;
  reputationDelta: number;
}

export type ReplayCustomerStatus = "waiting" | "active" | "succeeded" | "failed";

export interface ReplayCustomerState {
  id: string;
  customerId: string;
  customerName: string;
  status: ReplayCustomerStatus;
  currentTask: WorkType | null;
  taskProgress: number;
  totalProgress: number;
  remainingPatience: number;
  patienceRatio: number;
}

export interface ReplayWorkerState {
  employeeId: string;
  employeeName: string;
  slotId: string;
  targetCustomerId: string | null;
  workType: WorkType | null;
  throughput: number;
}

export interface RoundReplayFrame {
  time: number;
  customers: ReplayCustomerState[];
  workers: ReplayWorkerState[];
  successfulCustomers: number;
  failedCustomers: number;
  activeCustomers: number;
  bottlenecks: WorkType[];
}

export interface RoundReport {
  wave: number;
  stage: string;
  successfulCustomers: number;
  failedCustomers: number;
  baseGold: number;
  customerGold: number;
  tipGold: number;
  reputationBonusGold: number;
  totalGold: number;
  reputationDelta: number;
  lifeDelta: number;
  expGained: number;
  bottlenecks: WorkType[];
  outcomes: CustomerOutcome[];
  replayFrames: RoundReplayFrame[];
  duration: number;
}

export interface FinalResult {
  grade: FinalGrade;
  score: number;
  successRate: number;
}
