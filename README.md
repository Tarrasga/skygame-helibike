# 🚁 SkyGame: Helibike 3D

[![Download APK](https://img.shields.io/badge/Download_APK-SkyGame--Helibike.apk-brightgreen?style=for-the-badge&logo=android)](https://github.com/Tarrasga/skygame-helibike/raw/main/SkyGame-Helibike.apk)
[![GitHub Release](https://img.shields.io/github/v/release/Tarrasga/skygame-helibike?style=for-the-badge&color=blue)](https://github.com/Tarrasga/skygame-helibike/releases)

Um jogo 3D de **exergaming** (treino interativo) para Android e Web, inspirado no clássico *Cyberbike* (Nintendo Wii).

A tua bicicleta estática transforma-se numa **Helibike** futurista com hélice: quanto mais rápido pedalas, mais alto voas no céu! Passa por anéis a diferentes altitudes, desvia-te de obstáculos e monitoriza os teus batimentos cardíacos em tempo real através do teu smartwatch.

---

## 📲 Download & Instalação Rápida no Android

Podes descarregar e instalar o jogo diretamente no teu telemóvel ou tablet:

👉 **[CLICA AQUI PARA DESCARREGAR O APK (SkyGame-Helibike.apk)](https://github.com/Tarrasga/skygame-helibike/raw/main/SkyGame-Helibike.apk)**

1. Abre este link no telemóvel ou tablet para descarregar o ficheiro `.apk`.
2. Toca no ficheiro descarregado e confirma a instalação (*permitir instalar aplicações desta fonte*).
3. Abre a aplicação **SkyGame Helibike** com o telemóvel na horizontal no guiador da bicicleta.
4. Toca em **"Ligar SMARTBIKE"**, seleciona a tua bicicleta e começa a pedalar!

---

## ⚡ Hardware Suportado

* **Bicicleta Estática:** Compatível com protocolo padrão **Bluetooth FTMS (Fitness Machine Service, UUID `0x1826`)** e **FitShow**, incluindo modelos **Chaoke SMARTBIKE520**.
  * Dados lidos em tempo real: **Cadência (RPM)**, **Velocidade (km/h)** e **Potência (Watts)**.
* **Smartwatches & Monitores Cardíacos:** Qualquer relógio ou banda compatível com **Bluetooth Heart Rate Service (UUID `0x180D`)** (Garmin, Polar, Apple Watch com app de broadcast, Wear OS / Galaxy Watch com app de broadcast BLE).
  * Dados lidos: **Frequência Cardíaca (BPM)** e cálculo automático de zonas de treino (*Aquecimento*, *Aeróbico*, *Queima de Gordura*, *NITRO*).

---

## 🎮 Mecânica de Voo (Helibike)

* **Sustentação & Altitude (RPM):**
  * `< 45 RPM:` A Helibike desce suavemente em auto-rotação / planar.
  * `~55 - 65 RPM:` Voo nivelado de cruzeiro.
  * `> 85 RPM (Sprint):` A hélice ruge, sobes à estratosfera para apanhar os anéis dourados de pontuação máxima!
* **Anéis de Pontuação:**
  * 🥉 **Bronze (Baixa Altitude - 15m a 30m):** 50 pts (fase de descanso/recuperação).
  * 🥈 **Prata (Média Altitude - 35m a 65m):** 150 pts (ritmo de cruzeiro constante).
  * 🥇 **Ouro (Alta Altitude - 75m a 120m):** 500 pts (requer sprint real de alta cadência!).
* **Bónus Cardio:** Ao treinares na tua zona aeróbica/cardio, ativas um multiplicador de **1.5x em todos os anéis**!
* **Térmicas Ascendentes:** Correntes de ar quente que te impulsionam para cima permitindo descansar as pernas.

---

## 🛠️ Tecnologias Utilizadas

* **Three.js** (WebGL 3D engine)
* **Web Bluetooth API** (FTMS `0x1826` + Heart Rate `0x180D`)
* **Capacitor 6** (Empacotamento nativo Android)
* **Vite** (Bundler com suporte HTTPS para testes na rede local)
* **Web Audio API** (Sintetizador dinâmico do som da hélice proporcional ao RPM)

---

## 💻 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar servidor local com suporte a rede e HTTPS
npm run dev

# Compilar para produção
npm run build

# Sincronizar com projeto Android
npx cap sync android
```
