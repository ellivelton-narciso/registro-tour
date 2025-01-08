const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 
const axios = require('axios');
const connection = require('./db/connection');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/submit', (req, res) => {
  const { name, email, pokemonList } = req.body;

  if (!name || !email || !pokemonList || pokemonList.length !== 10) {
    return res.status(400).json({
      error: 'Dados inválidos. Certifique-se de preencher todos os campos e selecionar exatamente 10 Pokémon.',
    });
  }

  const query = 'INSERT INTO trainers (name, email, pokemon_list) VALUES (?, ?, ?)';
  const values = [name, email, JSON.stringify(pokemonList)];

  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(query, values, async (err, results) => {
      conn.release(); 

      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          if (err.message.includes('name')) {
            return res.status(400).json({
              error: 'O nome de usuário já está em uso. Caso já tenha se cadastrado e queira editar, fale com Vako/Elli para remover teu cadastro.',
            });
          } else if (err.message.includes('email')) {
            return res.status(400).json({
              error: 'O contato já está em uso. Caso já tenha se cadastrado e queira editar, fale com Vako/Elli para remover teu cadastro.',
            });
          }
        }
        console.error('Erro ao salvar dados no banco:', err);
        return res.status(500).json({ error: 'Erro ao salvar dados no banco de dados.' });
      }


      try {
        const webhookUrl = process.env.WEBHOOK_DISCORD;
        const discordMessage = {
          content: `🎉 **Novo Participante no Torneio!**\n🧑 Boa sorte ${name} !`,
        };

        await axios.post(webhookUrl, discordMessage);

        console.log(`Notificação enviada ao Discord para o participante: ${name}`);
      } catch (discordErr) {
        console.error('Erro ao enviar notificação ao Discord:', discordErr);
      }

      return res.status(200).json({ message: 'Dados enviados com sucesso!' });
    });
  });
});





const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
