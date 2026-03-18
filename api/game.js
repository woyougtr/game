// 游戏记分 API
const rooms = {};

// 加入房间
export default async function handler(req, res) {
    const { method } = req;

    if (method === 'POST') {
        // 加入房间
        if (req.url === '/api/join') {
            const { roomCode, playerName } = req.body;
            
            if (!rooms[roomCode]) {
                rooms[roomCode] = {};
            }
            
            if (rooms[roomCode][playerName]) {
                return res.status(400).json({ error: '名字已被使用' });
            }
            
            rooms[roomCode][playerName] = { score: 0 };
            
            return res.json({ players: rooms[roomCode] });
        }
        
        // 更新分数
        if (req.url === '/api/score') {
            const { roomCode, playerName, targetPlayer, score } = req.body;
            
            if (!rooms[roomCode] || !rooms[roomCode][targetPlayer]) {
                return res.status(400).json({ error: '房间或玩家不存在' });
            }
            
            rooms[roomCode][targetPlayer].score += score;
            
            return res.json({ success: true, players: rooms[roomCode] });
        }
        
        // 重置游戏
        if (req.url === '/api/reset') {
            const { roomCode } = req.body;
            
            if (rooms[roomCode]) {
                Object.keys(rooms[roomCode]).forEach(name => {
                    rooms[roomCode][name].score = 0;
                });
            }
            
            return res.json({ success: true, players: rooms[roomCode] });
        }
    }
    
    // 获取房间信息
    if (method === 'GET') {
        const match = req.url.match(/\/api\/room\/(.+)/);
        if (match) {
            const roomCode = match[1];
            return res.json({ players: rooms[roomCode] || {} });
        }
        
        const settlementMatch = req.url.match(/\/api\/settlement\/(.+)/);
        if (settlementMatch) {
            const roomCode = settlementMatch[1];
            const settlement = calculateSettlement(rooms[roomCode] || {});
            return res.json({ settlement });
        }
    }
    
    res.status(404).json({ error: 'Not found' });
}

// 计算清算方案
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
