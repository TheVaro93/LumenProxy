require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in .env');
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

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
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
  console.error('Erreur connexion bot:', err);
  process.exit(1);
});