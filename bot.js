require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const token = (process.env.DISCORD_TOKEN || '').trim();
const debugMessages = (process.env.DEBUG_MESSAGES || 'false').toLowerCase() === 'true';
const proxyBaseUrlRaw = (process.env.PROXY_BASE_URL || 'https://thevaro93.github.io/LumenProxy/').trim();
if (!token || token === 'PASTE_NEW_DISCORD_BOT_TOKEN_HERE') {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

let proxyBaseUrl;
try {
  proxyBaseUrl = new URL(proxyBaseUrlRaw);
} catch {
  console.error('Invalid PROXY_BASE_URL in .env');
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

function buildProxyUrl(id) {
  const url = new URL(proxyBaseUrl.toString());
  url.searchParams.set('v', id);
  return url.toString();
}

function isProxyUrlAlreadyPresent(text) {
  const currentBase = `${proxyBaseUrl.origin}${proxyBaseUrl.pathname}`;
  return (
    text.includes(`${currentBase}?v=`) ||
    text.includes('https://lumenproxy.github.io/?v=')
  );
}

function buildMessageSearchText(message) {
  const chunks = [];

  if (typeof message?.content === 'string' && message.content.length > 0) {
    chunks.push(message.content);
  }

  if (Array.isArray(message?.embeds)) {
    for (const embed of message.embeds) {
      if (embed?.url) chunks.push(embed.url);
      if (embed?.description) chunks.push(embed.description);
      if (embed?.title) chunks.push(embed.title);
    }
  }

  if (message?.attachments?.size) {
    for (const attachment of message.attachments.values()) {
      if (attachment?.url) chunks.push(attachment.url);
      if (attachment?.proxyURL) chunks.push(attachment.proxyURL);
    }
  }

  return chunks.join('\n');
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

  client.user.setPresence({
    status: 'online',
    activities: [{ name: '/ping' }]
  });

  try {
    await client.application.commands.set([
      {
        name: 'ping',
        description: 'Affiche la latence du bot.'
      },
      {
        name: 'link',
        description: 'Ouvre un formulaire pour convertir un lien Pornhub.'
      }
    ]);
    console.log('Commandes /ping et /link enregistrees.');
  } catch (err) {
    console.error('Erreur enregistrement commandes slash:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ping') {
        await interaction.reply({
          content: 'Pong... calcul de la latence en cours'
        });

        const reply = await interaction.fetchReply();
        const roundtrip = reply.createdTimestamp - interaction.createdTimestamp;
        const api = Math.round(client.ws.ping);

        await interaction.editReply(`Pong ! Latence: ${roundtrip}ms | API: ${api}ms`);
        return;
      }

      if (interaction.commandName === 'link') {
        const modal = new ModalBuilder()
          .setCustomId('link_modal')
          .setTitle('Convertir un lien');

        const input = new TextInputBuilder()
          .setCustomId('link_input')
          .setLabel('Lien Pornhub')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://fr.pornhub.com/view_video.php?viewkey=...')
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'link_modal') {
      const rawUrl = interaction.fields.getTextInputValue('link_input');
      const id = extractPhId(rawUrl);

      if (!id) {
        await interaction.reply({
          content: 'Lien invalide. Envoie un lien Pornhub avec viewkey ou /embed/.',
          ephemeral: true
        });
        return;
      }

      const newUrl = buildProxyUrl(id);
      await interaction.reply({
        content: `📺 ${newUrl}`
      });
    }
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

async function handlePotentialLink(message) {
  if (!message) return;

  try {
    if (message.partial) {
      await message.fetch().catch(() => null);
    }

    if (message.author?.bot) return;

    const searchableText = buildMessageSearchText(message);

    if (debugMessages) {
      console.log(
        `[debug] message recu guild=${message.guildId || 'dm'} channel=${message.channelId} author=${message.author?.tag || message.author?.id || 'unknown'} contentLen=${message.content?.length || 0} embeds=${message.embeds?.length || 0} attachments=${message.attachments?.size || 0}`
      );
    }

    const id = extractPhId(searchableText);
    if (!id) return;
    const newUrl = buildProxyUrl(id);

    const deleteOnReplace =
      (process.env.DELETE_ON_REPLACE || 'true').toLowerCase() === 'true';

    // ⚠️ vérifier permissions avant delete
    if (deleteOnReplace && message.deletable) {
      await message.delete().catch(() => {});
    }

    // ⚠️ éviter spam si déjà remplacé
    if (isProxyUrlAlreadyPresent(searchableText)) return;

    await message.channel.send({
      content: `📺 ${newUrl}`
    });

  } catch (err) {
    console.error('Erreur traitement message:', err);
  }
}

client.on('messageCreate', async (message) => {
  await handlePotentialLink(message);
});

client.on('messageUpdate', async (_oldMessage, newMessage) => {
  await handlePotentialLink(newMessage);
});

client.login(token).catch(err => {
  const msg = String(err?.message || '');
  if (msg.includes('Used disallowed intents')) {
    console.error('Erreur connexion bot: Message Content Intent non autorisé.');
  }

  console.error('Erreur connexion bot:', err);
  process.exit(1);
});