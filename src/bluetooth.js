import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

// 128-bit UUIDs for Exercise Bike Bluetooth SIG Services & Characteristics
const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
const CSCS_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const CSCS_DATA = '00002a5b-0000-1000-8000-00805f9b34fb';
const FITSHOW_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const FITSHOW_DATA = '0000fff1-0000-1000-8000-00805f9b34fb';
const FITSHOW_DATA_ALT = '0000fff2-0000-1000-8000-00805f9b34fb';

/**
 * Universal Bluetooth Manager for Exercise Bikes (FTMS / CSCS / FitShow)
 * - Native Android BLE via @capacitor-community/bluetooth-le (inside Android App)
 * - Web Bluetooth fallback via navigator.bluetooth (inside Google Chrome)
 */
export class BluetoothManager {
  constructor() {
    this.bikeDeviceId = null;
    this.bikeName = null;

    this.onBikeData = null; // callback({ cadence, speed, power, rawTimestamp })
    this.onStatusChange = null; // callback(type, status, message)

    this.isNative = Capacitor.isNativePlatform();
    this.bleInitialized = false;

    // CSCS state tracking
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

    this.updateStatus('bike', 'connecting', 'A procurar bicicleta...');

    if (this.isNative) {
      // ==========================================
      // 1. NATIVE ANDROID BLE
      // ==========================================
      try {
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
        this.bikeName = device.name || 'Bicicleta';
        this.updateStatus('bike', 'connecting', `A ligar a ${this.bikeName}...`);

        await BleClient.connect(device.deviceId, () => {
          this.handleBikeDisconnected();
        });

        // Inspect discovered services on the connected device
        let connectedService = null;
        try {
          const servicesList = await BleClient.getServices(device.deviceId);
          const uuids = servicesList.services.map((s) => s.uuid.toLowerCase());

          if (uuids.some((u) => u.includes('1826'))) {
            connectedService = 'FTMS';
          } else if (uuids.some((u) => u.includes('1816'))) {
            connectedService = 'CSCS';
          } else if (uuids.some((u) => u.includes('fff0'))) {
            connectedService = 'FITSHOW';
          }
        } catch (e) {
          console.warn('GATT services inspection failed, trying standard fallback:', e);
        }

        let subscribed = false;

        // Try FTMS (Indoor Bike Data)
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

        this.updateStatus('bike', 'connected', `Ligado: ${this.bikeName}`);
        return this.bikeName;
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
          device = await navigator.bluetooth.requestDevice({
            filters: [
              { services: ['fitness_machine'] },
              { services: ['cycling_speed_and_cadence'] },
              { namePrefix: 'ck_' },
              { namePrefix: 'SMARTBIKE' },
              { namePrefix: 'FitShow' },
              { namePrefix: 'CHAOKE' }
            ],
            optionalServices: ['fitness_machine', 0x1826, 'cycling_speed_and_cadence', 0x1816, 0xfff0]
          });
        }

        this.bikeDeviceId = device.id;
        this.bikeName = device.name || 'Bicicleta';
        this.updateStatus('bike', 'connecting', `A ligar a ${this.bikeName}...`);

        device.addEventListener('gattserverdisconnected', () => {
          this.handleBikeDisconnected();
        });

        const server = await device.gatt.connect();

        let subscribed = false;

        // 1. FTMS
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

        // 2. CSCS
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

        // 3. FitShow
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

        this.updateStatus('bike', 'connected', `Ligado: ${this.bikeName}`);
        return this.bikeName;
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

  handleBikeDisconnected() {
    this.bikeDeviceId = null;
    this.lastCadenceRpm = 0;
    this.lastSpeedKmh = 0;
    this.updateStatus('bike', 'disconnected', 'Bicicleta desligada. Velocidade a 0.');
    if (this.onBikeData) {
      this.onBikeData({
        cadence: 0,
        speed: 0,
        power: 0,
        rawTimestamp: performance.now()
      });
    }
  }

  /**
   * Helper to compute speed:
   * When pedaling (cadence > 0), minimum speed is 18 km/h and scales up with RPM!
   * When stopped (cadence == 0), speed is 0 km/h!
   */
  computeSpeed(cadenceRpm, rawBikeSpeed = 0) {
    if (cadenceRpm <= 0) return 0;

    // Minimum speed is 18 km/h and increases with RPM
    const baseSpeed = 18.0;
    const rpmIncrease = Math.max(0, (cadenceRpm - 20) * 0.35);
    const calculatedSpeed = Math.round((baseSpeed + rpmIncrease) * 10) / 10;

    if (rawBikeSpeed > 0) {
      return Math.max(18.0, Math.max(rawBikeSpeed, calculatedSpeed));
    }
    return calculatedSpeed;
  }

  /**
   * Parse FTMS DataView packet (0x2AD2)
   */
  parseFtmsDataView(value) {
    if (!value || value.byteLength < 2) return;

    let offset = 0;
    const flags = value.getUint16(offset, true);
    offset += 2;

    let rawSpeedKmh = 0;
    let cadenceRpm = 0;
    let powerWatts = 0;

    // Bit 0: More Data (0 = Instantaneous Speed present)
    const instantSpeedPresent = (flags & 0x0001) === 0;
    if (instantSpeedPresent && offset + 2 <= value.byteLength) {
      rawSpeedKmh = value.getUint16(offset, true) * 0.01;
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
    } else if (rawSpeedKmh > 0 && cadenceRpm === 0) {
      cadenceRpm = Math.round(rawSpeedKmh * 3.2);
    }

    // Bit 6: Power
    if ((flags & 0x0040) !== 0 && offset + 2 <= value.byteLength) {
      powerWatts = value.getInt16(offset, true);
    }

    const finalSpeed = this.computeSpeed(cadenceRpm, rawSpeedKmh);

    if (this.onBikeData) {
      this.onBikeData({
        cadence: cadenceRpm,
        speed: finalSpeed,
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

    let rawWheelSpeed = 0;

    if (wheelRevsPresent && offset + 6 <= value.byteLength) {
      const wheelRevs = value.getUint32(offset, true);
      const wheelTime = value.getUint16(offset + 4, true);
      offset += 6;

      if (this.lastWheelTime !== null && wheelTime !== this.lastWheelTime) {
        let timeDiff = (wheelTime - this.lastWheelTime) & 0xffff;
        let revDiff = (wheelRevs - this.lastWheelRevs) & 0xffffffff;
        if (timeDiff > 0 && revDiff >= 0) {
          const speedMps = (revDiff * 2.1) / (timeDiff / 1024.0);
          rawWheelSpeed = Math.round(speedMps * 3.6 * 10) / 10;
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

    const finalSpeed = this.computeSpeed(this.lastCadenceRpm, rawWheelSpeed);

    if (this.onBikeData) {
      this.onBikeData({
        cadence: this.lastCadenceRpm || 0,
        speed: finalSpeed,
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
    let rawSpeed = 0;

    if (value.byteLength >= 10) {
      rawSpeed = ((value.getUint8(4) << 8) | value.getUint8(5)) * 0.1;
      cadenceRpm = (value.getUint8(6) << 8) | value.getUint8(7);
      if (cadenceRpm === 0 && rawSpeed > 0) {
        cadenceRpm = Math.round(rawSpeed * 3.2);
      }
    } else {
      cadenceRpm = value.getUint8(value.byteLength - 2);
    }

    const finalSpeed = this.computeSpeed(cadenceRpm, rawSpeed);

    if (this.onBikeData) {
      this.onBikeData({
        cadence: cadenceRpm,
        speed: finalSpeed,
        power: 0,
        rawTimestamp: performance.now()
      });
    }
  }

  updateStatus(type, status, message) {
    if (this.onStatusChange) {
      this.onStatusChange(type, status, message);
    }
  }
}
