import { Socket, Server } from "socket.io";
import { v4 } from "uuid";

const io = new Server(3003, {
    cors: {
        origin: "*",
    },
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
const foods: Map<string, Food> = new Map();
const users: Array<Socket> = [];
const board_width = 1000;
const board_height = 1000;

io.on("connect", (socket: Socket) => {

    socket.on("newPlayer", (uuid: string, name: string, color: string) => {
        const playerx = Math.random() * board_width;
        const playery = Math.random() * board_height;
        players.set(uuid, { x: playerx, y: playery, score: 1, name: name, color: color });
        console.log("new player : " + uuid + " " + name + " " + color);
        console.log(players);
        socket.emit("newPlayerPosition", Math.random() * board_width, Math.random() * board_height);
        users.push(socket);
    });

    socket.on("move", (uuid: string, x: number, y: number) => {
        const player = players.get(uuid);
        if (player) {
            player.x = x;
            player.y = y;
        }
    });

    socket.on("eatFood", (uuid: string, foodId: string) => {
        const player = players.get(uuid);
        const food = foods.get(foodId);
        if (player !== undefined && food !== undefined) {
            player.score += 1;
            foods.delete(foodId);
            console.log("eat food : " + uuid + " " + foodId);
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
        console.log("leave : " + uuid);
    });

    socket.on("disconnect", () => {
        console.log("disconnect");
        const index = users.indexOf(socket);
        if (index > -1) {
            users.splice(index, 1);
        }
    });

});

setInterval(() => {
    for (const user of users) {
        user.emit("updatePlayers", Array.from(players.entries()));
    }
}, 1000 / 60);

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
