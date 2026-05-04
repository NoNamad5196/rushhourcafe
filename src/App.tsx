import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  applyRoundResult,
  buyEmployee,
  buyExp,
  calculateFinalResult,
  calculateSynergies,
  chooseReward,
  createNewGame,
  finishWaveReplay,
  getCurrentWave,
  getEmployeeBuyPrice,
  getEmployeeUpgradeCost,
  getEmployeeSellValue,
  getEmployeeDefinition,
  getEffectiveSlotBonus,
  getPlacedEmployees,
  getStoreLevelDefinition,
  BUY_EXP_COST,
  BUY_EXP_AMOUNT,
  REWARD_WAVES,
  SHOP_REROLL_COST,
  MAX_BENCH_EMPLOYEES,
  placeEmployee,
  refreshShop,
  runCurrentWave,
  sellEmployee,
  unplaceEmployee,
  upgradeEmployee
} from "./game/engine";
import { slotDefinitions, tagLabels, waveDefinitions, workLabels } from "./game/data";
import { clearSavedGame, loadSavedGame, saveGame } from "./game/save";
import type {
  ActiveSynergy,
  EmployeeDefinition,
  EmployeeInstance,
  GameState,
  GameUpgrades,
  RewardChoice,
  RoundReport,
  RoundReplayFrame,
  ShopOffer,
  SlotState,
  StoreLevelDefinition,
  WaveDefinition,
  WorkType
} from "./game/types";

const MAX_SHOP_CELLS = 5;
const BENCH_CELLS = MAX_BENCH_EMPLOYEES;
const FINAL_WAVE = waveDefinitions.at(-1)?.wave ?? 1;

type DragSource =
  | { employeeId: string; from: "bench" }
  | { employeeId: string; from: "slot"; slotId: string };

type DropNotice = {
  id: number;
  tone: "success" | "danger";
  message: string;
};

