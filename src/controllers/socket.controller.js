'use strict';

module.exports = function (w, app, io) {

    let express = require('express');
    app.use(express.static('static'));
    io.on('connect', (socket) => {
        if (!socket.session) {
            socket.disconnect();
            return;
        }
        let game = w.services.game;
        if (!game.images.length) {
            game.refreshImages();
        }
        socket.user = {'id': socket.session.session.userId, 'username': socket.session.user.username, 'hand': [], 'ready': false, 'money': 100, 'count': 0, 'bet': 5, 'active': true, 'gone': false, 'turn': false, 'double': false, 'hit':false, 'image': game.images.splice(game.randomNumber(15), 1), 'wins':0,'losses':0, 'debt': 0};
        socket.join('user:' + socket.session.user.id);

        console.log(`${socket.user.username} connected.`);

        io.emit('message', `${socket.user.username} connected.`);
        if (!game.players.length) {
            game.resetGame();
        }
        // if round already started
        if (!game.activePlay) {
            if (game.players.length < game.maxPlayers) {
                game.sit(socket);
            } else {
                game.sendToWaitlist(socket);
            }
        } else {
            socket.emit('alert', {'type':'WARNING','message': `Round in play. Please wait until a new round begins.`});
            game.waitlist.push(socket);
            socket.emit('buttons', [
                {'button':'ready', 'condition':false}]);
        }

        socket.on('message', function (message) {
            io.emit('message', `${socket.user.username}: ${message}`);
        });

        socket.on('readyCheck', function (data) {
            if (socket.user.money < data) {
                socket.emit('alert', {'type':'DANGER','message': `You don't have enough money.`});
            } else {
                game.sendUpdate();
                socket.user.bet = data;
                socket.emit('buttons', [{'button':'ready', 'condition':false}]);
                socket.user.ready = true;
                game.readyCheck();
            }
        });

        socket.on('hit', function () {
            if (socket.user.turn) {
                // add card to user's hand
                game.playerHits(socket);
                socket.user.hit = true;
            }
        });

        socket.on('stay', function () {
            if (socket.user.turn) {
                // pass turn to next player
                socket.user.gone = true;
                socket.user.turn = false;
                game.nextPlayer();
            }
        });

        socket.on('double', function () {
            if (socket.user.turn) {
                // double bet, deal 1 card, pass turn to next player
                game.double(socket);
            }
        });

        socket.on('split', function () {
            if (socket.user.turn) {
                // figure out later
            }
        });

        socket.on('buyIn', function (amount) {
            game.buyIn(socket);
        });

        socket.on('disconnect', function () {
            for ( let i = 0; i < game.players.length; i++ ) {
                let player = game.players[i];
                if (player.user.username === socket.user.username) {
                    game.players.splice(i, 1);
                    if (game.activePlay) {
                        game.nextPlayer();
                    } else {
                        game.readyCheck();
                    }
                }
            }
            for ( let i = 0; i < game.waitlist.length; i++ ) {
                let player = game.waitlist[i];
                if (player.user.username === socket.user.username) {
                    game.waitlist.splice(i, 1);
                    if (game.activePlay) {
                        game.nextPlayer();
                    } else {
                        game.readyCheck();
                    }
                }
            }
            game.sendUpdate();
            console.log(`${socket.user.username} disconnected.`);
            io.emit('message', `${socket.user.username} disconnected.`);
            socket.disconnect();
        });
    });
};
