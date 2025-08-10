// index.js
import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField, // (AJOUT) pour vérifier les permissions si besoin
} from 'discord.js';

// ====== Discord Bot ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

const ANNOUNCES_CHANNEL_ID      = process.env.ANNOUNCES_CHANNEL_ID;
const CHANNEL_GUIDE_ID          = process.env.CHANNEL_GUIDE_ID;        // (AJOUT) salon guide WL
const QCM_VALIDATION_CHANNEL_ID = process.env.QCM_VALIDATION_CHANNEL_ID;
const QCM_NOTIFY_SECRET         = process.env.QCM_NOTIFY_SECRET || '';
const QCM_WEBHOOK_URL           = process.env.QCM_WEBHOOK_URL || ''; // optionnel

// ====== HTTP Server (Railway public URL) ======
const app = express();
app.use(bodyParser.json());

// CORS (autorise appels depuis ton site)
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','x-qcm-secret'] }));
app.options('/notify-qcm', cors()); // préflight

// 📂 Servir le dossier public
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

// Home & health
app.get('/', (_req, res) => res.status(200).send('CellBlock Annonces — OK'));
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Helper : envoi via webhook si présent
async function sendViaWebhook(webhookUrl, embedPayload) {
  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(embedPayload)
    });
    if (!resp.ok) {
      console.error('Webhook error:', await resp.text());
    }
  } catch (e) {
    console.error('Webhook throw:', e);
  }
}

// QCM webhook endpoint
app.post('/notify-qcm', async (req, res) => {
  try {
    // Secret simple
    const secret = req.header('x-qcm-secret') || '';
    if (secret !== QCM_NOTIFY_SECRET) {
      return res.status(401).json({ ok: false, error: 'invalid_secret' });
    }

    // Données envoyées par qcm.html
    const { discordId, score, total, username } = req.body || {};
    if (!discordId || typeof score !== 'number' || typeof total !== 'number') {
      return res.status(400).json({ ok: false, error: 'bad_payload' });
    }

    const percent = Math.round((score / total) * 100);
    const ok = percent >= 70;

    const embed = new EmbedBuilder()
      .setColor(ok ? 0x22c55e : 0xef4444)
      .setTitle('🧪 QCM terminé')
      .setDescription(
        `• **Joueur** : <@${discordId}> (${username || 'inconnu'})\n` +
        `• **Score** : **${score}/${total}** (${percent}%)\n\n` +
        (ok
          ? `✅ **Éligible WL** — merci de le prendre en charge pour passage vocal.`
          : `❌ **Non éligible (moins de 70%)** — à revoir.`)
      )
      .setTimestamp();

    // 1) Salon privé (avec le bot)
    let sent = false;
    if (QCM_VALIDATION_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(QCM_VALIDATION_CHANNEL_ID);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [embed] });
          sent = true;
        }
      } catch (e) {
        console.error('send channel error:', e);
      }
    }

    // 2) Webhook (optionnel, en plus ou si le salon échoue)
    if (QCM_WEBHOOK_URL) {
      const embedPayload = {
        content: null,
        embeds: [{
          title: '🧪 QCM terminé',
          description:
            `• **Joueur** : <@${discordId}> (${username || 'inconnu'})\n` +
            `• **Score** : **${score}/${total}** (${percent}%)\n\n` +
            (ok
              ? `✅ **Éligible WL** — merci de le prendre en charge pour passage vocal.`
              : `❌ **Non éligible (moins de 70%)** — à revoir.`),
          color: ok ? 0x22c55e : 0xef4444,
          timestamp: new Date().toISOString()
        }]
      };
      await sendViaWebhook(QCM_WEBHOOK_URL, embedPayload);
      sent = true;
    }

    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('❌ /notify-qcm error:', e);
    return res.status(500).json({ ok: false });
  }
});

// IMPORTANT: Railway donne le port via process.env.PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 HTTP server up on :${PORT}`);
});

/* ============================
   MESSAGERIE DISCORD
   - Auto-annonce si un message est posté dans #annonces (comme avant)
   - (AJOUT) Commande texte !guidewl pour poster le guide WL dans le salon dédié
   ============================ */

