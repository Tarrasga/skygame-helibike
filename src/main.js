import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const game = new Game(container);

  // UI Elements
  const btnConnectBike = document.getElementById('btn-connect-bike');
  const btnConnectHr = document.getElementById('btn-connect-hr');
  const btnToggleSim = document.getElementById('btn-toggle-sim');
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

  const touchLeft = document.getElementById('touch-left');
  const touchRight = document.getElementById('touch-right');

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
      showToast('A procurar SMARTBIKE520...');
      const name = await game.bluetooth.connectBike();
      btnConnectBike.classList.add('connected');
      btnConnectBike.innerHTML = `<span>✔</span> ${name}`;
      showToast(`Bicicleta ${name} ligada com sucesso! Começa a pedalar!`, false, 5000);
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

  // 3. Simulation Mode Toggle
  btnToggleSim.addEventListener('click', () => {
    game.isSimulated = !game.isSimulated;
    if (game.isSimulated) {
      simDrawer.classList.add('visible');
      btnToggleSim.classList.add('connected');
      showToast('Modo de Simulação ativado (usa o cursor ou as teclas W/S ou Setas)');
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

  // 4. On-Screen Touch Steering (Swapped as requested)
  // touchLeft turns Left (direction = 1)
  // touchRight turns Right (direction = -1)
  const bindTouchZone = (element, dir) => {
    const start = (e) => {
      e.preventDefault();
      game.setTouchSteer(dir);
      element.classList.add('active');
    };
    const end = (e) => {
      e.preventDefault();
      game.setTouchSteer(0);
      element.classList.remove('active');
    };

    element.addEventListener('touchstart', start, { passive: false });
    element.addEventListener('touchend', end, { passive: false });
    element.addEventListener('touchcancel', end, { passive: false });

    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
    element.addEventListener('mouseleave', end);
  };

  bindTouchZone(touchLeft, 1);
  bindTouchZone(touchRight, -1);

  // 5. Connect HUD Callback
  game.onHUDUpdate = (stats) => {
    valDistance.textContent = `${stats.distanceKm} km`;
    valCalories.textContent = `${stats.calories} kcal`;
    valScore.textContent = stats.score.toLocaleString();
    valCombo.textContent = `COMBO ${stats.combo}x`;
    valAltitude.textContent = stats.altitude;

    // Altimeter bar
    const altPercent = Math.min(100, Math.max(5, (stats.altitude / 130) * 100));
    altitudeFill.style.height = `${altPercent}%`;

    valSpeed.textContent = stats.speed;
    valCadence.textContent = stats.cadence;

    // Visual pulse for sprint
    if (stats.isSprint) {
      cadenceCard.classList.add('sprint-active');
    } else {
      cadenceCard.classList.remove('sprint-active');
    }

    // Smartwatch BPM & Heart Rate Zone
    if (stats.heartRate) {
      valBpm.textContent = stats.heartRate.bpm;
      valZone.textContent = stats.heartRate.zone.name;
      valZone.style.backgroundColor = stats.heartRate.zone.color;
      valZone.style.color = '#000000';
    }
  };

  // 6. Bluetooth Status handler
  game.bluetooth.onStatusChange = (type, status, message) => {
    showToast(message, status === 'error');
  };

  // Start Game Loop
  game.start();
  showToast('Dica: No Brave ativa brave://flags -> Web Bluetooth API. Ou abre no Chrome!', false, 6000);
});
