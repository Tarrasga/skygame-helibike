import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

// 128-bit UUIDs for Bluetooth SIG Services & Characteristics
const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
const CSCS_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const CSCS_DATA = '00002a5b-0000-1000-8000-00805f9b34fb';
const FITSHOW_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_DATA = '00002a37-0000-1000-8000-00805f9b34fb';

/**
 * Universal Bluetooth Manager
 * - Native Android BLE via @capacitor-community/bluetooth-le (inside Android App)
 * - Web Bluetooth fallback via navigator.bluetooth (inside Google Chrome)
 */
export class BluetoothManager {
  constructor() {
    this.bikeDeviceId = null;
    this.hrDeviceId = null;

    this.onBikeData = null; // callback(cadence, speed, power)
    this.onHeartRateData = null; // callback(bpm, zone)
    this.onStatusChange = null;

    this.isNative = Capacitor.isNativePlatform();
    this.bleInitialized = false;
  }

  async initNativeBle() {
    if (this.isNative && !this.bleInitialized) {
      try {
        await BleClient.initialize();
        this.bleInitialized = true;
      } catch (e) {
        console.warn('Native BLE init error:', e);
      }
    }
  }

  isSupported() {
    if (this.isNative) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Connect to Bike (FTMS 0x1826)
   */
  async connectBike() {
    await this.initNativeBle();

    if (!this.isSupported()) {
      throw new Error('Bluetooth não disponível neste navegador. Usa o Google Chrome ou instala a App Android.');
    }

    this.updateStatus('bike', 'connecting', 'A procurar bicicleta SMARTBIKE...');

    if (this.isNative) {
      // 1. NATIVE ANDROID BLE
      try {
        const device = await BleClient.requestDevice({
          services: [FTMS_SERVICE],
          optionalServices: [FTMS_SERVICE, CSCS_SERVICE, FITSHOW_SERVICE]
        });

        this.bikeDeviceId = device.deviceId;
        this.updateStatus('bike', 'connecting', `A ligar a ${device.name || 'SMARTBIKE'}...`);

        await BleClient.connect(device.deviceId, () => {
          this.updateStatus('bike', 'disconnected', 'Bicicleta desligada.');
        });

        // Try FTMS service first
        try {
          await BleClient.startNotifications(
            device.deviceId,
            FTMS_SERVICE,
            INDOOR_BIKE_DATA,
            (value) => this.parseBikeDataView(value)
          );
        } catch (ftmsErr) {
          console.warn('FTMS notification failed, trying CSCS fallback...', ftmsErr);
          await BleClient.startNotifications(
            device.deviceId,
            CSCS_SERVICE,
            CSCS_DATA,
            (value) => this.parseBikeDataView(value)
          );
        }

        const name = device.name || 'SMARTBIKE';
        this.updateStatus('bike', 'connected', `Ligado: ${name}`);
        return name;
      } catch (err) {
        this.updateStatus('bike', 'error', `Falha ao ligar: ${err.message}`);
        throw err;
      }
    } else {
      // 2. WEB BLUETOOTH FALLBACK (Google Chrome)
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['fitness_machine'] },
            { namePrefix: 'SMARTBIKE' },
            { namePrefix: 'FitShow' },
            { namePrefix: 'CHAOKE' }
          ],
          optionalServices: ['fitness_machine', 0x1826, 'cycling_speed_and_cadence', 0x1816, 0xfff0]
        });

        this.bikeDeviceId = device.id;
        this.updateStatus('bike', 'connecting', `A ligar a ${device.name || 'Bicicleta'}...`);

        device.addEventListener('gattserverdisconnected', () => {
          this.updateStatus('bike', 'disconnected', 'Bicicleta desligada.');
        });

        const server = await device.gatt.connect();

        let service;
        try {
          service = await server.getPrimaryService('fitness_machine');
        } catch (e) {
          service = await server.getPrimaryService(0x1826);
        }

        let characteristic;
        try {
          characteristic = await service.getCharacteristic(0x2ad2);
        } catch (e) {
          characteristic = await service.getCharacteristic(0x2a5b);
        }

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (e) => {
          this.parseBikeDataView(e.target.value);
        });

        const name = device.name || 'SMARTBIKE';
        this.updateStatus('bike', 'connected', `Ligado: ${name}`);
        return name;
      } catch (err) {
        let msg = err.message;
        if (msg && msg.toLowerCase().includes('globally disabled')) {
          msg = 'No Brave: vai a brave://flags, ativa "Web Bluetooth API" e reinicia. Ou abre no Chrome!';
        }
        this.updateStatus('bike', 'error', msg);
        throw new Error(msg);
      }
    }
  }

  /**
   * Connect to Smartwatch Heart Rate (0x180D)
   */
  async connectSmartwatch() {
    await this.initNativeBle();

    if (!this.isSupported()) {
      throw new Error('Bluetooth não disponível neste navegador. Usa o Google Chrome ou instala a App Android.');
    }

    this.updateStatus('heart', 'connecting', 'A procurar Smartwatch / Monitor Cardíaco...');

    if (this.isNative) {
      // NATIVE ANDROID BLE
      try {
        const device = await BleClient.requestDevice({
          services: [HR_SERVICE],
          optionalServices: [HR_SERVICE]
        });

        this.hrDeviceId = device.deviceId;
        this.updateStatus('heart', 'connecting', `A ligar a ${device.name || 'Smartwatch'}...`);

        await BleClient.connect(device.deviceId, () => {
          this.updateStatus('heart', 'disconnected', 'Smartwatch desligado.');
        });

        await BleClient.startNotifications(
          device.deviceId,
          HR_SERVICE,
          HR_DATA,
          (value) => this.parseHeartRateDataView(value)
        );

        const name = device.name || 'Smartwatch';
        this.updateStatus('heart', 'connected', `Ligado: ${name}`);
        return name;
      } catch (err) {
        this.updateStatus('heart', 'error', `Falha ao ligar relógio: ${err.message}`);
        throw err;
      }
    } else {
      // WEB BLUETOOTH FALLBACK
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['heart_rate'] }],
          optionalServices: ['heart_rate', 0x180d]
        });

        this.hrDeviceId = device.id;
        this.updateStatus('heart', 'connecting', `A ligar a ${device.name || 'Smartwatch'}...`);

        device.addEventListener('gattserverdisconnected', () => {
          this.updateStatus('heart', 'disconnected', 'Smartwatch desligado.');
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        const characteristic = await service.getCharacteristic(0x2a37);

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (e) => {
          this.parseHeartRateDataView(e.target.value);
        });

        const name = device.name || 'Smartwatch';
        this.updateStatus('heart', 'connected', `Ligado: ${name}`);
        return name;
      } catch (err) {
        let msg = err.message;
        if (msg && msg.toLowerCase().includes('globally disabled')) {
          msg = 'No Brave: vai a brave://flags, ativa "Web Bluetooth API" e reinicia. Ou abre no Chrome!';
        }
        this.updateStatus('heart', 'error', msg);
        throw new Error(msg);
      }
    }
  }

  /**
   * Parse FTMS DataView packet
   */
  parseBikeDataView(value) {
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
      speedKmh = value.getUint16(offset, true) * 0.01;
      offset += 2;
    }

    // Bit 1: Avg speed
    if ((flags & 0x0002) !== 0 && offset + 2 <= value.byteLength) {
      offset += 2;
    }

    // Bit 2: Instantaneous Cadence
    const instantCadencePresent = (flags & 0x0004) !== 0;
    if (instantCadencePresent && offset + 2 <= value.byteLength) {
      cadenceRpm = value.getUint16(offset, true) * 0.5;
      offset += 2;
    } else if (speedKmh > 0 && cadenceRpm === 0) {
      cadenceRpm = Math.round(speedKmh * 3.2);
    }

    // Bit 6: Power
    if ((flags & 0x0040) !== 0 && offset + 2 <= value.byteLength) {
      powerWatts = value.getInt16(offset, true);
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
   * Parse Heart Rate DataView packet
   */
  parseHeartRateDataView(value) {
    if (!value || value.byteLength < 2) return;

    const flags = value.getUint8(0);
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
}
