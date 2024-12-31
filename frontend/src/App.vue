// Frontend changes (Vue component)
<script setup>
</script>

<template>
  <div class="game-container">
    <!-- Login Screen -->
    <div v-if="!isInGame" class="login-screen">
      <input 
        v-model="username" 
        placeholder="Enter your username"
        @keyup.enter="joinGame"
      >
      <button @click="joinGame">Join Game</button>
    </div>

    <!-- Game Board -->
    <div v-else class="game-board">
      <div class="game-info">
        <div class="opponent-info">
          <h3>Opponent: {{ opponent }}</h3>
          <div class="score">Score: {{ scores[opponentId] || 0 }}</div>
        </div>
        <div class="player-info">
          <h3>You: {{ username }}</h3>
          <div class="score">Score: {{ scores[socket?.id] || 0 }}</div>
        </div>
      </div>

      <div class="round-result" v-if="roundWinner">
        {{ roundWinner === 'Tie' ? 'Round Tied!' : `${roundWinner} wins the round!` }}
      </div>

      <div class="play-area">
        <div v-if="lastPlayedCard" class="played-card">
          <div class="card" :class="cardClass(lastPlayedCard)">
            {{ lastPlayedCard.value }} {{ suitSymbol(lastPlayedCard.suit) }}
          </div>
          <div class="player-tag">Played by: {{ lastPlayedBy }}</div>
        </div>
      </div>

      <div class="player-hand">
        <h3>Your Cards:</h3>
        <div class="cards">
          <div 
            v-for="(card, index) in playerHand" 
            :key="index"
            class="card"
            :class="[cardClass(card), { 'playable': isMyTurn }]"
            @click="playCard(index)"
          >
            {{ card.value }} {{ suitSymbol(card.suit) }}
          </div>
        </div>
      </div>

      <div class="game-status">
        <div v-if="gameOver">
          Game Over! {{ gameWinner }} wins!
        </div>
        <div v-else>
          {{ isMyTurn ? "Your turn!" : "Opponent's turn" }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';

export default {
  data() {
    return {
      socket: null,
      username: '',
      isInGame: false,
      gameId: null,
      playerHand: [],
      opponent: null,
      opponentId: null,
      currentTurn: null,
      lastPlayedCard: null,
      lastPlayedBy: null,
      scores: {},
      roundWinner: null,
      gameOver: false,
      gameWinner: null
    }
  },
  computed: {
    isMyTurn() {
      return this.socket && this.currentTurn === this.socket.id;
    }
  },
  methods: {
    joinGame() {
      if (this.username.trim()) {
        this.socket.emit('join_game', this.username);
      }
    },
    playCard(index) {
      if (this.isMyTurn) {
        this.socket.emit('play_card', {
          gameId: this.gameId,
          cardIndex: index
        });
      }
    },
    suitSymbol(suit) {
      const symbols = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
      };
      return symbols[suit];
    },
    cardClass(card) {
      return {
        'red': card.suit === 'hearts' || card.suit === 'diamonds',
        'black': card.suit === 'clubs' || card.suit === 'spades'
      };
    },
    setupSocket() {
      this.socket = io('http://localhost:3005', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

   // Add connection event handlers
   this.socket.on('connect', () => {
    console.log('Connected to server');
  });

  this.socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  this.socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

      this.socket.on('game_start', (data) => {
        this.isInGame = true;
        this.gameId = data.gameId;
        this.playerHand = data.hand;
        this.currentTurn = data.currentTurn;
        this.opponent = data.opponent;
        this.scores = data.scores;
        const otherPlayer = data.players?.find(p => p.id !== this.socket.id);
        if (otherPlayer) {
          this.opponentId = otherPlayer.id;
        }
      });

      this.socket.on('card_played', (data) => {
        this.lastPlayedCard = data.card;
        this.lastPlayedBy = data.player;
        this.currentTurn = data.nextTurn;
      });

      this.socket.on('round_result', (data) => {
        this.roundWinner = data.winner;
        this.scores = data.scores;
        setTimeout(() => {
          this.roundWinner = null;
        }, 2000);
      });

      this.socket.on('game_over', (data) => {
        if (data.reason) {
          alert(data.reason);
          this.resetGame();
        } else {
          this.gameOver = true;
          this.gameWinner = data.winner;
          this.scores = data.scores;
        }
      });
    },
    resetGame() {
      this.isInGame = false;
      this.gameId = null;
      this.playerHand = [];
      this.opponent = null;
      this.opponentId = null;
      this.currentTurn = null;
      this.lastPlayedCard = null;
      this.lastPlayedBy = null;
      this.scores = {};
      this.roundWinner = null;
      this.gameOver = false;
      this.gameWinner = null;
    }
  },
  mounted() {
    this.setupSocket();
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
</script>

<style scoped>
.game-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.login-screen {
  text-align: center;
  margin-top: 100px;
}

.game-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.game-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.score {
  font-size: 18px;
  color: #666;
}

.round-result {
  text-align: center;
  font-size: 24px;
  color: #2c3e50;
  font-weight: bold;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 8px;
  animation: fadeIn 0.5s ease-in;
}

.cards {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.card {
  width: 100px;
  height: 150px;
  border: 2px solid #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  background: white;
  cursor: pointer;
}

.card.playable:hover {
  transform: translateY(-10px);
  transition: transform 0.2s;
}

.red {
  color: red;
}

.black {
  color: black;
}

.play-area {
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed #ccc;
  margin: 20px 0;
}

.played-card {
  text-align: center;
}

.player-tag {
  margin-top: 10px;
  font-size: 14px;
  color: #666;
}

.game-status {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #333;
}
</style>

