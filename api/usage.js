module.exports = async function handler(req, res) {
  const apiKey = 'sk-cp-P9Jg14bAw1BX8H0Xvuq4QfsSB0TRxMJvAlDqHsR5oUqDMtqE18wqAZgeufSsLFkpNqCYXqDjnuVV_YvORCngopWCElo-82rjkLhWyX5rOYHq6VydO-fwGKM';
  
  try {
    const response = await fetch('https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
