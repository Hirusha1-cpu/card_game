// Server-side changes (app.js)
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());

const io = new Server(server, {
    cors: {
       // Allow both production and development origins
    origin: [
        "http://localhost:80",
        "http://localhost",
        "http://localhost:5173"  // Keep this for development if needed
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
});

// Game state
const games = new Map();
const players = new Map();

class Game {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.deck = this.createDeck();
        this.currentTurn = null;
        this.playedCards = []; // Track played cards
        this.roundWinner = null;
        this.scores = {}; // Track player scores
    }

    createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];

        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    dealCards() {
        return this.deck.splice(0, 5);
    }

    getCardValue(card) {
        const valueMap = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
            '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return valueMap[card.value];
    }

    determineRoundWinner() {
        if (this.playedCards.length !== 2) return null;

        const card1 = this.playedCards[0];
        const card2 = this.playedCards[1];

        const value1 = this.getCardValue(card1.card);
        const value2 = this.getCardValue(card2.card);

        if (value1 > value2) {
            this.scores[card1.playerId] = (this.scores[card1.playerId] || 0) + 1;
            return card1.playerId;
        } else if (value2 > value1) {
            this.scores[card2.playerId] = (this.scores[card2.playerId] || 0) + 1;
            return card2.playerId;
        }
        return null; // Tie
    }

    checkGameOver() {
        return this.players.every(player => player.hand.length === 0);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_game', (username) => {
        players.set(socket.id, username);

        let currentGame = null;
        for (let [id, game] of games) {
            if (game.players.length < 2) {
                currentGame = game;
                break;
            }
        }

        if (!currentGame) {
            currentGame = new Game(Date.now().toString());
            games.set(currentGame.id, currentGame);
        }

        currentGame.players.push({
            id: socket.id,
            username: username,
            hand: currentGame.dealCards()
        });
        currentGame.scores[socket.id] = 0;

        socket.join(currentGame.id);

        if (currentGame.players.length === 2) {
            currentGame.currentTurn = currentGame.players[0].id;
            
            currentGame.players.forEach(player => {
                io.to(player.id).emit('game_start', {
                    gameId: currentGame.id,
                    hand: player.hand,
                    currentTurn: currentGame.currentTurn,
                    opponent: currentGame.players.find(p => p.id !== player.id).username,
                    scores: currentGame.scores
                });
            });
        }
    });

    socket.on('play_card', ({ gameId, cardIndex }) => {
        const game = games.get(gameId);
        if (game && game.currentTurn === socket.id) {
            const player = game.players.find(p => p.id === socket.id);
            const card = player.hand.splice(cardIndex, 1)[0];

            game.playedCards.push({
                playerId: socket.id,
                playerName: players.get(socket.id),
                card: card
            });

            // Switch turns
            game.currentTurn = game.players.find(p => p.id !== socket.id).id;

            // Broadcast the play
            io.to(gameId).emit('card_played', {
                player: players.get(socket.id),
                card: card,
                nextTurn: game.currentTurn
            });

            // If both players have played, determine round winner
            if (game.playedCards.length === 2) {
                const winnerId = game.determineRoundWinner();
                
                io.to(gameId).emit('round_result', {
                    winner: winnerId ? players.get(winnerId) : 'Tie',
                    scores: game.scores
                });

                // Clear played cards for next round
                game.playedCards = [];

                // Check if game is over
                if (game.checkGameOver()) {
                    const finalScores = game.scores;
                    const winner = Object.entries(finalScores).reduce((a, b) => 
                        finalScores[a] > finalScores[b] ? a : b
                    );
                    
                    io.to(gameId).emit('game_over', {
                        winner: players.get(winner),
                        scores: finalScores
                    });
                    
                    games.delete(gameId);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players.delete(socket.id);
        
        games.forEach((game, gameId) => {
            if (game.players.some(p => p.id === socket.id)) {
                io.to(gameId).emit('game_over', { reason: 'Opponent disconnected' });
                games.delete(gameId);
            }
        });
    });
});

server.listen(3005, () => {
    console.log('Server running on port 3005');
});
