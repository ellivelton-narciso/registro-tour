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

  if (!name || !email || !pokemonList) {
    return res.status(400).json({
      error: 'Dados inválidos. Certifique-se de preencher todos os campos.',
    });
  }

  const configQuery = 'SELECT qtdEscolha, enviarDiscord, hook FROM config LIMIT 1';

  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(configQuery, (err, configResults) => {
      if (err) {
        conn.release();
        console.error('Erro ao buscar configuração no banco:', err);
        return res.status(500).json({ error: 'Erro ao buscar configuração do banco.' });
      }

      if (configResults.length === 0) {
        conn.release();
        return res.status(500).json({ error: 'Configuração não encontrada.' });
      }

      const { qtdEscolha, enviarDiscord, hook } = configResults[0];

      if (pokemonList.length !== qtdEscolha) {
        conn.release();
        return res.status(400).json({
          error: `Dados inválidos. Certifique-se de selecionar exatamente ${qtdEscolha} Pokémon.`,
        });
      }

      const insertQuery = 'INSERT INTO trainers (name, email, pokemon_list) VALUES (?, ?, ?)';
      const values = [name, email, JSON.stringify(pokemonList)];

      conn.query(insertQuery, values, async (err, results) => {
        if (err) {
          conn.release();

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

        if (enviarDiscord && hook) {
          const webhookUrl = hook;
          const discordMessage = {
            content: `🎉 **Novo Participante no Torneio!**\n🧑 Boa sorte ${name} !`,
          };

          try {
            await axios.post(webhookUrl, discordMessage);
            console.log(`Notificação enviada ao Discord para o participante: ${name}`);
          } catch (discordErr) {
            console.error('Erro ao enviar notificação ao Discord:', discordErr);
          }
        } else {
          console.log('Configuração de webhook não encontrada ou desabilitada.');
        }

        conn.release();
        return res.status(200).json({ message: 'Dados enviados com sucesso!' });
      });
    });
  });
});

app.get('/getConfig', (req, res) => {
  const query = 'SELECT * FROM config LIMIT 1';

  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(query, (err, results) => {
      conn.release();

      if (err) {
        console.error('Erro ao buscar dados do banco:', err);
        return res.status(500).json({ error: 'Erro ao buscar dados do banco de dados.' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Nenhuma configuração encontrada.' });
      }

      const config = results[0];

      try {
        config.listaLimitado = JSON.parse(config.listaLimitado || '[]');
        config.listaBanido = JSON.parse(config.listaBanido || '[]');
      } catch (parseErr) {
        console.error('Erro ao analisar campos JSON:', parseErr);
        return res.status(500).json({ error: 'Erro ao processar dados da configuração.' });
      }

      return res.status(200).json(config);
    });
  });
});

app.post('/updateConfig', (req, res) => {
  const {
    titulo,
    titulo2,
    gen,
    sprites,
    qtdLimitado,
    qtdEscolha,
    hook,
    enviarDiscord,
    listaLimitado,
    listaBanido,
    encerrado
  } = req.body;

  // Validar os dados recebidos
  if (!titulo || !gen || !sprites || !qtdLimitado) {
    return res.status(400).json({ error: 'Dados inválidos. Verifique os campos obrigatórios.' });
  }

  const query = `UPDATE config SET 
    titulo = ?, 
    titulo2 = ?, 
    gen = ?, 
    sprites = ?, 
    qtdLimitado = ?, 
    hook = ?, 
    enviarDiscord = ?, 
    listaLimitado = ?, 
    listaBanido = ?,
    encerrado = ?
    WHERE id = 1`;

  const values = [
    titulo,
    titulo2 || '',
    gen,
    sprites,
    qtdLimitado,
    qtdEscolha,
    hook ? hook : '',
    enviarDiscord ? 1 : 0,
    JSON.stringify(listaLimitado || []),
    JSON.stringify(listaBanido || []),
    encerrado ? 1 : 0
  ];

  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(query, values, (err, results) => {
      conn.release();

      if (err) {
        console.error('Erro ao atualizar configurações no banco:', err);
        return res.status(500).json({ error: 'Erro ao atualizar configurações no banco de dados.' });
      }

      return res.status(200).json({ message: 'Configurações atualizadas com sucesso!' });
    });
  });
});

app.post('/login', (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const query = 'SELECT * FROM usuarios WHERE user = ? LIMIT 1';
  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(query, [user], (err, results) => {
      conn.release();

      if (err) {
        console.error('Erro ao consultar usuário no banco:', err);
        return res.status(500).json({ error: 'Erro ao consultar usuário no banco de dados.' });
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'Usuário incorreto.' });
      }

      const storedPassword = results[0].password;

      if (password === storedPassword) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
    });
  });
});

app.get('/getTrainers', (req, res) => {
  const query = 'SELECT * FROM trainers';

  connection.getConnection((err, conn) => {
    if (err) {
      console.error('Erro ao obter conexão do pool:', err);
      return res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
    }

    conn.query(query, (err, results) => {
      conn.release();

      if (err) {
        console.error('Erro ao consultar dados no banco:', err);
        return res.status(500).json({ error: 'Erro ao consultar dados no banco de dados.' });
      }

      const trainers = results.map(trainer => {
        let pokemonList = [];
        try {
          pokemonList = JSON.parse(trainer.pokemon_list);
        } catch (parseErr) {
          console.error('Erro ao analisar lista de Pokémon:', parseErr);
        }
        return {
          id: trainer.id,
          name: trainer.name,
          email: trainer.email,
          pokemonList: pokemonList,
        };
      });

      return res.status(200).json(trainers);
    });
  });
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