type PointerDragState = {
  source: DragSource;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

type BootState = {
  game: GameState;
  hasSavedGame: boolean;
};

const slotLayout: Record<string, { className: string; zone: string; hint: string }> = {
  counter: {
    className: "slot-counter",
    zone: "Front",
    hint: "입구와 가장 가까운 주문 처리 지점"
  },
  espresso_machine: {
    className: "slot-espresso",
    zone: "Bar",
    hint: "커피 제작 핵심 포지션"
  },
  pickup: {
    className: "slot-pickup",
    zone: "Serve",
    hint: "완성 주문을 빠르게 내보내는 위치"
  },
  dessert_station: {
    className: "slot-dessert",
    zone: "Dessert",
    hint: "디저트 주문 대응 포지션"
  },
  hall_center: {
    className: "slot-hall",
    zone: "Hall",
    hint: "픽업과 홀 동선을 받쳐주는 포지션"
  },
  table_station: {
    className: "slot-table",
    zone: "Clean",
    hint: "테이블 이용 손님 회전율을 지키는 위치"
  },
  cleaning_zone: {
    className: "slot-cleaning",
    zone: "Clean+",
    hint: "마감 피크의 테이블 정리 병목을 줄이는 구역"
  },
  complaint_desk: {
    className: "slot-complaint",
    zone: "Care",
    hint: "진상 손님과 리뷰어의 평판 위험을 막는 자리"
  },
  manager_station: {
    className: "slot-manager",
    zone: "Mgr",
    hint: "후반 평판 관리와 홀 안정성을 받쳐주는 자리"
  }
};

function createInitialAppState(): BootState {
  const savedGame = loadSavedGame();
  return {
    game: savedGame ?? createNewGame(),
    hasSavedGame: Boolean(savedGame)
  };
}

function App() {
  const bootStateRef = useRef<BootState | null>(null);
  if (bootStateRef.current === null) {
    bootStateRef.current = createInitialAppState();
  }

  const [gameState, setGame] = useState<GameState>(() => bootStateRef.current!.game);
  const game = useMemo(() => normalizeGameState(gameState), [gameState]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragSource | null>(null);
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null);
  const [hoverDropTarget, setHoverDropTarget] = useState<string | null>(null);
  const [dropNotice, setDropNotice] = useState<DropNotice | null>(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(
    () => bootStateRef.current!.hasSavedGame
  );
  const [newGameConfirmOpen, setNewGameConfirmOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(() =>
    bootStateRef.current!.hasSavedGame
      ? `저장 데이터 감지 · Wave ${bootStateRef.current!.game.wave}`
      : "자동 저장 준비됨"
  );
  const suppressNextClickRef = useRef(false);

  const wave = game.phase === "cleared" ? null : getCurrentWave(game);
  const level = getStoreLevelDefinition(game.storeLevel);
  const placedEmployees = getPlacedEmployees(game);
  const synergies = useMemo(() => calculateSynergies(game), [game]);
  const selectedEmployee = selectedEmployeeId
    ? findEmployee(game, selectedEmployeeId)
    : null;
  const selectedIsPlaced = selectedEmployeeId
    ? game.slots.some((slot) => slot.employee?.instanceId === selectedEmployeeId)
    : false;
  const canEditBoard = game.phase === "preparation";
  const canPlaceEmptySlot =
    canEditBoard &&
    Boolean(selectedEmployeeId) &&
    (selectedIsPlaced || placedEmployees.length < level.maxEmployees);
  const draggedEmployee = dragState ? findEmployee(game, dragState.employeeId) : null;
  const pointerDraggedEmployee = pointerDrag
    ? findEmployee(game, pointerDrag.source.employeeId)
    : null;

  useEffect(() => {
    saveGame(game);
    setSaveStatus(`자동 저장됨 · Wave ${game.wave}`);
  }, [game]);

  const finishDrag = () => {
    setDragState(null);
    setPointerDrag(null);
    setHoverDropTarget(null);
  };

  const dropSourceOnSlot = (source: DragSource, slotId: string) => {
    const status = getSlotDropStatus(game, level, source, slotId);
    if (!status.allowed) {
      flashDropNotice(status.reason, "danger");
      return false;
    }

    const targetSlot = game.slots.find((slot) => slot.slotId === slotId);
    const placingBenchEmployeeOnEmptySlot = source.from === "bench" && !targetSlot?.employee;

    mutate(placeEmployee(game, source.employeeId, slotId));
    setSelectedEmployeeId(placingBenchEmployeeOnEmptySlot ? null : source.employeeId);
    flashDropNotice(status.message, "success");
    return true;
  };

  const dropSourceOnBench = (source: DragSource) => {
    if (!canEditBoard) {
      flashDropNotice("영업 중에는 배치를 바꿀 수 없습니다.", "danger");
      return false;
    }

    if (source.from !== "slot") {
      flashDropNotice("이미 벤치에 있는 직원입니다.", "danger");
      return false;
    }

    if (game.bench.length >= MAX_BENCH_EMPLOYEES) {
      flashDropNotice("벤치가 가득 찼습니다. 더 이상 유닛을 받을 수 없습니다.", "danger");
      return false;
    }

    mutate(unplaceEmployee(game, source.slotId));
    setSelectedEmployeeId(source.employeeId);
    flashDropNotice("벤치로 회수했습니다.", "success");
    return true;
  };

  const handleBuyEmployee = (offerIndex: number) => {
    if (!canEditBoard) {
      flashDropNotice("영업 중에는 직원을 고용할 수 없습니다.", "danger");
      return;
    }

    if (game.bench.length >= MAX_BENCH_EMPLOYEES) {
      flashDropNotice("벤치가 가득 찼습니다. 더 이상 유닛을 구매할 수 없습니다.", "danger");
      return;
    }

    const offer = game.shop[offerIndex];
    if (!offer) {
      return;
    }

    const definition = getEmployeeDefinition(offer.employeeId);
    const price = getEmployeeBuyPrice(definition.id);
    if (game.gold < price) {
      flashDropNotice("골드가 부족합니다.", "danger");
      return;
    }

    mutate(buyEmployee(game, offerIndex));
  };

  const handlePlaceOnSlot = (slotId: string) => {
    if (!selectedEmployeeId) {
      return;
    }

    const selectedSlotId = findSlotIdForEmployee(game, selectedEmployeeId);
    const source: DragSource = selectedSlotId
      ? { employeeId: selectedEmployeeId, from: "slot", slotId: selectedSlotId }
      : { employeeId: selectedEmployeeId, from: "bench" };

    dropSourceOnSlot(source, slotId);
  };

  const handleUnplaceSlot = (slotId: string) => {
    const slot = game.slots.find((item) => item.slotId === slotId);
    if (!slot?.employee) {
      return;
    }

    dropSourceOnBench({
      employeeId: slot.employee.instanceId,
      from: "slot",
      slotId
    });
  };

  const handleSelectBench = (employeeId: string) => {
    if (suppressNextClickRef.current) {
      return;
    }

    if (selectedEmployeeId && selectedIsPlaced && canEditBoard) {
      const selectedSlotId = findSlotIdForEmployee(game, selectedEmployeeId);
      if (selectedSlotId) {
        mutate(placeEmployee(game, employeeId, selectedSlotId));
        setSelectedEmployeeId(employeeId);
        flashDropNotice("벤치 직원과 포지션을 교체했습니다.", "success");
        return;
      }
    }

    setSelectedEmployeeId(employeeId);
  };

  const handleBenchEmptyClick = () => {
    if (!selectedEmployeeId) {
      return;
    }

    const selectedSlotId = findSlotIdForEmployee(game, selectedEmployeeId);
    if (!selectedSlotId) {
      flashDropNotice("이미 벤치에 있는 직원입니다.", "danger");
      return;
    }

    dropSourceOnBench({
      employeeId: selectedEmployeeId,
      from: "slot",
      slotId: selectedSlotId
    });
  };

  const handleChooseReward = (rewardId: string) => {
    const reward = game.pendingRewards.find((item) => item.id === rewardId);
    if (reward?.kind === "employee" && game.bench.length >= MAX_BENCH_EMPLOYEES) {
      flashDropNotice("벤치가 가득 찼습니다. 더 이상 유닛을 받을 수 없습니다.", "danger");
      return;
    }

    mutate(chooseReward(game, rewardId));
  };

  const handleUpgradeEmployee = (employee: EmployeeInstance) => {
    if (!canEditBoard) {
      flashDropNotice("영업 중에는 직원을 성장시킬 수 없습니다.", "danger");
      return;
    }

    const cost = getEmployeeUpgradeCost(employee);
    if (cost === null) {
      flashDropNotice("이미 최고 성급입니다.", "danger");
      return;
    }

    if (game.gold < cost) {
      flashDropNotice("성장에 필요한 매출이 부족합니다.", "danger");
      return;
    }

    const definition = getEmployeeDefinition(employee.definitionId);
    const nextStar = (employee.star + 1) as EmployeeInstance["star"];
    mutate(upgradeEmployee(game, employee.instanceId));
    flashDropNotice(`${definition.name}이 ${starText(nextStar)}로 성장했습니다!`, "success");
  };

  const handleNewGame = () => {
    setNewGameConfirmOpen(true);
  };

  const confirmNewGame = () => {
    const nextGame = createNewGame(`${Date.now()}`);
    clearSavedGame();
    setSelectedEmployeeId(null);
    setDragState(null);
    setPointerDrag(null);
    setHoverDropTarget(null);
    setDropNotice(null);
    setResumePromptOpen(false);
    setNewGameConfirmOpen(false);
    setSaveStatus(`새 게임 시작 · Wave ${nextGame.wave}`);
    setGame(nextGame);
  };

  const handleClearSave = () => {
    clearSavedGame();
    setResumePromptOpen(false);
    setSaveStatus("저장 삭제됨 · 현재 플레이는 유지");
    flashDropNotice("저장 데이터를 삭제했습니다.", "success");
  };

  const mutate = (next: GameState) => {
    setSelectedEmployeeId((current) =>
      current && !hasEmployee(next, current) ? null : current
    );
    setGame(next);
  };

  const flashDropNotice = (message: string, tone: DropNotice["tone"]) => {
    const id = Date.now();
    setDropNotice({ id, tone, message });
    window.setTimeout(() => {
      setDropNotice((current) => (current?.id === id ? null : current));
    }, 1500);
  };

  const beginEmployeeDrag = (source: DragSource, event: DragEvent) => {
    if (!canEditBoard) {
      event.preventDefault();
      flashDropNotice("영업 중에는 배치를 바꿀 수 없습니다.", "danger");
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", source.employeeId);
    setSelectedEmployeeId(source.employeeId);
    setDragState(source);
    setHoverDropTarget(null);
  };

  const handleSlotDragOver = (slotId: string, event: DragEvent) => {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const status = getSlotDropStatus(game, level, dragState, slotId);
    event.dataTransfer.dropEffect = status.allowed ? "move" : "none";
    const targetKey = `slot:${slotId}`;
    setHoverDropTarget((current) => (current === targetKey ? current : targetKey));
  };

  const handleSlotDrop = (slotId: string, event: DragEvent) => {
    event.preventDefault();
    if (!dragState) {
      return;
    }

    dropSourceOnSlot(dragState, slotId);
    finishDrag();
  };

  const handleBenchDragOver = (event: DragEvent) => {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = dragState.from === "slot" ? "move" : "none";
    setHoverDropTarget((current) => (current === "bench" ? current : "bench"));
  };

  const handleBenchDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!dragState) {
      return;
    }

    dropSourceOnBench(dragState);
    finishDrag();
  };

  const beginEmployeePointerDrag = (
    source: DragSource,
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (event.button !== 0) {
      return;
    }

    if (!canEditBoard) {
      flashDropNotice("영업 중에는 배치를 바꿀 수 없습니다.", "danger");
      return;
    }

    setPointerDrag({
      source,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false
    });
  };

  useEffect(() => {
    if (!pointerDrag) {
      return;
    }

    const getDropTarget = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y);
      return element instanceof HTMLElement
        ? element.closest<HTMLElement>("[data-drop-target]")?.dataset.dropTarget ?? null
        : null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const moved =
        Math.abs(event.clientX - pointerDrag.startX) > 6 ||
        Math.abs(event.clientY - pointerDrag.startY) > 6;
      if (!pointerDrag.active && !moved) {
        return;
      }

      if (!pointerDrag.active) {
        setDragState(pointerDrag.source);
      }

      setPointerDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              active: true
            }
          : current
      );

      const target = getDropTarget(event.clientX, event.clientY);
      setHoverDropTarget((current) => (current === target ? current : target));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerDrag.active) {
        finishDrag();
        return;
      }

      suppressNextClickRef.current = true;
      const target = getDropTarget(event.clientX, event.clientY);
      if (target?.startsWith("slot:")) {
        dropSourceOnSlot(pointerDrag.source, target.slice("slot:".length));
      } else if (target === "bench") {
        dropSourceOnBench(pointerDrag.source);
      } else {
        flashDropNotice("놓을 수 있는 위치가 아닙니다.", "danger");
      }

      finishDrag();
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [pointerDrag, game, level, canEditBoard]);

  return (
    <main className="app-shell warm">
        <Hud
          game={game}
          level={level}
          placedCount={placedEmployees.length}
          benchCount={game.bench.length}
          onNewGame={handleNewGame}
          onClearSave={handleClearSave}
          saveStatus={saveStatus}
        />

      <section className="game-stage">
        <WavePanel
          wave={wave}
          phase={game.phase}
          canStart={game.phase === "preparation" && placedEmployees.length > 0}
          onStart={() => mutate(runCurrentWave(game))}
        />

        <CafeBoard
          game={game}
          level={level}
          selectedEmployeeId={selectedEmployeeId}
          placedCount={placedEmployees.length}
          canEditBoard={canEditBoard}
          canPlaceEmptySlot={canPlaceEmptySlot}
          dragState={dragState}
          hoverDropTarget={hoverDropTarget}
          dropNotice={dropNotice}
          draggedEmployee={draggedEmployee}
          onEmployeeDragStart={beginEmployeeDrag}
          onEmployeePointerDown={beginEmployeePointerDrag}
          onDragEnd={finishDrag}
          onSlotDragOver={handleSlotDragOver}
          onSlotDrop={handleSlotDrop}
          onSlotDragLeave={() => setHoverDropTarget(null)}
          onPlace={handlePlaceOnSlot}
          onUnplace={handleUnplaceSlot}
          onSelectPlaced={(employeeId) => {
            if (!suppressNextClickRef.current) {
              setSelectedEmployeeId(employeeId);
            }
          }}
          onFinishReplay={() => mutate(finishWaveReplay(game))}
          onApplyReport={() => mutate(applyRoundResult(game))}
          onChooseReward={handleChooseReward}
          onNewGame={handleNewGame}
        />

        <InfoPanel
          selectedEmployee={selectedEmployee}
          synergies={synergies}
          upgrades={game.upgrades}
          gold={game.gold}
          canEdit={canEditBoard}
          onUpgradeEmployee={handleUpgradeEmployee}
        />

        <ShopDock
          game={game}
          level={level}
          benchCount={game.bench.length}
          selectedEmployeeId={selectedEmployeeId}
          onBuy={handleBuyEmployee}
          onRefresh={() => mutate(refreshShop(game))}
          onBuyExp={() => mutate(buyExp(game))}
          onSelectBench={handleSelectBench}
          onBenchEmptyClick={handleBenchEmptyClick}
          onSell={(instanceId) => mutate(sellEmployee(game, instanceId))}
          dragState={dragState}
          hoverDropTarget={hoverDropTarget}
          onEmployeeDragStart={beginEmployeeDrag}
          onEmployeePointerDown={beginEmployeePointerDrag}
          onDragEnd={finishDrag}
          onBenchDragOver={handleBenchDragOver}
          onBenchDrop={handleBenchDrop}
          onBenchDragLeave={() => setHoverDropTarget(null)}
        />

        {pointerDrag?.active && pointerDraggedEmployee && (
          <DragPreview employee={pointerDraggedEmployee} x={pointerDrag.x} y={pointerDrag.y} />
        )}

        {resumePromptOpen && (
          <SaveChoiceOverlay
            wave={game.wave}
            onContinue={() => setResumePromptOpen(false)}
            onNewGame={handleNewGame}
            onClearSave={handleClearSave}
          />
        )}

        {newGameConfirmOpen && (
          <NewGameConfirmOverlay
            onCancel={() => setNewGameConfirmOpen(false)}
            onConfirm={confirmNewGame}
          />
        )}
      </section>
    </main>
  );
}

