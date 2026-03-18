// 游戏记分 API - Cloudflare Workers 版本
const rooms = {};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    
    // CORS 头
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 预检请求
    if (method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    try {
      let body = null;
      if (method === 'POST') {
        const text = await request.text();
        body = JSON.parse(text || '{}');
      }

      // 加入房间 - POST /api/join
      if (url.pathname === '/api/join' && method === 'POST') {
        const { roomCode, playerName, deviceId } = body || {};
        
        if (!roomCode || !playerName) {
          return new Response(JSON.stringify({ error: '缺少参数' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
        
        if (!rooms[roomCode]) {
          rooms[roomCode] = { players: {}, history: [] };
        }
        
        // 检查设备ID是否已存在
        let existingPlayer = null;
        for (const [name, data] of Object.entries(rooms[roomCode].players)) {
          if (data.deviceId === deviceId) {
            existingPlayer = name;
            break;
          }
        }
        
        if (existingPlayer && existingPlayer !== playerName) {
          rooms[roomCode].players[playerName] = { 
            score: rooms[roomCode].players[existingPlayer].score,
            deviceId 
          };
          delete rooms[roomCode].players[existingPlayer];
        } else if (existingPlayer && existingPlayer === playerName) {
          // 同一个玩家刷新
        } else if (rooms[roomCode].players[playerName]) {
          return new Response(JSON.stringify({ error: '名字已被使用' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        } else {
          rooms[roomCode].players[playerName] = { score: 0, deviceId };
        }
        
        return new Response(JSON.stringify({ 
          players: sanitizePlayers(rooms[roomCode].players),
          history: rooms[roomCode].history || []
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      
      // 更新分数 - POST /api/score
      if (url.pathname === '/api/score' && method === 'POST') {
        const { roomCode, playerName, targetPlayer, score } = body || {};
        
        if (!rooms[roomCode] || !rooms[roomCode].players[targetPlayer]) {
          return new Response(JSON.stringify({ error: '房间或玩家不存在' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
        
        rooms[roomCode].players[targetPlayer].score += score;
        if (rooms[roomCode].players[playerName]) {
          rooms[roomCode].players[playerName].score -= score;
        }
        
        if (playerName !== targetPlayer) {
          rooms[roomCode].history.unshift({
            from: playerName,
            to: targetPlayer,
            score: score,
            time: Date.now()
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          players: sanitizePlayers(rooms[roomCode].players),
          history: rooms[roomCode].history
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      
      // 重置游戏 - POST /api/reset
      if (url.pathname === '/api/reset' && method === 'POST') {
        const { roomCode } = body || {};
        
        if (rooms[roomCode]) {
          Object.keys(rooms[roomCode].players).forEach(name => {
            rooms[roomCode].players[name].score = 0;
          });
          rooms[roomCode].history = [];
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          players: sanitizePlayers(rooms[roomCode]?.players || {}),
          history: []
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      
      // 获取房间信息 - GET /api/room/:code
      if (url.pathname.startsWith('/api/room/') && method === 'GET') {
        const roomCode = url.pathname.replace('/api/room/', '');
        return new Response(JSON.stringify({ 
          players: sanitizePlayers(rooms[roomCode]?.players || {}),
          history: rooms[roomCode]?.history || []
        }), { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      
      // 获取清算方案 - GET /api/settlement/:code
      if (url.pathname.startsWith('/api/settlement/') && method === 'GET') {
        const roomCode = url.pathname.replace('/api/settlement/', '');
        const settlement = calculateSettlement(rooms[roomCode]?.players || {});
        return new Response(JSON.stringify({ settlement }), { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('API Error:', e);
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }
};

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
