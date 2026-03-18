// 游戏记分 API
const rooms = {};

export default async function handler(req, res) {
    const { method } = req;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 加入房间 - POST /api/join
        if (req.url === '/api/join' && method === 'POST') {
            const { roomCode, playerName } = req.body || {};
            
            if (!roomCode || !playerName) {
                return res.status(400).json({ error: '缺少参数' });
            }
            
            if (!rooms[roomCode]) {
                rooms[roomCode] = { players: {}, history: [] };
            }
            
            if (rooms[roomCode].players[playerName]) {
                return res.status(400).json({ error: '名字已被使用' });
            }
            
            rooms[roomCode].players[playerName] = { score: 0 };
            
            return res.json({ 
                players: sanitizePlayers(rooms[roomCode].players),
                history: rooms[roomCode].history || []
            });
        }
        
        // 更新分数 - POST /api/score
        if (req.url === '/api/score' && method === 'POST') {
            const { roomCode, playerName, targetPlayer, score } = req.body || {};
            
            if (!rooms[roomCode] || !rooms[roomCode].players[targetPlayer]) {
                return res.status(400).json({ error: '房间或玩家不存在' });
            }
            
            // 目标玩家加分
            rooms[roomCode].players[targetPlayer].score += score;
            // 记分者扣分
            if (rooms[roomCode].players[playerName]) {
                rooms[roomCode].players[playerName].score -= score;
            }
            
            // 只记录给分那一条（不记录自己给自己扣分）
            if (playerName !== targetPlayer) {
                rooms[roomCode].history.unshift({
                    from: playerName,
                    to: targetPlayer,
                    score: score,
                    time: Date.now()
                });
            }
            
            return res.json({ 
                success: true, 
                players: sanitizePlayers(rooms[roomCode].players),
                history: rooms[roomCode].history
            });
        }
        
        // 重置游戏 - POST /api/reset
        if (req.url === '/api/reset' && method === 'POST') {
            const { roomCode } = req.body || {};
            
            if (rooms[roomCode]) {
                Object.keys(rooms[roomCode].players).forEach(name => {
                    rooms[roomCode].players[name].score = 0;
                });
                rooms[roomCode].history = [];
            }
            
            return res.json({ 
                success: true, 
                players: sanitizePlayers(rooms[roomCode]?.players || {}),
                history: []
            });
        }
        
        // 获取房间信息 - GET /api/room/:code
        if (req.url && req.url.startsWith('/api/room/') && method === 'GET') {
            const roomCode = req.url.replace('/api/room/', '');
            return res.json({ 
                players: sanitizePlayers(rooms[roomCode]?.players || {}),
                history: rooms[roomCode]?.history || []
            });
        }
        
        // 获取清算方案 - GET /api/settlement/:code
        if (req.url && req.url.startsWith('/api/settlement/') && method === 'GET') {
            const roomCode = req.url.replace('/api/settlement/', '');
            const settlement = calculateSettlement(rooms[roomCode]?.players || {});
            return res.json({ settlement });
        }
        
        return res.status(404).json({ error: 'Not found' });
    } catch (e) {
        console.error('API Error:', e);
        return res.status(500).json({ error: 'Server error' });
    }
}

function sanitizePlayers(roomPlayers) {
    const result = {};
    Object.entries(roomPlayers || {}).forEach(([name, data]) => {
        result[name] = { score: data.score };
    });
    return result;
}

function calculateSettlement(roomPlayers) {
    const players = Object.entries(roomPlayers || {}).map(([name, data]) => ({
        name,
        score: data.score
    }));
    
    const settlement = [];
    players.sort((a, b) => a.score - b.score);
    
    const debtors = players.filter(p => p.score < 0);
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
