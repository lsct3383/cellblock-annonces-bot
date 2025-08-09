import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot annonces connecté en tant que ${client.user.tag}`);
});

const ANNOUNCES_CHANNEL_ID = process.env.ANNOUNCES_CHANNEL_ID;

client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot) return;
    if (msg.channel.id !== ANNOUNCES_CHANNEL_ID) return;

    const title = "📢 **Annonce Officielle – CellBlock RP**";
    const desc =
      "**🔨 En cours de développement**\n" +
      "CellBlock RP est actuellement en construction 🔧\n" +
      "Notre équipe travaille dur pour vous offrir une **expérience RP unique**, immersive et réaliste.\n\n" +
      "**⏳ Restez connectés !**\n" +
      "Nous annoncerons bientôt la date d’ouverture officielle 🚀";

    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setTitle("📢 Annonce Officielle – CellBlock RP")
      .setDescription(desc)
      .setFooter({ text: 'CellBlock RP | WL' });

    await msg.channel.send({ content: title, embeds: [embed] });

    // Supprimer le message d'origine si tu veux un salon clean :
    // await msg.delete().catch(() => {});

  } catch (e) {
    console.error('❌ Erreur auto-annonce :', e);
  }
});

client.login(process.env.TOKEN);