function Hud({
  game,
  level,
  placedCount,
  benchCount,
  onNewGame,
  onClearSave,
  saveStatus
}: {
  game: GameState;
  level: StoreLevelDefinition;
  placedCount: number;
  benchCount: number;
  onNewGame: () => void;
  onClearSave: () => void;
  saveStatus: string;
}) {
  return (
    <header className="hud">
      <div className="brand-lockup">
        <span>Rush Hour Café</span>
        <strong>Auto Shift</strong>
      </div>
      <div className="hud-stats">
        <HudStat label="Wave" value={game.phase === "cleared" ? "Clear" : `${game.wave}/${FINAL_WAVE}`} />
        <HudStat label="평판" value={game.reputation} tone={game.reputation < 40 ? "danger" : "good"} />
        <HudStat label="체력" value={game.life} tone={game.life <= 6 ? "danger" : "good"} />
        <HudStat label="매출" value={`${game.gold}G`} tone="gold" />
        <HudStat label="레벨" value={`Lv.${game.storeLevel}`} />
        <HudStat
          label="EXP"
          value={level.expToNext === null ? "MAX" : `${game.exp}/${level.expToNext}`}
        />
        <HudStat label="출근" value={`${placedCount}/${level.maxEmployees}`} />
        <HudStat label="벤치" value={`${benchCount}/${MAX_BENCH_EMPLOYEES}`} />
      </div>
      <div className="hud-actions">
        <span className="save-status">{saveStatus}</span>
        <div>
          <button className="ghost-button" onClick={onClearSave}>
            저장 삭제
          </button>
          <button className="ghost-button primary" onClick={onNewGame}>
            새 게임
          </button>
        </div>
      </div>
    </header>
  );
}

function HudStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone?: "gold" | "good" | "danger";
}) {
  return (
    <div className={`hud-stat ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SaveChoiceOverlay({
  wave,
  onContinue,
  onNewGame,
  onClearSave
}: {
  wave: number;
  onContinue: () => void;
  onNewGame: () => void;
  onClearSave: () => void;
}) {
  return (
    <div className="save-overlay">
      <div className="save-modal">
        <PanelTitle eyebrow="저장 데이터" title="이어 하시겠습니까?" />
        <p>이 브라우저에 Wave {wave} 저장 데이터가 있습니다.</p>
        <div className="save-modal-actions">
          <button className="ghost-button primary" onClick={onContinue}>
            이어하기
          </button>
          <button className="ghost-button" onClick={onNewGame}>
            새 게임
          </button>
          <button className="ghost-button danger" onClick={onClearSave}>
            저장 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function NewGameConfirmOverlay({
  onCancel,
  onConfirm
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="save-overlay">
      <div className="save-modal">
        <PanelTitle eyebrow="새 게임" title="현재 저장을 새로 시작할까요?" />
        <p>새 게임을 시작하면 현재 자동 저장 데이터가 새 플레이로 덮어써집니다.</p>
        <div className="save-modal-actions">
          <button className="ghost-button" onClick={onCancel}>
            취소
          </button>
          <button className="ghost-button primary" onClick={onConfirm}>
            새 게임 시작
          </button>
        </div>
      </div>
    </div>
  );
}

function WavePanel({
  wave,
  phase,
  canStart,
  onStart
}: {
  wave: WaveDefinition | null;
  phase: GameState["phase"];
  canStart: boolean;
  onStart: () => void;
}) {
  const pressureLabels = wave ? getWavePressureLabels(wave) : [];

  return (
    <aside className="side-panel wave-panel">
      <PanelTitle eyebrow="다음 웨이브" title={wave ? `${wave.wave}. ${wave.title}` : "완료"} />
      {wave && (
        <>
          <span className="stage-pill">{wave.stage}</span>
          <div className="threat-grid difficulty-grid">
            <DifficultyCell label="커피" value={wave.preview.coffee} />
            <DifficultyCell label="디저트" value={wave.preview.dessert} />
            <DifficultyCell label="대기열" value={wave.preview.queue} />
          </div>
          <p className="wave-note">{wave.preview.note}</p>
          {wave.arrivalGap && wave.arrivalGap < 2 && (
            <p className="rush-note">손님 도착 간격 {wave.arrivalGap.toFixed(1)}초</p>
          )}
          {pressureLabels.length > 0 && (
            <div className="pressure-list">
              {pressureLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          )}
          <div className="customer-list">
            {Object.entries(wave.customerCounts).map(([customerId, count]) => (
              <span key={customerId}>
                {customerName(customerId)} <b>{count}</b>
              </span>
            ))}
          </div>
        </>
      )}
      <button className="start-button" disabled={!canStart} onClick={onStart}>
        {phase === "running" ? "영업 중" : phase === "reward" ? "보상 선택 중" : "영업 시작"}
      </button>
      <p className="panel-hint">
        {phase === "running" || phase === "reward"
          ? "영업과 보상 선택 중에는 배치와 상점 조작이 잠깁니다."
          : "벤치 직원을 선택하면 배치 가능한 포지션이 빛납니다."}
      </p>
    </aside>
  );
}

function CafeBoard({
  game,
  level,
  selectedEmployeeId,
  placedCount,
  canEditBoard,
  canPlaceEmptySlot,
  dragState,
  hoverDropTarget,
  dropNotice,
  draggedEmployee,
  onEmployeeDragStart,
  onEmployeePointerDown,
  onDragEnd,
  onSlotDragOver,
  onSlotDrop,
  onSlotDragLeave,
  onPlace,
  onUnplace,
  onSelectPlaced,
  onFinishReplay,
  onApplyReport,
  onChooseReward,
  onNewGame
}: {
  game: GameState;
  level: StoreLevelDefinition;
  selectedEmployeeId: string | null;
  placedCount: number;
  canEditBoard: boolean;
  canPlaceEmptySlot: boolean;
  dragState: DragSource | null;
  hoverDropTarget: string | null;
  dropNotice: DropNotice | null;
  draggedEmployee: EmployeeInstance | null;
  onEmployeeDragStart: (source: DragSource, event: DragEvent) => void;
  onEmployeePointerDown: (
    source: DragSource,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
  onSlotDragOver: (slotId: string, event: DragEvent) => void;
  onSlotDrop: (slotId: string, event: DragEvent) => void;
  onSlotDragLeave: () => void;
  onPlace: (slotId: string) => void;
  onUnplace: (slotId: string) => void;
  onSelectPlaced: (employeeId: string) => void;
  onFinishReplay: () => void;
  onApplyReport: () => void;
  onChooseReward: (rewardId: string) => void;
  onNewGame: () => void;
}) {
  const overlayMode =
    game.phase === "report" && game.lastReport
      ? "report"
      : game.phase === "gameOver"
        ? "gameOver"
        : game.phase === "cleared"
          ? "cleared"
          : null;

  return (
    <section className="board-panel">
      <div className="board-heading">
        <PanelTitle eyebrow="배치 보드" title="오픈 전 포지션" />
        <div className="board-status">
          {draggedEmployee && (
            <span className="drag-pill">
              드래그 중 · {getEmployeeDefinition(draggedEmployee.definitionId).name}
            </span>
          )}
          {dropNotice && (
            <span className={`drop-notice ${dropNotice.tone}`}>{dropNotice.message}</span>
          )}
          <span className="capacity-pill">{placedCount}/{level.maxEmployees}명 출근</span>
        </div>
      </div>

      <div className="cafe-board">
        <div className="board-rail queue-rail">
          <span>손님 대기열</span>
          <b>ORDER FLOW</b>
        </div>
        <div className="board-rail service-rail">
          <span>벤치 선택 → 포지션 클릭</span>
        </div>

        <div className="tile-layer" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>

        <div className="board-prop prop-door">입구</div>
        <div className="board-prop prop-bar">바</div>
        <div className="board-prop prop-tables">홀</div>

        {slotDefinitions.map((slotDefinition) => {
          const slot = game.slots.find((item) => item.slotId === slotDefinition.id)!;
          const locked = slotDefinition.availableWave > game.wave;
          const dropStatus = getSlotDropStatus(game, level, dragState, slot.slotId);
          const slotBonus = getEffectiveSlotBonus(game, slot.slotId);
          return (
            <BoardSlot
              key={slotDefinition.id}
              slot={slot}
              slotBonus={slotBonus}
              locked={locked}
              selectedEmployeeId={selectedEmployeeId}
              canEditBoard={canEditBoard}
              canPlaceEmptySlot={canPlaceEmptySlot}
              dragState={dragState}
              isDropHover={hoverDropTarget === `slot:${slot.slotId}`}
              dropAllowed={dropStatus.allowed}
              dropReason={dropStatus.reason}
              onEmployeeDragStart={onEmployeeDragStart}
              onEmployeePointerDown={onEmployeePointerDown}
              onDragEnd={onDragEnd}
              onSlotDragOver={(event) => onSlotDragOver(slot.slotId, event)}
              onSlotDrop={(event) => onSlotDrop(slot.slotId, event)}
              onSlotDragLeave={onSlotDragLeave}
              onPlace={() => onPlace(slot.slotId)}
              onUnplace={() => onUnplace(slot.slotId)}
              onSelectPlaced={onSelectPlaced}
            />
          );
        })}

        {game.phase === "running" && game.lastReport && (
          <ServiceReplay report={game.lastReport} onFinish={onFinishReplay} />
        )}

        {game.phase === "reward" && (
          <RewardOverlay
            rewards={game.pendingRewards}
            upgrades={game.upgrades}
            onChooseReward={onChooseReward}
          />
        )}

        {overlayMode && (
          <ResultOverlay
            mode={overlayMode}
            report={game.lastReport}
            reputation={game.reputation}
            life={game.life}
            gold={game.gold}
            onApplyReport={onApplyReport}
            onNewGame={onNewGame}
          />
        )}
      </div>
    </section>
  );
}

function BoardSlot({
  slot,
  slotBonus,
  locked,
  selectedEmployeeId,
  canEditBoard,
  canPlaceEmptySlot,
  dragState,
  isDropHover,
  dropAllowed,
  dropReason,
  onEmployeeDragStart,
  onEmployeePointerDown,
  onDragEnd,
  onSlotDragOver,
  onSlotDrop,
  onSlotDragLeave,
  onPlace,
  onUnplace,
  onSelectPlaced
}: {
  slot: SlotState;
  slotBonus: number;
  locked: boolean;
  selectedEmployeeId: string | null;
  canEditBoard: boolean;
  canPlaceEmptySlot: boolean;
  dragState: DragSource | null;
  isDropHover: boolean;
  dropAllowed: boolean;
  dropReason: string;
  onEmployeeDragStart: (source: DragSource, event: DragEvent) => void;
  onEmployeePointerDown: (
    source: DragSource,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
  onSlotDragOver: (event: DragEvent) => void;
  onSlotDrop: (event: DragEvent) => void;
  onSlotDragLeave: () => void;
  onPlace: () => void;
  onUnplace: () => void;
  onSelectPlaced: (employeeId: string) => void;
}) {
  const definition = slotDefinitions.find((item) => item.id === slot.slotId)!;
  const layout = slotLayout[slot.slotId];
  const employeeDefinition = slot.employee
    ? getEmployeeDefinition(slot.employee.definitionId)
    : null;
  const selected = slot.employee?.instanceId === selectedEmployeeId;
  const placeable = !locked && !slot.employee && canPlaceEmptySlot;
  const disabledReason = selectedEmployeeId ? "정원 초과" : "대기";
  const isDragSource = dragState?.employeeId === slot.employee?.instanceId;
  const hasActiveDrag = Boolean(dragState);

  return (
    <div
      data-testid={`board-slot-${slot.slotId}`}
      data-drop-target={`slot:${slot.slotId}`}
      className={`board-slot ${layout.className} ${locked ? "locked" : ""} ${
        selected ? "selected" : ""
      } ${placeable ? "placeable" : ""} ${hasActiveDrag ? "drag-active" : ""} ${
        isDropHover ? "drop-hover" : ""
      } ${hasActiveDrag && dropAllowed ? "drop-valid" : ""} ${
        hasActiveDrag && !dropAllowed ? "drop-invalid" : ""
      } ${isDragSource ? "drag-source" : ""}`}
      style={employeeDefinition ? rarityStyle(employeeDefinition.cost) : undefined}
      title={hasActiveDrag && !dropAllowed ? dropReason : undefined}
      onDragOver={onSlotDragOver}
      onDragLeave={onSlotDragLeave}
      onDrop={onSlotDrop}
    >
      <div className="slot-label">
        <span>{layout.zone}</span>
        <strong>{definition.name}</strong>
        <small>{workLabels[definition.workType]} +{Math.round(slotBonus * 100)}%</small>
      </div>

      {locked ? (
        <div className="board-token locked-token">
          <strong>LOCKED</strong>
          <span>Wave {definition.availableWave}</span>
        </div>
      ) : slot.employee ? (
        <>
          <button
            data-testid={`board-token-${slot.employee.instanceId}`}
            className="board-token employee-token"
            draggable={canEditBoard}
            onDragStart={(event) =>
              onEmployeeDragStart(
                { employeeId: slot.employee!.instanceId, from: "slot", slotId: slot.slotId },
                event
              )
            }
            onPointerDown={(event) =>
              onEmployeePointerDown(
                { employeeId: slot.employee!.instanceId, from: "slot", slotId: slot.slotId },
                event
              )
            }
            onDragEnd={onDragEnd}
            onClick={() => {
              if (
                canEditBoard &&
                selectedEmployeeId &&
                selectedEmployeeId !== slot.employee!.instanceId
              ) {
                onPlace();
                return;
              }

              onSelectPlaced(slot.employee!.instanceId);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onUnplace();
            }}
          >
            <span className="unit-avatar">{employeeIcon(employeeDefinition)}</span>
            <strong>{employeeDefinition?.name}</strong>
            <small><StarRating star={slot.employee.star} /> · {employeeDefinition?.role}</small>
          </button>
          <button className="bench-action" disabled={!canEditBoard} onClick={onUnplace}>
            회수
          </button>
        </>
      ) : (
        <button className="board-token empty-token" disabled={!placeable} onClick={onPlace}>
          <strong>{placeable ? "배치" : disabledReason}</strong>
          <span>{layout.hint}</span>
        </button>
      )}
    </div>
  );
}

function InfoPanel({
  selectedEmployee,
  synergies,
  upgrades,
  gold,
  canEdit,
  onUpgradeEmployee
}: {
  selectedEmployee: EmployeeInstance | null;
  synergies: ActiveSynergy[];
  upgrades: GameUpgrades;
  gold: number;
  canEdit: boolean;
  onUpgradeEmployee: (employee: EmployeeInstance) => void;
}) {
  return (
    <aside className="side-panel info-panel">
      <PanelTitle
        eyebrow="선택 직원"
        title={
          selectedEmployee
            ? getEmployeeDefinition(selectedEmployee.definitionId).name
            : "선택 없음"
        }
      />
      {selectedEmployee ? (
        <SelectedEmployee
          employee={selectedEmployee}
          gold={gold}
          canEdit={canEdit}
          onUpgrade={onUpgradeEmployee}
        />
      ) : (
        <div className="empty-info">상점에서 직원을 고용한 뒤 벤치에서 선택하세요.</div>
      )}

      <div className="synergy-block">
        <PanelTitle eyebrow="시너지" title="현재 조합" />
        <div className="synergy-list">
          {synergies.map((synergy) => (
            <div className={`synergy-row ${synergy.active ? "active" : ""}`} key={synergy.tag}>
              <span className="synergy-icon" aria-hidden="true">
                <span>{tagIcon(synergy.tag)}</span>
              </span>
              <div>
                <strong>{synergy.label}</strong>
                <span>{synergy.description}</span>
                <div className="synergy-progress" aria-hidden="true">
                  {Array.from({ length: synergy.required }).map((_, index) => (
                    <i
                      className={index < synergy.count ? "on" : ""}
                      key={`${synergy.tag}-${index}`}
                    />
                  ))}
                </div>
              </div>
              <b>{synergy.count}/{synergy.required}</b>
            </div>
          ))}
        </div>
      </div>

      <UpgradeSummary upgrades={upgrades} />
    </aside>
  );
}

function UpgradeSummary({ upgrades }: { upgrades: GameUpgrades }) {
  const [expanded, setExpanded] = useState(false);
  const activeWorkBonuses = Object.entries(upgrades.workBonuses).filter(([, value]) =>
    Boolean(value)
  ) as Array<[WorkType, number]>;
  const activeSlotBonuses = Object.entries(upgrades.slotBonuses).filter(([, value]) =>
    Boolean(value)
  );
  const totalBonuses = activeWorkBonuses.length + activeSlotBonuses.length;

  return (
    <div className="upgrade-block">
      <button
        className="section-toggle"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>강화</span>
        <strong>영구 보너스 {expanded ? "▲" : "▼"}</strong>
        <b>{totalBonuses}개</b>
      </button>
      {totalBonuses === 0 ? (
        <div className="empty-upgrades">선택한 보상이 없습니다.</div>
      ) : expanded ? (
        <div className="upgrade-list">
          {activeWorkBonuses.map(([workType, value]) => (
            <div key={`work-${workType}`}>
              <span>{workLabels[workType]}</span>
              <b>+{Math.round(value * 100)}%</b>
            </div>
          ))}
          {activeSlotBonuses.map(([slotId, value]) => (
            <div key={`slot-${slotId}`}>
              <span>{slotName(slotId)}</span>
              <b>+{Math.round(value * 100)}%</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="upgrade-summary-line">
          적용 중인 영구 보너스 {totalBonuses}개
        </div>
      )}
    </div>
  );
}

function SelectedEmployee({
  employee,
  gold,
  canEdit,
  onUpgrade
}: {
  employee: EmployeeInstance;
  gold: number;
  canEdit: boolean;
  onUpgrade: (employee: EmployeeInstance) => void;
}) {
  const definition = getEmployeeDefinition(employee.definitionId);
  const upgradeCost = getEmployeeUpgradeCost(employee);
  const canUpgrade = canEdit && upgradeCost !== null && gold >= upgradeCost;
  const visibleStats = Object.entries(definition.efficiency).filter(([type]) =>
    ["order", "coffee", "dessert", "serve"].includes(type)
  ) as Array<[WorkType, number]>;

  return (
    <div className="selected-card" style={rarityStyle(definition.cost)}>
      <div className="selected-topline">
        <div className="selected-portrait">
          <span>{employeeIcon(definition)}</span>
        </div>
        <div>
          <small className="rarity-label">{rarityLabel(definition.cost)}</small>
          <h3>{definition.name}</h3>
          <strong><StarRating star={employee.star} /> · {definition.role}</strong>
          <span>{definition.cost}코스트 기물</span>
        </div>
      </div>
      <div className="stat-list">
        {visibleStats.map(([type, value]) => (
          <div key={type}>
            <span>{workLabels[type]}</span>
            <b>{value}</b>
            <i>
              <em style={{ width: `${Math.min(100, Math.round(value / 1.5))}%` }} />
            </i>
          </div>
        ))}
      </div>
      <div className="tag-row">
        {definition.tags.map((tag) => (
          <span key={tag}>{tagIcon(tag)} {tagLabels[tag]}</span>
        ))}
      </div>
      <div className="growth-action">
        <button
          className="buy-button"
          disabled={!canUpgrade}
          onClick={() => onUpgrade(employee)}
          type="button"
        >
          {upgradeCost === null
            ? "최고 성급"
            : `직접 성장 ${upgradeCost}G`}
        </button>
        <span>
          {upgradeCost === null
            ? "현재 직원은 더 성장할 수 없습니다."
            : `${starText(employee.star)} → ${starText((employee.star + 1) as EmployeeInstance["star"])}`}
        </span>
      </div>
    </div>
  );
}

function ShopDock({
  game,
  level,
  benchCount,
  selectedEmployeeId,
  onBuy,
  onRefresh,
  onBuyExp,
  onSelectBench,
  onBenchEmptyClick,
  onSell,
  dragState,
  hoverDropTarget,
  onEmployeeDragStart,
  onEmployeePointerDown,
  onDragEnd,
  onBenchDragOver,
  onBenchDrop,
  onBenchDragLeave
}: {
  game: GameState;
  level: StoreLevelDefinition;
  benchCount: number;
  selectedEmployeeId: string | null;
  onBuy: (offerIndex: number) => void;
  onRefresh: () => void;
  onBuyExp: () => void;
  onSelectBench: (employeeId: string) => void;
  onBenchEmptyClick: () => void;
  onSell: (instanceId: string) => void;
  dragState: DragSource | null;
  hoverDropTarget: string | null;
  onEmployeeDragStart: (source: DragSource, event: DragEvent) => void;
  onEmployeePointerDown: (
    source: DragSource,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
  onBenchDragOver: (event: DragEvent) => void;
  onBenchDrop: (event: DragEvent) => void;
  onBenchDragLeave: () => void;
}) {
  const canEdit = game.phase === "preparation";
  const benchFull = benchCount >= MAX_BENCH_EMPLOYEES;
  const shopCells = Array.from({ length: MAX_SHOP_CELLS }, (_, index) => ({
    index,
    offer: game.shop[index] ?? null,
    locked: index >= level.shopSlots
  }));
  const benchCells = Array.from({ length: BENCH_CELLS }, (_, index) => ({
    index,
    employee: game.bench[index] ?? null
  }));

  return (
    <section className="shop-dock">
      <div className="dock-panel shop-panel">
        <div className="dock-header">
          <PanelTitle eyebrow="상점" title="직원 고용" />
          <div className="dock-actions">
            <button className="ghost-button" disabled={!canEdit || game.gold < SHOP_REROLL_COST} onClick={onRefresh}>
              리롤 {SHOP_REROLL_COST}G
            </button>
            <button
              className="ghost-button"
              disabled={!canEdit || game.gold < BUY_EXP_COST || level.expToNext === null}
              onClick={onBuyExp}
            >
              EXP +{BUY_EXP_AMOUNT} · {BUY_EXP_COST}G
            </button>
          </div>
        </div>
        <div className="shop-grid">
          {shopCells.map(({ index, offer, locked }) => (
            <ShopCell
              key={index}
              index={index}
              offer={offer}
              locked={locked}
              canEdit={canEdit}
              gold={game.gold}
              benchFull={benchFull}
              onBuy={onBuy}
            />
          ))}
        </div>
        <div className="shop-odds">
          <span>{formatShopOdds(level)}</span>
          <span>동일 직원 중복 등장 가능</span>
        </div>
      </div>

      <div
        data-testid="bench-panel"
        data-drop-target="bench"
        className={`dock-panel bench-panel ${dragState ? "drop-active" : ""} ${
          hoverDropTarget === "bench" ? "drop-hover" : ""
        }`}
        onDragOver={onBenchDragOver}
        onDragLeave={onBenchDragLeave}
        onDrop={onBenchDrop}
      >
        <div className="dock-header">
          <PanelTitle eyebrow="벤치" title="보유 직원" />
          <div className="bench-status-row">
            <span className="stage-pill">{benchCount}/{MAX_BENCH_EMPLOYEES}</span>
            {selectedEmployeeId && <span className="stage-pill">선택됨</span>}
          </div>
        </div>
        <div className="bench-slots">
          {benchCells.map(({ index, employee }) =>
            employee ? (
              <div
                className="bench-cell filled"
                data-testid={`bench-cell-${index}`}
                key={employee.instanceId}
              >
                <EmployeeCard
                  employee={employee}
                  selected={selectedEmployeeId === employee.instanceId}
                  mode="bench"
                  draggable={canEdit}
                  onDragStart={(event) =>
                    onEmployeeDragStart({ employeeId: employee.instanceId, from: "bench" }, event)
                  }
                  onPointerDown={(event) =>
                    onEmployeePointerDown(
                      { employeeId: employee.instanceId, from: "bench" },
                      event
                    )
                  }
                  onDragEnd={onDragEnd}
                  onClick={() => onSelectBench(employee.instanceId)}
                  footer={
                    <button
                      className="sell-button"
                      disabled={!canEdit}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSell(employee.instanceId);
                      }}
                    >
                      판매 {getEmployeeSellValue(employee)}G
                    </button>
                  }
                />
              </div>
            ) : (
              <button
                className="bench-cell empty"
                key={`bench-empty-${index}`}
                onClick={onBenchEmptyClick}
                type="button"
              >
                <span>{index + 1}</span>
              </button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function ShopCell({
  index,
  offer,
  locked,
  canEdit,
  gold,
  benchFull,
  onBuy
}: {
  index: number;
  offer: ShopOffer | null;
  locked: boolean;
  canEdit: boolean;
  gold: number;
  benchFull: boolean;
  onBuy: (offerIndex: number) => void;
}) {
  if (locked) {
    return (
      <div className="shop-cell locked">
        <strong>LOCKED</strong>
        <span>상점 확장</span>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="shop-cell empty">
        <strong>매진</strong>
        <span>리롤 필요</span>
      </div>
    );
  }

  const definition = getEmployeeDefinition(offer.employeeId);
  const price = getEmployeeBuyPrice(definition.id);
  const affordable = gold >= price;

  return (
    <div className={`shop-cell ${affordable && canEdit && !benchFull ? "" : "unavailable"}`}>
      <EmployeeCard
        employee={{ definitionId: offer.employeeId, instanceId: offer.offerId, star: 1 }}
        selected={false}
        mode="shop"
        unavailable={!affordable || !canEdit || benchFull}
        footer={
          <button
            className="buy-button"
            disabled={!canEdit || !affordable || benchFull}
            onClick={() => onBuy(index)}
          >
            {benchFull ? "벤치 가득" : affordable ? `고용 ${price}G` : "골드 부족"}
          </button>
        }
      />
    </div>
  );
}

function EmployeeCard({
  employee,
  selected,
  footer,
  onClick,
  mode = "shop",
  unavailable = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onPointerDown
}: {
  employee: Pick<EmployeeInstance, "definitionId" | "instanceId" | "star">;
  selected: boolean;
  footer?: React.ReactNode;
  onClick?: () => void;
  mode?: "shop" | "bench";
  unavailable?: boolean;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const definition = getEmployeeDefinition(employee.definitionId);
  const clickable = Boolean(onClick);
  const bestWork = Object.entries(definition.efficiency)
    .sort((a, b) => b[1] - a[1])[0][0] as WorkType;

  return (
    <article
      className={`employee-card ${mode} ${selected ? "selected" : ""} ${
        unavailable ? "unavailable" : ""
      }`}
      style={rarityStyle(definition.cost)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!clickable || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }
        event.preventDefault();
        onClick?.();
      }}
    >
      <span className="cost-badge">{getEmployeeBuyPrice(definition.id)}G</span>
      <div className="card-face" aria-hidden="true">{employeeIcon(definition)}</div>
      <strong>{definition.name}</strong>
      <span><StarRating star={employee.star} /> · {definition.role}</span>
      <small>{workLabels[bestWork]} {definition.efficiency[bestWork]}</small>
      <div className="tag-row">
        {definition.tags.map((tag) => (
          <span key={tag}>{tagIcon(tag)} {tagLabels[tag]}</span>
        ))}
      </div>
      {footer && <div className="card-footer">{footer}</div>}
    </article>
  );
}

function DragPreview({
  employee,
  x,
  y
}: {
  employee: EmployeeInstance;
  x: number;
  y: number;
}) {
  const definition = getEmployeeDefinition(employee.definitionId);

  return (
    <div className="drag-preview" style={{ left: x, top: y }}>
      <span className="unit-avatar">{employeeIcon(definition)}</span>
      <div>
        <strong>{definition.name}</strong>
        <small><StarRating star={employee.star} /> · {definition.role}</small>
      </div>
    </div>
  );
}

function ServiceReplay({
  report,
  onFinish
}: {
  report: RoundReport;
  onFinish: () => void;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const frames = report.replayFrames;
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const activeWorkers = frame?.workers.filter((worker) => worker.workType) ?? [];
  const previousFrame = frames[Math.max(0, frameIndex - 1)];
  const successDelta = frame && previousFrame
    ? Math.max(0, frame.successfulCustomers - previousFrame.successfulCustomers)
    : 0;
  const averageGold = report.successfulCustomers > 0
    ? Math.max(1, Math.round(report.totalGold / report.successfulCustomers))
    : 0;
  const floatingGold = successDelta * averageGold;

  useEffect(() => {
    setFrameIndex(0);
    setCompleted(false);
  }, [report.wave]);

  useEffect(() => {
    if (!frame || completed) {
      return;
    }

    if (frameIndex >= frames.length - 1) {
      setCompleted(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, frames.length - 1));
    }, 460);

    return () => window.clearTimeout(timer);
  }, [completed, frame, frameIndex, frames.length]);

  if (!frame) {
    return null;
  }

  return (
    <div className="service-replay" data-testid="service-replay">
      <div className="replay-topline">
        <div>
          <span>영업 재생</span>
          <strong>{formatReplayTime(frame.time)}</strong>
        </div>
        <div className="replay-stats">
          <MiniStat label="처리" value={`${frame.successfulCustomers}명`} />
          <MiniStat label="이탈" value={`${frame.failedCustomers}명`} />
          <MiniStat label="응대중" value={`${frame.activeCustomers}명`} />
        </div>
      </div>

      <div className="replay-customer-lane">
        {frame.customers.map((customer) => (
          <div className={`replay-customer ${customer.status}`} key={customer.id}>
            <div className="customer-avatar">{customer.customerName.slice(0, 2)}</div>
            <div className="customer-copy">
              <strong>{customer.customerName}</strong>
              <span>
                {statusLabel(customer.status)}
                {customer.currentTask ? ` · ${workLabels[customer.currentTask]}` : ""}
              </span>
            </div>
            <div className="progress-stack">
              <ProgressBar label="작업" value={customer.totalProgress} tone="work" />
              <ProgressBar label="인내" value={customer.patienceRatio} tone="patience" />
            </div>
          </div>
        ))}
      </div>

      {floatingGold > 0 && (
        <div className="floating-gold" key={`${frame.time}-${floatingGold}`}>
          +{floatingGold}G
        </div>
      )}

      <div className="replay-worker-layer" aria-hidden="true">
        {activeWorkers.map((worker) => (
          <div
            className={`replay-worker-line line-${worker.slotId}`}
            key={`${worker.employeeId}-${worker.targetCustomerId}-${worker.workType}`}
          >
            <span>{worker.employeeName}</span>
            <b>{worker.workType ? workLabels[worker.workType] : ""}</b>
          </div>
        ))}
      </div>

      <div className="replay-footer">
        <div>
          <span>개선 필요</span>
          <strong>
            {frame.bottlenecks.length
              ? frame.bottlenecks.map(weaknessLabel).join(", ")
              : "감지 없음"}
          </strong>
        </div>
        <button className="start-button" onClick={onFinish}>
          {completed ? "결과 확인" : "스킵"}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "work" | "patience";
}) {
  return (
    <div className={`mini-progress ${tone}`}>
      <span>{label}</span>
      <i>
        <b style={{ width: `${Math.round(value * 100)}%` }} />
      </i>
    </div>
  );
}

function RewardOverlay({
  rewards,
  upgrades,
  onChooseReward
}: {
  rewards: RewardChoice[];
  upgrades: GameUpgrades;
  onChooseReward: (rewardId: string) => void;
}) {
  return (
    <div className="result-overlay reward-overlay" data-testid="reward-overlay">
      <div className="result-modal reward-modal">
        <PanelTitle eyebrow="보상 선택" title="다음 영업을 위한 한 가지 선택" />
        <div className="reward-grid">
          {rewards.map((reward) => (
            <button
              className={`reward-card ${reward.category}`}
              data-testid={`reward-${reward.category}`}
              key={reward.id}
              onClick={() => onChooseReward(reward.id)}
            >
              <span>{rewardCategoryLabel(reward.category)}</span>
              <strong>{reward.title}</strong>
              <small>{reward.description}</small>
              <b>{rewardMeta(reward, upgrades)}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({
  mode,
  report,
  reputation,
  life,
  gold,
  onApplyReport,
  onNewGame
}: {
  mode: "report" | "gameOver" | "cleared";
  report: RoundReport | null;
  reputation: number;
  life: number;
  gold: number;
  onApplyReport: () => void;
  onNewGame: () => void;
}) {
  const gameOverTitle = life <= 0 ? "체력이 0이 되었습니다" : "평판이 0이 되었습니다";
  if (mode === "gameOver") {
    return (
      <div className="result-overlay danger">
        <div className="result-modal">
          <PanelTitle eyebrow="영업 종료" title={gameOverTitle} />
          <p>이탈 손님으로 체력이 소진되었거나 평판 손실이 누적되어 오늘 영업을 이어갈 수 없습니다. 다음 운영에서는 개선 필요 업무를 먼저 보강하세요.</p>
          <button className="start-button" onClick={onNewGame}>새 게임</button>
        </div>
      </div>
    );
  }

  if (mode === "cleared") {
    const finalResult = report ? calculateFinalResult(reputation, gold, report) : null;

    return (
      <div className="result-overlay success">
        <div className="result-modal">
          <PanelTitle eyebrow="카페 운영 마감 성공" title={`Wave ${report?.wave ?? FINAL_WAVE} 운영 완료`} />
          <p>24 Wave 운영을 끝까지 마쳤습니다. 최종 결과를 확인하고 다음 운영 기록에 도전하세요.</p>
          <div className="result-grid">
            <MiniStat label="최종 등급" value={finalResult?.grade ?? "-"} />
            <MiniStat label="최종 평판" value={reputation} />
            <MiniStat label="최종 체력" value={life} />
            <MiniStat label="보유 매출" value={`${gold}G`} />
            <MiniStat label="최종 성공률" value={finalResult ? formatPercent(finalResult.successRate) : "-"} />
            <MiniStat label="최종 점수" value={finalResult ? `${finalResult.score}` : "-"} />
          </div>
          <button className="start-button" onClick={onNewGame}>새 게임</button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="result-overlay">
      <div className="result-modal">
        <PanelTitle eyebrow={`Wave ${report.wave} 결과`} title={report.stage} />
        <div className="result-grid">
          <MiniStat label="성공" value={`${report.successfulCustomers}명`} />
          <MiniStat label="이탈" value={`${report.failedCustomers}명`} />
          <MiniStat label="획득 매출" value={`${report.totalGold}G`} />
          <MiniStat
            label="평판 변화"
            value={formatSigned(report.reputationDelta)}
            tone={report.reputationDelta <= -15 ? "danger" : report.reputationDelta < 0 ? "warning" : undefined}
          />
          <MiniStat
            label="체력 변화"
            value={formatSigned(report.lifeDelta)}
            tone={report.lifeDelta < 0 ? "danger" : undefined}
          />
          <MiniStat label="EXP" value={`+${report.expGained}`} />
          <MiniStat
            label="개선 필요"
            value={
              report.bottlenecks.length
                ? report.bottlenecks.map(weaknessLabel).join(", ")
                : "없음"
            }
          />
        </div>
        <div className="outcome-list">
          {report.outcomes.map((outcome, index) => (
            <span
              className={`outcome-pill ${outcome.satisfaction.toLowerCase()}`}
              key={`${outcome.customerId}-${index}`}
            >
              {outcome.customerName} · {outcome.satisfaction}
            </span>
          ))}
        </div>
        <button className="start-button" onClick={onApplyReport}>
          {(REWARD_WAVES as readonly number[]).includes(report.wave) ? "보상 선택" : "다음 웨이브"}
        </button>
      </div>
    </div>
  );
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <span>{eyebrow}</span>
      <strong>{title}</strong>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone?: "warning" | "danger";
}) {
  return (
    <div className={`mini-stat ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DifficultyCell({ label, value }: { label: string; value: string }) {
  const level = difficultyLevel(value);

  return (
    <div className="mini-stat difficulty-cell">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="difficulty-dots" aria-label={`${label} 난이도 ${level}/5`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <i className={index < level ? "on" : ""} key={`${label}-${index}`} />
        ))}
      </div>
    </div>
  );
}

function getSlotDropStatus(
  state: GameState,
  level: StoreLevelDefinition,
  dragState: DragSource | null,
  slotId: string
): { allowed: boolean; reason: string; message: string } {
  if (!dragState) {
    return { allowed: false, reason: "드래그 중인 직원 없음", message: "" };
  }

  if (state.phase !== "preparation") {
    return { allowed: false, reason: "영업 중에는 배치 변경 불가", message: "" };
  }

  const slotDefinition = slotDefinitions.find((slot) => slot.id === slotId);
  if (!slotDefinition || slotDefinition.availableWave > state.wave) {
    return { allowed: false, reason: "아직 잠긴 포지션", message: "" };
  }

  const employee = findEmployee(state, dragState.employeeId);
  if (!employee) {
    return { allowed: false, reason: "직원을 찾을 수 없음", message: "" };
  }

  const targetSlot = state.slots.find((slot) => slot.slotId === slotId);
  if (targetSlot?.employee?.instanceId === dragState.employeeId) {
    return { allowed: false, reason: "이미 같은 포지션", message: "" };
  }

  const targetOccupied = Boolean(targetSlot?.employee);
  const movingFromBench = dragState.from === "bench";
  if (movingFromBench && !targetOccupied && getPlacedEmployees(state).length >= level.maxEmployees) {
    return { allowed: false, reason: "배치 정원 초과", message: "" };
  }

  return {
    allowed: true,
    reason: "",
    message: targetOccupied ? "포지션을 교체했습니다." : "직원을 배치했습니다."
  };
}

function hasEmployee(state: GameState, instanceId: string) {
  return (
    state.bench.some((employee) => employee.instanceId === instanceId) ||
    state.slots.some((slot) => slot.employee?.instanceId === instanceId)
  );
}

function findEmployee(state: GameState, instanceId: string): EmployeeInstance | null {
  return (
    state.bench.find((employee) => employee.instanceId === instanceId) ??
    state.slots.find((slot) => slot.employee?.instanceId === instanceId)?.employee ??
    null
  );
}

function findSlotIdForEmployee(state: GameState, instanceId: string): string | null {
  return state.slots.find((slot) => slot.employee?.instanceId === instanceId)?.slotId ?? null;
}

function normalizeGameState(state: GameState): GameState {
  const existingSlotIds = new Set(state.slots.map((slot) => slot.slotId));
  const missingSlots = slotDefinitions
    .filter((slot) => !existingSlotIds.has(slot.id))
    .map((slot) => ({
      slotId: slot.id,
      employee: null
    }));

  if (missingSlots.length === 0) {
    return state;
  }

  return {
    ...state,
    slots: [...state.slots, ...missingSlots]
  };
}

function customerName(customerId: string) {
  const names: Record<string, string> = {
    normal_coffee: "일반 커피",
    heavy_coffee: "커피 러시",
    dessert_customer: "디저트",
    simple_set: "간단 세트",
    commuter_rush: "급한 출근",
    complex_order: "복합 주문",
    takeout_customer: "포장",
    dine_in_customer: "테이블",
    difficult_customer: "진상",
    reviewer_customer: "리뷰어",
    group_customer: "단체"
  };
  return names[customerId] ?? customerId;
}

function getWavePressureLabels(wave: WaveDefinition) {
  const labels: string[] = [];
  const customerIds = Object.keys(wave.customerCounts);
  if (customerIds.some((id) => id === "complex_order" || id === "takeout_customer")) {
    labels.push("홀 동선 압박");
  }
  if (customerIds.includes("dine_in_customer")) {
    labels.push("청소 압박");
  }
  if (customerIds.some((id) => id === "difficult_customer" || id === "reviewer_customer")) {
    labels.push("평판 위험");
    labels.push("컴플레인");
  }
  if (customerIds.includes("group_customer")) {
    labels.push("단체 주문");
  }
  return labels;
}

function formatSuccessRate(report: RoundReport) {
  const total = report.successfulCustomers + report.failedCustomers;
  if (total === 0) {
    return "0%";
  }
  return formatPercent(report.successfulCustomers / total);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatShopOdds(level: StoreLevelDefinition) {
  const entries = Object.entries(level.costWeights)
    .map(([cost, weight]) => [Number(cost), weight ?? 0] as const)
    .filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);

  return entries
    .map(([cost, weight]) => `${cost}코 ${Math.round((weight / total) * 100)}%`)
    .join(" · ");
}

function slotName(slotId: string) {
  return slotDefinitions.find((slot) => slot.id === slotId)?.name ?? slotId;
}

function weaknessLabel(workType: WorkType) {
  return `${workLabels[workType]} 보강 필요`;
}

function rewardCategoryLabel(category: RewardChoice["category"]) {
  const labels: Record<RewardChoice["category"], string> = {
    slot: "슬롯 강화",
    unit: "유닛 추가",
    stat: "수치 강화"
  };
  return labels[category];
}

function rewardMeta(reward: RewardChoice, upgrades: GameUpgrades) {
  if (reward.kind === "slot_upgrade" && reward.slotId) {
    const current = upgrades.slotBonuses[reward.slotId] ?? 0;
    return `${slotName(reward.slotId)} 누적 +${Math.round((current + reward.amount) * 100)}%`;
  }

  if (reward.kind === "work_bonus" && reward.workType) {
    const current = upgrades.workBonuses[reward.workType] ?? 0;
    return `${workLabels[reward.workType]} 누적 +${Math.round((current + reward.amount) * 100)}%`;
  }

  if (reward.kind === "employee" && reward.employeeId) {
    const employee = getEmployeeDefinition(reward.employeeId);
    return `${getEmployeeBuyPrice(employee.id)}G 가치 · ${employee.role}`;
  }

  if (reward.kind === "gold") {
    return "즉시 지급";
  }

  return "최대 100";
}

function statusLabel(status: RoundReplayFrame["customers"][number]["status"]) {
  const labels: Record<RoundReplayFrame["customers"][number]["status"], string> = {
    waiting: "대기",
    active: "처리중",
    succeeded: "완료",
    failed: "이탈"
  };
  return labels[status];
}

function formatReplayTime(seconds: number) {
  return `${Math.max(0, Math.round(seconds))}초`;
}

function tagIcon(tag: string) {
  const icons: Record<string, string> = {
    coffee: "☕",
    dessert: "🍰",
    service: "🛎",
    newbie: "🌱"
  };
  return icons[tag] ?? "★";
}

function StarRating({ star }: { star: EmployeeInstance["star"] }) {
  return (
    <span className="star-rating" aria-label={`${star}성`} title={`${star}성`}>
      {starText(star)}
    </span>
  );
}

function starText(star: EmployeeInstance["star"]) {
  return "⭐".repeat(star);
}

function employeeIcon(definition: EmployeeDefinition | null | undefined) {
  if (!definition) {
    return "⭐";
  }

  const primaryTag = definition.tags[0];
  return tagIcon(primaryTag);
}

function difficultyLevel(value: string) {
  const levels: Record<string, number> = {
    낮음: 1,
    보통: 3,
    많음: 4,
    높음: 4,
    매우높음: 5
  };
  return levels[value] ?? 2;
}

function rarityStyle(cost: number): CSSProperties {
  return { "--rarity": `var(--rarity-${Math.min(5, Math.max(1, cost))})` } as CSSProperties;
}

function rarityLabel(cost: number) {
  const labels: Record<number, string> = {
    1: "COMMON",
    2: "UNCOMMON",
    3: "RARE",
    4: "EPIC",
    5: "LEGENDARY"
  };
  return labels[cost] ?? "COMMON";
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export default App;
