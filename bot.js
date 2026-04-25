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

// Regex améliorée (gère plus de cas)
const phRegex = /pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9-_]+)/i;

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

client.on('messageCreate', async (message) => {
  try {
    if (!message?.content) return;
    if (message.author?.bot) return;

    const match = message.content.match(phRegex);
    if (!match) return;

    const id = match[1];
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