// Contenu guide WL (AJOUT)
const GUIDE_WL = [
  '**📖 Guide pour réussir sa Whitelist – CellBlock RP**',
  '',
  '**1) Comprendre l’univers**',
  'CellBlock RP est un serveur RP prison : immersion, réalisme et cohérence obligatoires.',
  'Vous incarnez un détenu, un gardien ou un rôle lié à l’univers carcéral.',
  'Agissez toujours selon la logique “prison” et la cohérence de votre personnage.',
  '',
  '**2) Préparer sa candidature**',
  'Lisez le règlement et préparez une histoire claire : pourquoi votre perso est ici, ses objectifs.',
  'Adoptez un comportement RP irréprochable pendant le QCM et la présentation vocale.',
  '',
  '**3) Pendant le QCM**',
  'Lisez chaque question attentivement, évitez les réponses au hasard.',
  '',
  '**4) Passage vocal obligatoire**',
  'Après le QCM, passage en vocal avec le staff : présentez-vous et votre projet RP.',
  'Montrez votre motivation et votre compréhension de l’univers.',
  '',
  '**5) Après validation**',
  'Accès complet au serveur. Respectez votre rôle et développez votre personnage.',
  'La WL peut être retirée si l’esprit du serveur n’est pas respecté.'
].join('\n');

client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot) return;

    // (AJOUT) Commande simple pour poster le guide WL dans le salon guide
    if (msg.content.trim().toLowerCase() === '!guidewl') {
      // (optionnel) Vérif permission admin; sinon commente ces 3 lignes
      if (!msg.member?.permissions?.has(PermissionsBitField.Flags.Administrator)) {
        return msg.reply('⛔ Tu dois être admin pour utiliser cette commande.');
      }
      try {
        const guideChannel = await client.channels.fetch(CHANNEL_GUIDE_ID);
        if (guideChannel?.isTextBased()) {
          await guideChannel.send(GUIDE_WL);
          await msg.react('✅');
        }
      } catch (e) {
        console.error('❌ Envoi guide WL:', e);
        await msg.reply('Erreur lors de l’envoi du guide WL.');
      }
      return; // on s’arrête là pour cette commande
    }

    // ====== (Comportement existant) auto-annonce quand on poste dans #annonces ======
    if (msg.channel.id !== ANNOUNCES_CHANNEL_ID) return;

    const title = "📢 **Annonce Officielle – CellBlock RP**";
    const desc =
      "**🧩 Minijeu Cuisine**\n" +
      "Interface fermée par défaut avec bouton **Fermer**.\n" +
      "À la fin de la cuisson, l’item correspondant est automatiquement ajouté à l’inventaire.\n\n" +

      "**🎨 Améliorations visuelles**\n" +
      "Suppression de l’ancien fond bleu plein écran.\n" +
      "Nouveau fond bleu uniquement derrière le cadre du minijeu.\n\n" +

      "**📦 Nouveaux items ajoutés**\n" +
      "🥗 Salade composée\n" +
      "🧅 Oignons sautés\n" +
      "🥩 Steak fromage\n" +
      "🍝 Pâtes à la sauce tomate\n" +
      "🍫 Œufs au chocolat\n\n" +

      "**🌐 Site web**\n" +
      "Ajout d’un logo dans l’onglet du navigateur.\n" +
      "Règlement retravaillé pour plus de clarté et de professionnalisme.\n\n" +

      "**🔧 Optimisations**\n" +
      "Meilleure fluidité et système anti-spam pour éviter les abus.";

    const embed = new EmbedBuilder()
      .setColor(0xFF7A00)
      .setTitle("📢 Annonce Officielle – CellBlock RP")
      .setDescription(desc)
      .setFooter({ text: 'CellBlock RP | WL' });

    await msg.channel.send({
      content: "@everyone\n" + title,
      embeds: [embed],
      allowedMentions: { parse: ['everyone'] }
    });

  } catch (e) {
    console.error('❌ Erreur messageCreate :', e);
  }
});

client.login(process.env.TOKEN);
