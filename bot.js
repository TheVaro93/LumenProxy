require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const token = (process.env.DISCORD_TOKEN || '').trim();
if (!token || token === 'PASTE_NEW_DISCORD_BOT_TOKEN_HERE') {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

// Discord bot tokens are JWT-like and usually contain 3 dot-separated parts.
if (!/^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}$/.test(token)) {
  console.error('Invalid DISCORD_TOKEN format in .env (expected 3 dot-separated parts)');
  process.exit(1);
}

const phPatterns = [
  /https?:\/\/(?:[\w-]+\.)?pornhub\.com\/view_video\.php\?(?:[^\s#]*&)?viewkey=([A-Za-z0-9_-]+)/i,
  /https?:\/\/(?:[\w-]+\.)?pornhub\.com\/embed\/([A-Za-z0-9_-]+)/i,
  /(?:[\w-]+\.)?pornhub\.com\/view_video\.php\?(?:[^\s#]*&)?viewkey=([A-Za-z0-9_-]+)/i,
  /(?:[\w-]+\.)?pornhub\.com\/embed\/([A-Za-z0-9_-]+)/i
];

function extractPhId(text) {
  for (const pattern of phPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.once('clientReady', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  try {
    await client.application.commands.set([
      {
        name: 'ping',
        description: 'Affiche la latence du bot.'
      }
    ]);
    console.log('Commande /ping enregistree.');
  } catch (err) {
    console.error('Erreur enregistrement commande /ping:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'ping') return;

    const reply = await interaction.reply({
      content: 'Pong... calcul de la latence en cours',
      fetchReply: true
    });

    const roundtrip = reply.createdTimestamp - interaction.createdTimestamp;
    const api = Math.round(client.ws.ping);

    await interaction.editReply(`Pong ! Latence: ${roundtrip}ms | API: ${api}ms`);
  } catch (err) {
    console.error('Erreur interactionCreate:', err);
  }
});

client.on('shardDisconnect', (event, shardId) => {
  console.error(`Shard ${shardId} deconnecte (code=${event.code}, reason=${event.reason || 'n/a'})`);
});

client.on('shardReconnecting', (shardId) => {
  console.warn(`Shard ${shardId} reconnexion en cours...`);
});

client.on('shardResume', (replayedEvents, shardId) => {
  console.log(`Shard ${shardId} reconnecte (events rejoues=${replayedEvents})`);
});

client.on('error', (err) => {
  console.error('Erreur client Discord:', err);
});

client.on('warn', (info) => {
  console.warn('Avertissement Discord:', info);
});

setInterval(() => {
  const ws = client.ws?.status;
  const ping = Math.round(client.ws?.ping ?? -1);
  console.log(`Heartbeat bot: wsStatus=${ws} ping=${ping}ms`);
}, 30000);

process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

client.on('messageCreate', async (message) => {
  try {
    if (!message?.content) return;
    if (message.author?.bot) return;

    const id = extractPhId(message.content);
    if (!id) return;
    const newUrl = `https://lumenproxy.github.io/watch/${encodeURIComponent(id)}`;

    const deleteOnReplace =
      (process.env.DELETE_ON_REPLACE || 'true').toLowerCase() === 'true';

    // ⚠️ vérifier permissions avant delete
    if (deleteOnReplace && message.deletable) {
      await message.delete().catch(() => {});
    }

    // ⚠️ éviter spam si déjà remplacé
    if (message.content.includes('lumenproxy.github.io')) return;

    await message.channel.send({
      content: `📺 ${newUrl}`
    });

  } catch (err) {
    console.error('Erreur messageCreate:', err);
  }
});

client.login(token).catch(err => {
  const msg = String(err?.message || '');
  if (msg.includes('Used disallowed intents')) {
    console.error('Erreur connexion bot: Message Content Intent non autorisé.');
  }

  console.error('Erreur connexion bot:', err);
  process.exit(1);
});