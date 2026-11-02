import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

// 128-bit UUIDs for Bluetooth SIG Services & Characteristics
const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
const CSCS_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const CSCS_DATA = '00002a5b-0000-1000-8000-00805f9b34fb';
const FITSHOW_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const FITSHOW_DATA = '0000fff1-0000-1000-8000-00805f9b34fb';
const FITSHOW_DATA_ALT = '0000fff2-0000-1000-8000-00805f9b34fb';

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

    // CSCS tracking state
    this.lastWheelRevs = null;
    this.lastWheelTime = null;
    this.lastCrankRevs = null;
    this.lastCrankTime = null;
    this.lastCadenceRpm = 0;
    this.lastSpeedKmh = 0;
  }

  async initNativeBle() {
    if (this.isNative && !this.bleInitialized) {
      try {
        await BleClient.initialize({ androidNeverForLocation: true });
        this.bleInitialized = true;
      } catch (e) {
        console.warn('Native BLE init error:', e);
      }
    }
    if (this.isNative) {
      try {
        const isEnabled = await BleClient.isEnabled();
        if (!isEnabled) {
          await BleClient.requestEnable();
        }
      } catch (e) {
        console.warn('Bluetooth enable check error:', e);
      }
    }
  }

  isSupported() {
    if (this.isNative) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Connect to Bike (FTMS 0x1826 / CSCS 0x1816 / FitShow 0xFFF0)
   */
  async connectBike() {
    await this.initNativeBle();

    if (!this.isSupported()) {
      throw new Error('Bluetooth não disponível neste navegador. Usa o Google Chrome ou abre na App Android.');
    }

    this.updateStatus('bike', 'connecting', 'A procurar bicicleta (SMARTBIKE / FTMS / FitShow)...');

    if (this.isNative) {
      // ==========================================
      // 1. NATIVE ANDROID BLE
      // ==========================================
      try {
        // Do not restrict by services in requestDevice to allow all BLE devices to appear in dialog
        const device = await BleClient.requestDevice({
          optionalServices: [
            FTMS_SERVICE,
            CSCS_SERVICE,
            FITSHOW_SERVICE,
            FITSHOW_DATA,
            FITSHOW_DATA_ALT
          ]
        });

        this.bikeDeviceId = device.deviceId;
        const bikeName = device.name || 'SMARTBIKE';
        this.updateStatus('bike', 'connecting', `A ligar a ${bikeName}...`);

        await BleClient.connect(device.deviceId, () => {
          this.updateStatus('bike', 'disconnected', 'Bicicleta desligada.');
        });

        // Inspect discovered services on the connected device
        let connectedService = null;
        try {
          const servicesList = await BleClient.getServices(device.deviceId);
          const uuids = servicesList.services.map(s => s.uuid.toLowerCase());
          console.log('Serviços encontrados na bike:', uuids);

          if (uuids.some(u => u.includes('1826'))) {
            connectedService = 'FTMS';
          } else if (uuids.some(u => u.includes('1816'))) {
            connectedService = 'CSCS';
          } else if (uuids.some(u => u.includes('fff0'))) {
            connectedService = 'FITSHOW';
          }
        } catch (e) {
          console.warn('Could not inspect services list, falling back to try-catch startNotifications', e);
        }

        let subscribed = false;

        // Try FTMS
        if (!connectedService || connectedService === 'FTMS') {
          try {
            await BleClient.startNotifications(
              device.deviceId,
              FTMS_SERVICE,
              INDOOR_BIKE_DATA,
              (value) => this.parseFtmsDataView(value)
            );
            subscribed = true;
          } catch (ftmsErr) {
            console.warn('FTMS notification failed:', ftmsErr);
          }
        }

        // Try CSCS fallback
        if (!subscribed && (!connectedService || connectedService === 'CSCS')) {
          try {
            await BleClient.startNotifications(
              device.deviceId,
              CSCS_SERVICE,
              CSCS_DATA,
              (value) => this.parseCscsDataView(value)
            );
            subscribed = true;
          } catch (cscsErr) {
            console.warn('CSCS notification failed:', cscsErr);
          }
        }

        // Try FitShow fallback
        if (!subscribed && (!connectedService || connectedService === 'FITSHOW')) {
          try {
            await BleClient.startNotifications(
              device.deviceId,
              FITSHOW_SERVICE,
              FITSHOW_DATA,
              (value) => this.parseFitShowDataView(value)
            );
            subscribed = true;
          } catch (fitErr) {
            try {
              await BleClient.startNotifications(
                device.deviceId,
                FITSHOW_SERVICE,
                FITSHOW_DATA_ALT,
                (value) => this.parseFitShowDataView(value)
              );
              subscribed = true;
            } catch (fitErr2) {
              console.warn('FitShow notifications failed:', fitErr2);
            }
          }
        }

        if (!subscribed) {
          throw new Error('Não foi possível subscrever os dados de cadência da bicicleta.');
        }

        this.updateStatus('bike', 'connected', `Ligado: ${bikeName}`);
        return bikeName;
      } catch (err) {
        this.updateStatus('bike', 'error', `Falha ao ligar: ${err.message || err}`);
        throw err;
      }
    } else {
      // ==========================================
      // 2. WEB BLUETOOTH FALLBACK (Google Chrome)
      // ==========================================
      try {
        let device;
        try {
          // Accept all devices to ensure user sees SMARTBIKE520 or whatever name it has
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              'fitness_machine',
              0x1826,
              'cycling_speed_and_cadence',
              0x1816,
              0xfff0,
              0xfff1,
              0xfff2
            ]
          });
        } catch (e) {
          // Fallback with specific filters if acceptAllDevices fails
          device = await navigator.bluetooth.requestDevice({
            filters: [
              { services: ['fitness_machine'] },
              { services: ['cycling_speed_and_cadence'] },
              { namePrefix: 'SMARTBIKE' },
              { namePrefix: 'FitShow' },
              { namePrefix: 'CHAOKE' }
            ],
            optionalServices: ['fitness_machine', 0x1826, 'cycling_speed_and_cadence', 0x1816, 0xfff0]
          });
        }

        this.bikeDeviceId = device.id;
        const bikeName = device.name || 'SMARTBIKE';
        this.updateStatus('bike', 'connecting', `A ligar a ${bikeName}...`);

        device.addEventListener('gattserverdisconnected', () => {
          this.updateStatus('bike', 'disconnected', 'Bicicleta desligada.');
        });

        const server = await device.gatt.connect();

        let subscribed = false;

        // 1. Try FTMS
        try {
          let service = await server.getPrimaryService(0x1826).catch(() => server.getPrimaryService('fitness_machine'));
          let characteristic = await service.getCharacteristic(0x2ad2);
          await characteristic.startNotifications();
          characteristic.addEventListener('characteristicvaluechanged', (e) => {
            this.parseFtmsDataView(e.target.value);
          });
          subscribed = true;
        } catch (ftmsErr) {
          console.warn('Web Bluetooth FTMS failed:', ftmsErr);
        }

        // 2. Try CSCS
        if (!subscribed) {
          try {
            let service = await server.getPrimaryService(0x1816).catch(() => server.getPrimaryService('cycling_speed_and_cadence'));
            let characteristic = await service.getCharacteristic(0x2a5b);
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (e) => {
              this.parseCscsDataView(e.target.value);
            });
            subscribed = true;
          } catch (cscsErr) {
            console.warn('Web Bluetooth CSCS failed:', cscsErr);
          }
        }

        // 3. Try FitShow
        if (!subscribed) {
          try {
            let service = await server.getPrimaryService(0xfff0);
            let characteristic = await service.getCharacteristic(0xfff1).catch(() => service.getCharacteristic(0xfff2));
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (e) => {
              this.parseFitShowDataView(e.target.value);
            });
            subscribed = true;
          } catch (fitErr) {
            console.warn('Web Bluetooth FitShow failed:', fitErr);
          }
        }

        if (!subscribed) {
          throw new Error('Nenhum serviço de dados de bicicleta (FTMS / CSCS / FitShow) encontrado.');
        }

        this.updateStatus('bike', 'connected', `Ligado: ${bikeName}`);
        return bikeName;
      } catch (err) {
        let msg = err.message || err;
        if (typeof msg === 'string' && msg.toLowerCase().includes('globally disabled')) {
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
      throw new Error('Bluetooth não disponível neste navegador. Usa o Google Chrome ou abre na App Android.');
    }

    this.updateStatus('heart', 'connecting', 'A procurar Smartwatch / Monitor Cardíaco...');

    if (this.isNative) {
      // ==========================================
      // NATIVE ANDROID BLE
      // ==========================================
      try {
        const device = await BleClient.requestDevice({
          optionalServices: [HR_SERVICE]
        });

        this.hrDeviceId = device.deviceId;
        const watchName = device.name || 'Smartwatch';
        this.updateStatus('heart', 'connecting', `A ligar a ${watchName}...`);

        await BleClient.connect(device.deviceId, () => {
          this.updateStatus('heart', 'disconnected', 'Smartwatch desligado.');
        });

        await BleClient.startNotifications(
          device.deviceId,
          HR_SERVICE,
          HR_DATA,
          (value) => this.parseHeartRateDataView(value)
        );

        this.updateStatus('heart', 'connected', `Ligado: ${watchName}`);
        return watchName;
      } catch (err) {
        this.updateStatus('heart', 'error', `Falha ao ligar relógio: ${err.message || err}`);
        throw err;
      }
    } else {
      // ==========================================
      // WEB BLUETOOTH FALLBACK
      // ==========================================
      try {
        let device;
        try {
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['heart_rate', 0x180d]
          });
        } catch (e) {
          device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }],
            optionalServices: ['heart_rate', 0x180d]
          });
        }

        this.hrDeviceId = device.id;
        const watchName = device.name || 'Smartwatch';
        this.updateStatus('heart', 'connecting', `A ligar a ${watchName}...`);

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

        this.updateStatus('heart', 'connected', `Ligado: ${watchName}`);
        return watchName;
      } catch (err) {
        let msg = err.message || err;
        if (typeof msg === 'string' && msg.toLowerCase().includes('globally disabled')) {
          msg = 'No Brave: vai a brave://flags, ativa "Web Bluetooth API" e reinicia. Ou abre no Chrome!';
        }
        this.updateStatus('heart', 'error', msg);
        throw new Error(msg);
      }
    }
  }

  /**
   * Parse FTMS DataView packet (0x2AD2)
   */
  parseFtmsDataView(value) {
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
   * Parse CSCS (Cycling Speed & Cadence) DataView packet (0x2A5B)
   */
  parseCscsDataView(value) {
    if (!value || value.byteLength < 1) return;

    const flags = value.getUint8(0);
    let offset = 1;

    const wheelRevsPresent = (flags & 0x01) !== 0;
    const crankRevsPresent = (flags & 0x02) !== 0;

    if (wheelRevsPresent && offset + 6 <= value.byteLength) {
      const wheelRevs = value.getUint32(offset, true);
      const wheelTime = value.getUint16(offset + 4, true);
      offset += 6;

      if (this.lastWheelTime !== null && wheelTime !== this.lastWheelTime) {
        let timeDiff = (wheelTime - this.lastWheelTime) & 0xffff;
        let revDiff = (wheelRevs - this.lastWheelRevs) & 0xffffffff;
        if (timeDiff > 0 && revDiff >= 0) {
          const speedMps = (revDiff * 2.1) / (timeDiff / 1024.0);
          this.lastSpeedKmh = Math.round(speedMps * 3.6 * 10) / 10;
        }
      }
      this.lastWheelRevs = wheelRevs;
      this.lastWheelTime = wheelTime;
    }

    if (crankRevsPresent && offset + 4 <= value.byteLength) {
      const crankRevs = value.getUint16(offset, true);
      const crankTime = value.getUint16(offset + 2, true);

      if (this.lastCrankTime !== null && crankTime !== this.lastCrankTime) {
        let timeDiff = (crankTime - this.lastCrankTime) & 0xffff;
        let revDiff = (crankRevs - this.lastCrankRevs) & 0xffff;
        if (timeDiff > 0 && revDiff >= 0) {
          this.lastCadenceRpm = Math.round((revDiff / (timeDiff / 1024.0)) * 60);
        }
      }
      this.lastCrankRevs = crankRevs;
      this.lastCrankTime = crankTime;
    }

    if (this.onBikeData) {
      this.onBikeData({
        cadence: this.lastCadenceRpm || 0,
        speed: this.lastSpeedKmh || (this.lastCadenceRpm ? Math.round(this.lastCadenceRpm * 0.35) : 0),
        power: 0,
        rawTimestamp: performance.now()
      });
    }
  }

  /**
   * Parse FitShow DataView packet (0xFFF1 / 0xFFF2)
   */
  parseFitShowDataView(value) {
    if (!value || value.byteLength < 4) return;

    let cadenceRpm = 0;
    let speedKmh = 0;

    // Common FitShow packet patterns
    // Byte 0: 0x02 or 0x53
    if (value.byteLength >= 10) {
      // FitShow indoor bike telemetry packet
      const rawSpeed = (value.getUint8(4) << 8) | value.getUint8(5);
      speedKmh = rawSpeed * 0.1;

      if (value.byteLength >= 8) {
        cadenceRpm = (value.getUint8(6) << 8) | value.getUint8(7);
      }
      if (cadenceRpm === 0 && speedKmh > 0) {
        cadenceRpm = Math.round(speedKmh * 3.2);
      }
    } else {
      // Shorter packet fallback
      cadenceRpm = value.getUint8(value.byteLength - 2);
    }

    if (this.onBikeData) {
      this.onBikeData({
        cadence: cadenceRpm,
        speed: speedKmh,
        power: 0,
        rawTimestamp: performance.now()
      });
    }
  }

  /**
   * Parse Heart Rate DataView packet (0x2A37)
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
