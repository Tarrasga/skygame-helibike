/**
 * Ranking / Leaderboard Manager for SkyGame: Helibike
 * Persists scores locally and ranks by total score.
 */

const STORAGE_KEY = 'skygame_helibike_ranking';

export class RankingManager {
  constructor() {
    this.scores = this.loadScores();
  }

  loadScores() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load ranking:', e);
    }

    // Default sample scores for initial atmosphere
    return [
      { name: 'SkyAce 77', score: 12500, difficulty: 'dificil', maxRpm: 110, calories: 185, date: '01/11/2026' },
      { name: 'Helibiker', score: 8400, difficulty: 'normal', maxRpm: 92, calories: 140, date: '31/10/2026' },
      { name: 'AeroCadence', score: 5200, difficulty: 'normal', maxRpm: 85, calories: 115, date: '30/10/2026' },
      { name: 'ChaokeRider', score: 3600, difficulty: 'facil', maxRpm: 74, calories: 90, date: '29/10/2026' },
      { name: 'FitPilot', score: 2100, difficulty: 'facil', maxRpm: 68, calories: 65, date: '28/10/2026' }
    ];
  }

  saveScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.scores));
    } catch (e) {
      console.warn('Failed to save ranking:', e);
    }
  }

  getScores() {
    return this.scores;
  }

  isHighScore(score) {
    if (this.scores.length < 10) return true;
    return score > this.scores[this.scores.length - 1].score;
  }

  addScore(entry) {
    // entry: { name, score, difficulty, maxRpm, calories, distanceKm }
    const newEntry = {
      name: (entry.name || 'Piloto').substring(0, 15),
      score: Math.round(entry.score),
      difficulty: entry.difficulty || 'normal',
      maxRpm: Math.round(entry.maxRpm || 0),
      calories: Math.round(entry.calories || 0),
      distanceKm: entry.distanceKm || '0.00',
      date: new Date().toLocaleDateString('pt-PT')
    };

    this.scores.push(newEntry);
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 10); // Keep top 10

    this.saveScores();
    return this.scores;
  }
}
