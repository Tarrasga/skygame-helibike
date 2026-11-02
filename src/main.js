import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const game = new Game(container);

  // 1. Menu Elements
  const mainMenuOverlay = document.getElementById('main-menu-overlay');
  const uiOverlay = document.getElementById('ui-overlay');
  const menuBtnBike = document.getElementById('menu-btn-bike');
  const menuBikeStatus = document.getElementById('menu-bike-status');
  const diffButtons = document.querySelectorAll('.diff-btn');
  const menuBtnRanking = document.getElementById('menu-btn-ranking');
  const menuBtnSim = document.getElementById('menu-btn-sim');
  const simStatusLabel = document.getElementById('sim-status-label');
  const menuBtnSound = document.getElementById('menu-btn-sound');
  const soundStatusLabel = document.getElementById('sound-status-label');
  const soundIcon = document.getElementById('sound-icon');
  const btnStartGame = document.getElementById('btn-start-game');

  // 2. In-Game HUD Elements
  const btnPauseGame = document.getElementById('btn-pause-game');
  const btnRankingHud = document.getElementById('btn-ranking-hud');
  const btnConnectBikeHud = document.getElementById('btn-connect-bike-hud');

  const simDrawer = document.getElementById('sim-drawer');
  const simSlider = document.getElementById('sim-rpm-slider');
  const simDisplay = document.getElementById('sim-rpm-display');
  const statusToast = document.getElementById('status-toast');

  const valDistance = document.getElementById('val-distance');
  const valCalories = document.getElementById('val-calories');
  const valScore = document.getElementById('val-score');
  const valCombo = document.getElementById('val-combo');
  const valAltitude = document.getElementById('val-altitude');
  const altitudeFill = document.getElementById('altitude-fill');
  const valSpeed = document.getElementById('val-speed');
  const valCadence = document.getElementById('val-cadence');
  const cadenceCard = document.getElementById('cadence-card');

  const workoutBanner = document.getElementById('workout-banner');
  const workoutPhaseTitle = document.getElementById('workout-phase-title');
  const workoutTimer = document.getElementById('workout-timer');
  const workoutTargetRpm = document.getElementById('workout-target-rpm');
  const workoutStatusBadge = document.getElementById('workout-status-badge');

  // 3. Modals
  const pauseModal = document.getElementById('pause-modal');
  const btnResumeFlight = document.getElementById('btn-resume-flight');
  const btnSaveScorePause = document.getElementById('btn-save-score-pause');
  const btnReturnMenu = document.getElementById('btn-return-menu');

  const rankingModal = document.getElementById('ranking-modal');
  const btnCloseRanking = document.getElementById('btn-close-ranking');
  const btnCloseRankingBottom = document.getElementById('btn-close-ranking-bottom');
  const rankingTableBody = document.getElementById('ranking-table-body');
  const inputPlayerName = document.getElementById('input-player-name');
  const btnSaveScore = document.getElementById('btn-save-score');

  function showToast(msg, isError = false, duration = 4000) {
    statusToast.textContent = msg;
    if (isError) {
      statusToast.classList.add('error');
    } else {
      statusToast.classList.remove('error');
    }
    statusToast.classList.add('show');
    clearTimeout(statusToast.timer);
    statusToast.timer = setTimeout(() => {
      statusToast.classList.remove('show');
    }, duration);
  }

  // A. Bluetooth Connection Handlers
  async function handleConnectBike() {
    try {
      showToast('A procurar bicicleta...');
      const name = await game.bluetooth.connectBike();
      menuBtnBike.classList.add('connected');
      menuBikeStatus.textContent = `✔ Conectada (${name})`;
      btnConnectBikeHud.classList.add('connected');
      btnConnectBikeHud.innerHTML = `<span>✔</span> ${name}`;
      showToast(`Bicicleta ${name} ligada com sucesso!`, false, 4000);
      game.isSimulated = false;
      simStatusLabel.textContent = 'OFF';
      simDrawer.classList.remove('visible');
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast(err.message, true, 7000);
      }
    }
  }

  menuBtnBike.addEventListener('click', handleConnectBike);
  btnConnectBikeHud.addEventListener('click', handleConnectBike);

  // B. Difficulty Selection Handlers
  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      diffButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const diff = btn.getAttribute('data-diff');
      game.setDifficulty(diff);
      showToast(`Dificuldade definida: ${diff.toUpperCase()}`);
    });
  });

  // C. Sound Toggle
  let isMuted = false;
  menuBtnSound.addEventListener('click', () => {
    isMuted = !isMuted;
    game.audio.isMuted = isMuted;
    soundStatusLabel.textContent = isMuted ? 'OFF' : 'ON';
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
    showToast(isMuted ? 'Som desativado' : 'Som ativado');
  });

  // D. Simulation Mode Toggle
  menuBtnSim.addEventListener('click', () => {
    game.isSimulated = !game.isSimulated;
    simStatusLabel.textContent = game.isSimulated ? 'ON' : 'OFF';
    if (game.isSimulated) {
      simDrawer.classList.add('visible');
      showToast('Simulação ativada (teclas W/S ou slider)');
    } else {
      simDrawer.classList.remove('visible');
      showToast('Simulação desativada. Velocidade a 0.');
    }
  });

  simSlider.addEventListener('input', (e) => {
    const rpm = parseInt(e.target.value, 10);
    simDisplay.textContent = `${rpm} RPM`;
    game.simRpm = rpm;
  });

  // E. Ranking / Leaderboard Logic
  function renderRankingTable() {
    const scores = game.ranking.getScores();
    rankingTableBody.innerHTML = '';

    scores.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      let rankDisplay = `${idx + 1}º`;
      if (idx === 0) rankDisplay = '🥇 1º';
      else if (idx === 1) rankDisplay = '🥈 2º';
      else if (idx === 2) rankDisplay = '🥉 3º';

      tr.innerHTML = `
        <td class="rank-badge">${rankDisplay}</td>
        <td><strong>${entry.name}</strong></td>
        <td style="color: #fbbf24; font-weight: 800;">${entry.score.toLocaleString()}</td>
        <td><span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span></td>
        <td>${entry.maxRpm} RPM</td>
        <td>${entry.calories} kcal</td>
        <td style="color: #94a3b8; font-size: 10px;">${entry.date}</td>
      `;
      rankingTableBody.appendChild(tr);
    });
  }

  const openRanking = () => {
    renderRankingTable();
    rankingModal.classList.add('open');
  };
  const closeRanking = () => rankingModal.classList.remove('open');

  menuBtnRanking.addEventListener('click', openRanking);
  btnRankingHud.addEventListener('click', openRanking);
  btnCloseRanking.addEventListener('click', closeRanking);
  btnCloseRankingBottom.addEventListener('click', closeRanking);

  btnSaveScore.addEventListener('click', () => {
    const name = inputPlayerName.value.trim() || 'Piloto';
    game.ranking.addScore({
      name,
      score: game.score,
      difficulty: game.workout.difficulty,
      maxRpm: game.maxRpmRecorded,
      calories: Math.round(game.calories),
      distanceKm: (game.distanceMeters / 1000).toFixed(2)
    });

    renderRankingTable();
    showToast(`Pontuação de ${name} gravada no Ranking! 🏆`, false, 4000);
    inputPlayerName.value = '';
  });

  // F. Start / Pause / Return Game Handlers
  btnStartGame.addEventListener('click', () => {
    mainMenuOverlay.classList.remove('visible');
    mainMenuOverlay.classList.add('hidden');
    uiOverlay.classList.remove('hidden');

    game.startFlight();
    showToast('Voo iniciado! 3 minutos de aquecimento a ritmo constante!', false, 4000);
  });

  btnPauseGame.addEventListener('click', () => {
    game.pauseFlight();
    pauseModal.classList.add('open');
  });

  btnResumeFlight.addEventListener('click', () => {
    pauseModal.classList.remove('open');
    game.resumeFlight();
  });

  btnSaveScorePause.addEventListener('click', () => {
    pauseModal.classList.remove('open');
    openRanking();
  });

  btnReturnMenu.addEventListener('click', () => {
    pauseModal.classList.remove('open');
    uiOverlay.classList.add('hidden');
    mainMenuOverlay.classList.remove('hidden');
    mainMenuOverlay.classList.add('visible');
    game.returnToMenu();
  });

  // G. In-flight HUD Update Callback
  game.onHUDUpdate = (stats) => {
    valDistance.textContent = `${stats.distanceKm} km`;
    valCalories.textContent = `${stats.calories} kcal`;
    valScore.textContent = stats.score.toLocaleString();
    valCombo.textContent = `COMBO ${stats.combo}x`;
    valAltitude.textContent = stats.altitude;

    const altPercent = Math.min(100, Math.max(5, (stats.altitude / 130) * 100));
    altitudeFill.style.height = `${altPercent}%`;

    valSpeed.textContent = stats.speed;
    valCadence.textContent = stats.cadence;

    // Workout Banner
    const w = stats.workout;
    workoutPhaseTitle.textContent = w.phaseName;
    workoutTimer.textContent = w.timeFormatted;
    workoutTargetRpm.textContent = `META: ${w.targetRpm} RPM`;

    if (w.isSprint) {
      workoutBanner.classList.add('sprint-active');
      cadenceCard.classList.add('sprint-active');

      if (w.isMeetingTarget) {
        workoutStatusBadge.textContent = '✔ META ATINGIDA! (+3X BÓNUS)';
        workoutStatusBadge.className = 'workout-status-badge success';
      } else {
        const diff = w.targetRpm - stats.cadence;
        workoutStatusBadge.textContent = `▲ ACELERA! (+${diff} RPM)`;
        workoutStatusBadge.className = 'workout-status-badge warning';
      }
    } else {
      workoutBanner.classList.remove('sprint-active');
      cadenceCard.classList.remove('sprint-active');

      if (w.isWarmup) {
        workoutStatusBadge.textContent = 'RITMO CONSTANTE (AQUECIMENTO)';
      } else {
        workoutStatusBadge.textContent = 'RECUPERAÇÃO DE RITMO';
      }
      workoutStatusBadge.className = 'workout-status-badge';
    }
  };

  game.bluetooth.onStatusChange = (type, status, message) => {
    showToast(message, status === 'error');
    if (status === 'disconnected') {
      if (type === 'bike') {
        menuBtnBike.classList.remove('connected');
        menuBikeStatus.textContent = 'Não Conectada (Toca p/ Ligar)';
        btnConnectBikeHud.classList.remove('connected');
        btnConnectBikeHud.innerHTML = '<span>🚲</span> Ligar Bike';
      }
    }
  };

  // Start 3D Engine in Menu State (Helibike hovering in showcase)
  game.start();
});
