/**
 * Bluetooth BLE Manager for SkyGame: Helibike
 * Connects to:
 * 1. FTMS Bike (Chaoke / FitShow SMARTBIKE) - Cadence & Speed
 * 2. Heart Rate Smartwatch (Garmin, Polar, Apple Watch / Wear OS broadcast) - Heart Rate (BPM)
 */

export class BluetoothManager {
  constructor() {
    this.bikeDevice = null;
    this.bikeServer = null;
    this.bikeCharacteristic = null;

    this.hrDevice = null;
    this.hrServer = null;
    this.hrCharacteristic = null;

    this.onBikeData = null; // callback(cadence, speed, power)
    this.onHeartRateData = null; // callback(bpm)
    this.onStatusChange = null; // callback(type, status, message)

    this.isSimulated = false;
    this.simulatedCadence = 65; // default cruise RPM
    this.simulatedSpeed = 22.0; // km/h
    this.simulatedBPM = 125;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Connect to the Exercise Bike via FTMS (Fitness Machine Service 0x1826)
   */
  async connectBike() {
    if (!this.isSupported()) {
      const isBrave = navigator.brave !== undefined;
      const help = isBrave
        ? 'No Brave: acede a brave://flags, pesquisa "bluetooth", ativa "Web Bluetooth API" e reinicia. Ou abre no Google Chrome!'
        : 'O teu navegador não suporta Web Bluetooth. Usa o Google Chrome no Android ou a App Android SkyGame.';
      throw new Error(help);
    }

    try {
      this.updateStatus('bike', 'connecting', 'A procurar bicicleta Bluetooth...');

      // Filters for FTMS standard service or all devices with FTMS optional
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['fitness_machine'] },
          { namePrefix: 'SMARTBIKE' },
          { namePrefix: 'FitShow' },
          { namePrefix: 'FS-' },
          { namePrefix: 'CHAOKE' }
        ],
        optionalServices: [
          'fitness_machine', // 0x1826
          0x1826,
          'cycling_speed_and_cadence', // 0x1816
          0x1816,
          0xfff0 // Proprietary FitShow service fallback
        ]
      });

      this.bikeDevice = device;
      this.updateStatus('bike', 'connecting', `A ligar a ${device.name || 'Bicicleta'}...`);

      device.addEventListener('gattserverdisconnected', () => {
        this.updateStatus('bike', 'disconnected', 'Bicicleta desligada.');
      });

      const server = await device.gatt.connect();
      this.bikeServer = server;

      // Try connecting to FTMS first
      let service;
      try {
        service = await server.getPrimaryService('fitness_machine');
      } catch (err) {
        console.warn('FTMS standard service not found by name, trying UUID 0x1826...', err);
        try {
          service = await server.getPrimaryService(0x1826);
        } catch (err2) {
          console.warn('FTMS service 0x1826 failed, trying Cycling Speed and Cadence 0x1816...', err2);
          service = await server.getPrimaryService(0x1816);
        }
      }

      // Indoor Bike Data characteristic is 0x2AD2
      let characteristic;
      try {
        characteristic = await service.getCharacteristic(0x2ad2);
      } catch (err) {
        console.warn('0x2AD2 failed, trying cycling measurement 0x2A5B...', err);
        characteristic = await service.getCharacteristic(0x2a5b);
      }

      this.bikeCharacteristic = characteristic;
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (e) => this.handleBikePacket(e));

      this.updateStatus('bike', 'connected', `Ligado: ${device.name || 'SMARTBIKE'}`);
      return device.name || 'SMARTBIKE';
    } catch (err) {
      let msg = err.message;
      if (msg && msg.toLowerCase().includes('globally disabled')) {
        msg = 'No Brave: vai a brave://flags, ativa "Web Bluetooth API" e reinicia o navegador. Ou abre no Google Chrome!';
      }
      this.updateStatus('bike', 'error', msg);
      throw new Error(msg);
    }
  }

  /**
   * Parse FTMS (0x2AD2) Indoor Bike Data packets
   */
  handleBikePacket(event) {
    const value = event.target.value;
    if (!value || value.byteLength < 2) return;

    let offset = 0;
    const flags = value.getUint16(offset, true);
    offset += 2;

    let speedKmh = 0;
    let cadenceRpm = 0;
    let powerWatts = 0;

    // Bit 0: More Data (0 = Instantaneous Speed present)
    const instantSpeedPresent = (flags & 0x0001) === 0;
    if (instantSpeedPresent && offset + 2 <= value.byteLength) {
      // Unit: 0.01 km/h
      speedKmh = value.getUint16(offset, true) * 0.01;
      offset += 2;
    }

    // Bit 1: Average Speed Present
    const avgSpeedPresent = (flags & 0x0002) !== 0;
    if (avgSpeedPresent && offset + 2 <= value.byteLength) {
      offset += 2;
    }

    // Bit 2: Instantaneous Cadence Present
    const instantCadencePresent = (flags & 0x0004) !== 0;
    if (instantCadencePresent && offset + 2 <= value.byteLength) {
      // Unit: 0.5 1/min (RPM)
      cadenceRpm = value.getUint16(offset, true) * 0.5;
      offset += 2;
    } else if (speedKmh > 0 && cadenceRpm === 0) {
      // Fallback: estimate cadence from speed if bike only sends speed
      cadenceRpm = Math.round(speedKmh * 3.2);
    }

    // Bit 3: Average Cadence Present
    const avgCadencePresent = (flags & 0x0008) !== 0;
    if (avgCadencePresent && offset + 2 <= value.byteLength) {
      offset += 2;
    }

    // Bit 4: Total Distance Present (uint24)
    const totalDistPresent = (flags & 0x0010) !== 0;
    if (totalDistPresent && offset + 3 <= value.byteLength) {
      offset += 3;
    }

    // Bit 5: Resistance Level Present (sint16)
    const resistancePresent = (flags & 0x0020) !== 0;
    if (resistancePresent && offset + 2 <= value.byteLength) {
      offset += 2;
    }

    // Bit 6: Instantaneous Power Present (sint16)
    const instantPowerPresent = (flags & 0x0040) !== 0;
    if (instantPowerPresent && offset + 2 <= value.byteLength) {
      powerWatts = value.getInt16(offset, true);
      offset += 2;
    }

    if (this.onBikeData) {
      this.onBikeData({
        cadence: cadenceRpm,
        speed: speedKmh,
        power: powerWatts,
        rawTimestamp: performance.now()
      });
    }
  }

  /**
   * Connect to Smartwatch Heart Rate Service (0x180D)
   */
  async connectSmartwatch() {
    if (!this.isSupported()) {
      const isBrave = navigator.brave !== undefined;
      const help = isBrave
        ? 'No Brave: acede a brave://flags, ativa "Web Bluetooth API" e reinicia. Ou abre no Google Chrome!'
        : 'Bluetooth não disponível.';
      throw new Error(help);
    }

    try {
      this.updateStatus('heart', 'connecting', 'A procurar Smartwatch / Monitor Cardíaco...');

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['heart_rate', 0x180d]
      });

      this.hrDevice = device;
      this.updateStatus('heart', 'connecting', `A ligar a ${device.name || 'Smartwatch'}...`);

      device.addEventListener('gattserverdisconnected', () => {
        this.updateStatus('heart', 'disconnected', 'Smartwatch desligado.');
      });

      const server = await device.gatt.connect();
      this.hrServer = server;

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic(0x2a37); // Heart Rate Measurement

      this.hrCharacteristic = characteristic;
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (e) => this.handleHeartRatePacket(e));

      this.updateStatus('heart', 'connected', `Ligado: ${device.name || 'Smartwatch'}`);
      return device.name || 'Smartwatch';
    } catch (err) {
      let msg = err.message;
      if (msg && msg.toLowerCase().includes('globally disabled')) {
        msg = 'No Brave: vai a brave://flags, ativa "Web Bluetooth API" e reinicia o navegador. Ou abre no Google Chrome!';
      }
      this.updateStatus('heart', 'error', msg);
      throw new Error(msg);
    }
  }

  /**
   * Parse Heart Rate Measurement (0x2A37)
   */
  handleHeartRatePacket(event) {
    const value = event.target.value;
    if (!value || value.byteLength < 2) return;

    const flags = value.getUint8(0);
    // Bit 0: 0 = uint8 BPM, 1 = uint16 BPM
    let bpm = 0;
    if ((flags & 0x01) === 0) {
      bpm = value.getUint8(1);
    } else {
      bpm = value.getUint16(1, true);
    }

    if (this.onHeartRateData) {
      this.onHeartRateData({
        bpm,
        zone: this.getHeartRateZone(bpm)
      });
    }
  }

  /**
   * Calculate cardiovascular training zones based on max heart rate (~185 bpm estimate)
   */
  getHeartRateZone(bpm) {
    if (bpm < 100) return { name: 'Aquecimento', color: '#60a5fa', level: 1 };
    if (bpm < 130) return { name: 'Queima Gordura', color: '#34d399', level: 2 };
    if (bpm < 155) return { name: 'Aeróbico', color: '#facc15', level: 3 };
    if (bpm < 175) return { name: 'Anaeróbico', color: '#fb923c', level: 4 };
    return { name: 'NITRO / MÁXIMO', color: '#f87171', level: 5 };
  }

  updateStatus(type, status, message) {
    if (this.onStatusChange) {
      this.onStatusChange(type, status, message);
    }
  }

  disconnectAll() {
    if (this.bikeDevice && this.bikeDevice.gatt.connected) {
      this.bikeDevice.gatt.disconnect();
    }
    if (this.hrDevice && this.hrDevice.gatt.connected) {
      this.hrDevice.gatt.disconnect();
    }
  }
}
