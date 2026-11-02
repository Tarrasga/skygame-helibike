import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const game = new Game(container);

  // UI Elements
  const btnConnectBike = document.getElementById('btn-connect-bike');
  const btnConnectHr = document.getElementById('btn-connect-hr');
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  const btnRanking = document.getElementById('btn-ranking');
  const selectDifficulty = document.getElementById('select-difficulty');

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
  const valBpm = document.getElementById('val-bpm');
  const valZone = document.getElementById('val-zone');

  // Workout Banner Elements
  const workoutBanner = document.getElementById('workout-banner');
  const workoutPhaseTitle = document.getElementById('workout-phase-title');
  const workoutTimer = document.getElementById('workout-timer');
  const workoutTargetRpm = document.getElementById('workout-target-rpm');
  const workoutStatusBadge = document.getElementById('workout-status-badge');

  // Ranking Modal Elements
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

  // 1. Bluetooth Bike Connection Button
  btnConnectBike.addEventListener('click', async () => {
    try {
      showToast('A procurar SMARTBIKE...');
      const name = await game.bluetooth.connectBike();
      btnConnectBike.classList.add('connected');
      btnConnectBike.innerHTML = `<span>✔</span> ${name}`;
      showToast(`Bicicleta ${name} ligada! Começa o treino de 3 min!`, false, 5000);
      game.isSimulated = false;
      simDrawer.classList.remove('visible');
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast(err.message, true, 7000);
      }
    }
  });

  // 2. Smartwatch Heart Rate Connection Button
  btnConnectHr.addEventListener('click', async () => {
    try {
      showToast('A procurar Smartwatch / Frequência Cardíaca...');
      const name = await game.bluetooth.connectSmartwatch();
      btnConnectHr.classList.add('connected');
      btnConnectHr.innerHTML = `<span>♥</span> ${name}`;
      showToast(`Smartwatch ${name} ligado!`, false, 4000);
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast(err.message, true, 7000);
      }
    }
  });

  // 3. Difficulty Selector
  selectDifficulty.addEventListener('change', (e) => {
    const diff = e.target.value;
    game.setDifficulty(diff);
    showToast(`Dificuldade alterada para: ${diff.toUpperCase()}! Treino reiniciado.`, false, 3000);
  });

  // 4. Ranking / Leaderboard Logic
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
        <td style="color: #94a3b8; font-size: 11px;">${entry.date}</td>
      `;
      rankingTableBody.appendChild(tr);
    });
  }

  btnRanking.addEventListener('click', () => {
    renderRankingTable();
    rankingModal.classList.add('open');
  });

  const closeRanking = () => rankingModal.classList.remove('open');
  btnCloseRanking.addEventListener('click', closeRanking);
  btnCloseRankingBottom.addEventListener('click', closeRanking);

  btnSaveScore.addEventListener('click', () => {
    const name = inputPlayerName.value.trim() || 'Piloto';
    game.ranking.addScore({
      name,
      score: game.score,
      difficulty: game.workout.difficulty,
      maxRpm: game.maxRpmRecorded,
      calories: game.calories,
      distanceKm: (game.distanceMeters / 1000).toFixed(2)
    });

    renderRankingTable();
    showToast(`Pontuação de ${name} gravada com sucesso no Ranking! 🏆`, false, 4000);
    inputPlayerName.value = '';
  });

  // 5. Simulation Mode Toggle
  btnToggleSim.addEventListener('click', () => {
    game.isSimulated = !game.isSimulated;
    if (game.isSimulated) {
      simDrawer.classList.add('visible');
      btnToggleSim.classList.add('connected');
      showToast('Modo de Simulação ativado (usa o slider ou teclas W/S ou Setas)');
    } else {
      simDrawer.classList.remove('visible');
      btnToggleSim.classList.remove('connected');
      showToast('Modo de Simulação desativado');
    }
  });

  simSlider.addEventListener('input', (e) => {
    const rpm = parseInt(e.target.value, 10);
    simDisplay.textContent = `${rpm} RPM`;
    game.simRpm = rpm;
  });

  // 6. Connect HUD Callback
  game.onHUDUpdate = (stats) => {
    valDistance.textContent = `${stats.distanceKm} km`;
    valCalories.textContent = `${stats.calories} kcal`;
    valScore.textContent = stats.score.toLocaleString();
    valCombo.textContent = `COMBO ${stats.combo}x`;
    valAltitude.textContent = stats.altitude;

    // Altimeter bar (10m - 130m)
    const altPercent = Math.min(100, Math.max(5, (stats.altitude / 130) * 100));
    altitudeFill.style.height = `${altPercent}%`;

    valSpeed.textContent = stats.speed;
    valCadence.textContent = stats.cadence;

    // Workout Interval Banner Display
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
        workoutStatusBadge.textContent = `▲ ACELERA! (+${diff} RPM PARA O BÓNUS)`;
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

    // Smartwatch BPM & Heart Rate Zone
    if (stats.heartRate) {
      valBpm.textContent = stats.heartRate.bpm;
      valZone.textContent = stats.heartRate.zone.name;
      valZone.style.backgroundColor = stats.heartRate.zone.color;
      valZone.style.color = '#000000';
    }
  };

  // 7. Bluetooth Status handler
  game.bluetooth.onStatusChange = (type, status, message) => {
    showToast(message, status === 'error');
  };

  // Start Game Loop
  game.start();
  showToast('Começa a pedalar a ritmo normal! O 1º Sprint começa após o aquecimento!', false, 5000);
});
