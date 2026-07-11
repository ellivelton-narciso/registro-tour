const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { resolveTeamImagePath } = require('./championsUpload');

async function sendTeamImageToDiscord(webhookUrl, playerName, imagePath) {
  const ext = path.extname(imagePath).toLowerCase() || '.png';
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    content: `**${playerName}**`
  }));
  form.append('files[0]', fs.createReadStream(imagePath), {
    filename: `${playerName.replace(/[^\w.-]/g, '_')}${ext}`,
    contentType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  });

  await axios.post(webhookUrl, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
}

async function sendChampionsTeamsToDiscord(client, tournamentId, webhookUrl) {
  const result = await client.query(
    `SELECT p.name AS player_name, pa.team_image
     FROM participants pa
     JOIN players p ON pa.players_id = p.id
     WHERE pa.tournaments_id = $1
       AND pa.team_image IS NOT NULL
     ORDER BY p.name`,
    [tournamentId]
  );

  if (result.rows.length === 0) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const imagePath = resolveTeamImagePath(row.team_image);
    if (!imagePath) {
      skipped += 1;
      continue;
    }
    await sendTeamImageToDiscord(webhookUrl, row.player_name, imagePath);
    sent += 1;
    await new Promise(r => setTimeout(r, 500));
  }

  return { sent, skipped };
}

module.exports = {
  sendChampionsTeamsToDiscord,
  sendTeamImageToDiscord
};
