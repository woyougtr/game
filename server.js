const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储房间数据
const rooms = {};

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket 处理
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'join':
                handleJoin(ws, data);
                break;
            case 'updateScore':
                handleUpdateScore(ws, data);
                break;
            case 'settlement':
                handleSettlement(ws, data);
                break;
            case 'resetGame':
                handleResetGame(ws, data);
                break;
            case 'leave':
                handleLeave(ws, data);
                break;
        }
    });
});

// 加入房间
function handleJoin(ws, data) {
    const { roomCode, playerName } = data;
    
    if (!rooms[roomCode]) {
        rooms[roomCode] = {};
    }
    
    // 检查玩家是否已存在
    if (rooms[roomCode][playerName]) {
        ws.send(JSON.stringify({ type: 'error', message: '名字已被使用' }));
        return;
    }
    
    // 添加玩家
    rooms[roomCode][playerName] = {
        score: 0,
        ws: ws
    };
    
    ws.roomCode = roomCode;
    ws.playerName = playerName;
    
    // 广播玩家列表给房间内所有人
    broadcastToRoom(roomCode, {
        type: 'roomPlayers',
        players: getPlayersInfo(roomCode)
    });
    
    // 广播新玩家加入
    broadcastToRoom(roomCode, {
        type: 'playerJoined',
        name: playerName
    }, ws);
}

// 更新分数
function handleUpdateScore(ws, data) {
    const { roomCode, playerName, targetPlayer, score } = data;
    
    if (!rooms[roomCode] || !rooms[roomCode][targetPlayer]) {
        return;
    }
    
    // 更新目标玩家分数
    rooms[roomCode][targetPlayer].score += score;
    
    // 广播分数更新
    broadcastToRoom(roomCode, {
        type: 'scoreUpdated',
        players: getPlayersInfo(roomCode)
    });
}

// 清算
function handleSettlement(ws, data) {
    const { roomCode } = data;
    
    if (!rooms[roomCode]) {
        return;
    }
    
    const settlement = calculateSettlement(rooms[roomCode]);
    
    ws.send(JSON.stringify({
        type: 'settlement',
        settlement: settlement
    }));
}

// 计算清算方案
function calculateSettlement(roomPlayers) {
    const players = Object.entries(roomPlayers).map(([name, data]) => ({
        name,
        score: data.score
    }));
    
    const settlement = [];
    
    // 按分数排序
    players.sort((a, b) => a.score - b.score);
    
    // 债务人（负分）
    const debtors = players.filter(p => p.score < 0);
    // 债权人（正分）
    const creditors = players.filter(p => p.score > 0);
    
    let i = 0, j = 0;
    
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        
        const amount = Math.min(-debtor.score, creditor.score);
        
        if (amount > 0) {
            settlement.push({
                from: debtor.name,
                to: creditor.name,
                amount: amount
            });
        }
        
        debtor.score += amount;
        creditor.score -= amount;
        
        if (debtor.score === 0) i++;
        if (creditor.score === 0) j++;
    }
    
    return settlement;
}

// 重新开始
function handleResetGame(ws, data) {
    const { roomCode } = data;
    
    if (!rooms[roomCode]) {
        return;
    }
    
    // 重置所有玩家分数
    Object.keys(rooms[roomCode]).forEach(name => {
        rooms[roomCode][name].score = 0;
    });
    
    // 广播重置
    broadcastToRoom(roomCode, {
        type: 'gameReset',
        players: getPlayersInfo(roomCode)
    });
}

// 离开房间
function handleLeave(ws, data) {
    const { roomCode, playerName } = data;
    
    if (rooms[roomCode] && rooms[roomCode][playerName]) {
        delete rooms[roomCode][playerName];
        
        // 广播玩家离开
        broadcastToRoom(roomCode, {
            type: 'playerLeft',
            name: playerName
        });
        
        // 更新玩家列表
        broadcastToRoom(roomCode, {
            type: 'roomPlayers',
            players: getPlayersInfo(roomCode)
        });
        
        // 如果房间空了，删除房间
        if (Object.keys(rooms[roomCode]).length === 0) {
            delete rooms[roomCode];
        }
    }
}

// 获取房间玩家信息（不包含 WebSocket 对象）
function getPlayersInfo(roomCode) {
    if (!rooms[roomCode]) return {};
    
    const players = {};
    Object.entries(rooms[roomCode]).forEach(([name, data]) => {
        players[name] = { score: data.score };
    });
    return players;
}

// 广播给房间内所有人
function broadcastToRoom(roomCode, data, excludeWs = null) {
    if (!rooms[roomCode]) return;
    
    Object.values(rooms[roomCode]).forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(data));
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
