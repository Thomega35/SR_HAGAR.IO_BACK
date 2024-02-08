import { Socket, Server } from "socket.io";
import { v4 } from "uuid";

const io = new Server(3003, {
    cors: {
        origin: "*",
    },
    transports: ["websocket"],
});


interface PlayerObj {
    x: number;
    y: number;
    score: number;
    name: string;
    color: string;
}

interface Food {
    x: number;
    y: number;
}


// map player : id -> player
const players: Map<string, PlayerObj> = new Map();
const countRequestPlayers: Map<string, number> = new Map();
const socketToPlayer: Map<string, string> = new Map();
const foods: Map<string, Food> = new Map();
const maliciousfood: Map<string, Food> = new Map();
let users: Array<Socket> = [];
const board_width = 1000;
const board_height = 1000;

io.on("connect", (socket: Socket) => {

    socket.on("newPlayer", (uuid: string, name: string, color: string) => {
        const playerx = Math.random() * board_width;
        const playery = Math.random() * board_height;
        players.set(uuid, { x: playerx, y: playery, score: 1, name: name, color: color });
        socketToPlayer.set(socket.id, uuid);
        console.log("new player : " + uuid + " " + name + " " + color);
        socket.emit("newPlayerPosition", playerx, playery);
        users.push(socket);
    });

    socket.on("move", (uuid: string, x: number, y: number) => {
        const player = players.get(uuid);
        if (player) {
            if (Math.abs(player.x - x) < 3 || Math.abs(player.y - y) < 2) {
                player.x = x;
                if (player.x < 0) player.x = 0;
                if (player.x > board_width) player.x = board_width;
                player.y = y;
                if (player.y < 0) player.y = 0;
                if (player.y > board_height) player.y = board_height;
            }
        }
        countRequestPlayers.set(socket.id, (countRequestPlayers.get(socket.id)??0) + 1);
    });

    socket.on("eatFood", (uuid: string, foodId: string) => {
        const player = players.get(uuid);
        const food = foods.get(foodId);
        if (player !== undefined && food !== undefined && Math.sqrt((player.x - food.x) ** 2 + (player.y - food.y) ** 2) < (scoreToSize(player.score)+4)){
            player.score += 1;
            foods.delete(foodId);
            console.log("eat food : " + uuid + " " + foodId);
        }
    });

    socket.on("eatMaliciousFood", (uuid: string, foodId: string) => {
        const player = players.get(uuid);
        const food = maliciousfood.get(foodId);
        if (player !== undefined && food !== undefined) {
            player.score = player.score / 2;
            maliciousfood.delete(foodId);
            console.log("eat malicious food : " + uuid + " " + foodId);
        }
    });

    socket.on("eatPlayer", (uuid: string, playerId: string) => {
        const player = players.get(uuid);
        const player2 = players.get(playerId);
        if (player !== undefined && player2 !== undefined && player.score > player2.score) {
            player.score += player2.score;
            players.delete(playerId);
            console.log("eat player : " + uuid + " " + playerId);
        }
    });

    socket.on("Leave", (uuid: string) => {
        players.delete(uuid);
        socketToPlayer.delete(socket.id);
        players.delete(uuid);
        socket.disconnect();
        console.log("leave : " + uuid);
    });

    socket.on("disconnect", () => {
        players.delete(socketToPlayer.get(socket.id)??'');
        socketToPlayer.delete(socket.id);
        const index = users.indexOf(socket);
        if (index > -1) {
            users.splice(index, 1);
        }
        console.log("disconnect");
    });

    // on error
    socket.on("error", (err) => {
        players.delete(socketToPlayer.get(socket.id)??'');
        socketToPlayer.delete(socket.id);
        const index = users.indexOf(socket);
        if (index > -1) {
            users.splice(index, 1);
        }
        console.log("error : " + err);
    });

});

// Update players position
setInterval(() => {
    for (const user of users) {
        user.emit("updatePlayers", Array.from(players.entries()));
    }
}, 1000 / 60);

// Update food position
setInterval(() => {
    if (foods.size < 30) {
        if (Math.random() < 0.1) {
            const foodx = Math.random() * board_width;
            const foody = Math.random() * board_height;
            const food = { x: foodx, y: foody };
            foods.set(v4(), food);
        }
    }
    
    for (const user of users) {
        user.emit("updateFood", Array.from(foods.entries()));
    }
}, 1000 / 60);

// Update malicious food position
setInterval(() => {
    if (maliciousfood.size < 2) {
        if (Math.random() < 0.01) {
            const foodx = Math.random() * board_width;
            const foody = Math.random() * board_height;
            const food = { x: foodx, y: foody };
            maliciousfood.set(v4(), food);
        }
    }
    
    for (const user of users) {
        user.emit("updateMaliciousFood", Array.from(maliciousfood.entries()));
    }
}, 1000 / 60);

// Ban player if he sends too many requests
setInterval(() => {
    for (const [key, value] of countRequestPlayers) {
        // console.log(key + " " + value);
        if (value > 800) {
            const toban = users.find((user) => user.id === key);
            users = users.filter((user) => user.id !== key);
            players.delete(socketToPlayer.get(toban?.id??'')??'');
            socketToPlayer.delete(toban?.id??'');
            toban?.disconnect();
            console.log("ban : " + key);
        }
    }
    for (const user of users) {
        user.emit("updatePlayers", Array.from(players.entries()));
        countRequestPlayers.clear();
    }
}, 3000);

export function scoreToSize(score: number) {
    return Math.sqrt(score * 50 / Math.PI) + 3;
}

export function distanceBetween(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}