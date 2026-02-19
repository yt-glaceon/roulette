import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// アクセストークンストア（本番環境では Redis などを使用）
const accessTokens = new Map();

// Discord Bot クライアントの初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Bot ログイン
client.login(process.env.DISCORD_BOT_TOKEN);

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  // スラッシュコマンドを登録
  await registerSlashCommands();
});

/**
 * スラッシュコマンドを登録
 */
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('roulette')
      .setDescription('ボイスルーレットの URL を生成します')
      .toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ スラッシュコマンドの登録完了');
  } catch (error) {
    console.error('スラッシュコマンドの登録エラー:', error);
  }
}

/**
 * スラッシュコマンドの処理
 */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'roulette') {
    try {
      const guildId = interaction.guildId;
      
      if (!guildId) {
        await interaction.reply({
          content: 'このコマンドはサーバー内でのみ使用できます。',
          ephemeral: true,
        });
        return;
      }

      // アクセストークンを生成
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 3600000; // 1時間有効

      // トークンを保存
      accessTokens.set(token, {
        guildId,
        userId: interaction.user.id,
        expiresAt,
      });

      // URL を生成
      const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const rouletteUrl = `${frontendUrl}?token=${token}&api_url=${backendUrl}`;

      await interaction.reply({
        content: `🎰 ボイスルーレットの URL を生成しました！\n\n${rouletteUrl}\n\n⏰ この URL は1時間有効です。`,
        ephemeral: true,
      });

      console.log(`[Roulette] トークン生成: ${token} (Guild: ${guildId}, User: ${interaction.user.tag})`);
    } catch (error) {
      console.error('スラッシュコマンド処理エラー:', error);
      await interaction.reply({
        content: 'エラーが発生しました。もう一度お試しください。',
        ephemeral: true,
      });
    }
  }
});

// 期限切れトークンを定期的に削除
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of accessTokens.entries()) {
    if (data.expiresAt < now) {
      accessTokens.delete(token);
      console.log(`[Roulette] 期限切れトークンを削除: ${token}`);
    }
  }
}, 60000); // 1分ごと

// CORS 設定
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET'],
}));

app.use(express.json());

/**
 * トークンを検証するミドルウェア
 */
function validateToken(req, res, next) {
  const token = req.query.token || req.headers['x-access-token'];

  if (!token) {
    return res.status(401).json({ error: 'アクセストークンが必要です' });
  }

  const tokenData = accessTokens.get(token);

  if (!tokenData) {
    return res.status(401).json({ error: '無効なトークンです' });
  }

  if (tokenData.expiresAt < Date.now()) {
    accessTokens.delete(token);
    return res.status(401).json({ error: 'トークンの有効期限が切れています' });
  }

  // リクエストにトークンデータを追加
  req.tokenData = tokenData;
  next();
}

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: client.user ? client.user.tag : 'not ready',
    guilds: client.guilds.cache.size,
  });
});

// トークン検証エンドポイント
app.get('/api/validate-token', validateToken, (req, res) => {
  res.json({
    valid: true,
    guildId: req.tokenData.guildId,
  });
});

// ギルド情報を取得（トークンで指定されたギルドのみ）
app.get('/api/guild', validateToken, async (req, res) => {
  try {
    const { guildId } = req.tokenData;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'サーバーが見つかりません' });
    }

    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
    });
  } catch (error) {
    console.error('Error fetching guild:', error);
    res.status(500).json({ error: 'Failed to fetch guild' });
  }
});

// 特定ギルドのボイスチャネル一覧を取得
app.get('/api/guild/channels', validateToken, async (req, res) => {
  try {
    const { guildId } = req.tokenData;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const voiceChannels = guild.channels.cache
      .filter(channel => channel.type === 2) // 2 = GUILD_VOICE
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        position: channel.position,
      }))
      .sort((a, b) => a.position - b.position);

    res.json(voiceChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// 特定ボイスチャネルのメンバー一覧を取得
app.get('/api/guild/channels/:channelId/members', validateToken, async (req, res) => {
  try {
    const { guildId } = req.tokenData;
    const { channelId } = req.params;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.type !== 2) {
      return res.status(400).json({ error: 'Channel is not a voice channel' });
    }

    const members = channel.members.map(member => ({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      avatar: member.user.displayAvatarURL(),
    }));

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
